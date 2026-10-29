import { assertNotBlocked, assertVisibleUser, excludeHiddenAuthors, hiddenUserIdsForRequest } from "../lib/blocks.js"
import { assertFeatureEnabled } from "../lib/features.js"
import { uploadImageBuffer } from "../lib/imagekit.js"
import { createNotification } from "../lib/notifications.js"
import { createdAtFilter, pageFromDocs, parseCursorPagination } from "../lib/pagination.js"
import { COMMENTS_PER_POST_MAX, graphemeLength, POST_DESCRIPTION_MAX } from "../lib/postLimits.js"
import { likesMapKeys, parseLikersPagination, resolveLikersPage, withAuthors } from "../lib/posts.js"
import Post from "../models/Post.js"
import User from "../models/User.js"

async function presentPosts(req, posts) {
  return withAuthors(posts, { hideUserIds: await hiddenUserIdsForRequest(req) })
}

export const createPost = async (req, res, next) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: "Unauthenticated" })
    }

    await assertFeatureEnabled(req, "postsCreate")

    const description = typeof req.body.description === "string" ? req.body.description.trim() : ""

    if (!description && !req.file?.buffer) {
      return res.status(400).json({ error: "Post must include text or an image" })
    }
    if (graphemeLength(description) > POST_DESCRIPTION_MAX) {
      return res.status(400).json({ error: `Post text must be ${POST_DESCRIPTION_MAX} characters or fewer` })
    }

    let url = ""
    if (req.file?.buffer) {
      await assertFeatureEnabled(req, "postsImages")
      const uploaded = await uploadImageBuffer(req.file.buffer, req.file.originalname, "/xivi/posts")
      url = uploaded.url || ""
    }

    const newPost = new Post({ description, userId, url, likes: {}, comments: [] })
    await newPost.save()
    const [formatted] = await presentPosts(req, [newPost])
    res.status(201).json({ post: formatted })
  } catch (e) {
    if (e.message?.includes("IMAGEKIT_PRIVATE_KEY")) {
      return res.status(503).json({ error: "Image upload is not configured" })
    }
    next(e)
  }
}

/**
 * Home feed. Query `scope`:
 * - `all` (default): every post, newest first
 * - `friends` (alias for personal network): me ∪ accepted friends ∪ users I follow
 */
export const getFeed = async (req, res, next) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: "Unauthenticated" })
    }

    const scopeRaw = typeof req.query.scope === "string" ? req.query.scope.trim().toLowerCase() : "all"
    const scope = scopeRaw === "friends" || scopeRaw === "following" || scopeRaw === "network" ? "friends" : "all"

    const { limit, cursorDate, sinceDate } = parseCursorPagination(req.query)
    const filter = createdAtFilter({ sinceDate, cursorDate })

    const hidden = await hiddenUserIdsForRequest(req)

    if (scope === "friends") {
      const me = await User.findById(userId).select("friends following")
      if (!me) {
        return res.status(401).json({ error: "Unauthenticated" })
      }
      const hideSet = new Set(hidden)
      const authorIds = [
        ...new Set([
          String(userId),
          ...(me.friends || []).map(id => String(id)),
          ...(me.following || []).map(id => String(id)),
        ]),
      ].filter(id => id === String(userId) || !hideSet.has(id))
      filter.userId = { $in: authorIds }
    } else {
      excludeHiddenAuthors(filter, hidden)
    }

    const docs = await Post.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
    const { pageDocs, nextCursor, hasMore } = pageFromDocs(docs, limit)
    res.status(200).json({
      posts: await withAuthors(pageDocs, { hideUserIds: hidden }),
      nextCursor,
      hasMore,
      scope,
    })
  } catch (e) {
    next(e)
  }
}

export const getPost = async (req, res, next) => {
  try {
    const { postId } = req.params
    const post = await Post.findById(postId)
    if (!post) {
      return res.status(404).json({ error: "Post not found" })
    }
    await assertVisibleUser(req, post.userId, "Post not found")
    const [formatted] = await presentPosts(req, [post])
    res.status(200).json(formatted)
  } catch (e) {
    next(e)
  }
}

export const getUserPosts = async (req, res, next) => {
  try {
    const { userId } = req.params
    await assertVisibleUser(req, userId)
    const { limit, cursorDate, sinceDate } = parseCursorPagination(req.query)
    const filter = { userId, ...createdAtFilter({ sinceDate, cursorDate }) }
    const docs = await Post.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
    const { pageDocs, nextCursor, hasMore } = pageFromDocs(docs, limit)
    res.status(200).json({
      posts: await presentPosts(req, pageDocs),
      nextCursor,
      hasMore,
    })
  } catch (e) {
    next(e)
  }
}

export const likePost = async (req, res, next) => {
  try {
    const { postId } = req.params
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: "Unauthenticated" })
    }

    await assertFeatureEnabled(req, "likesPosts")

    const post = await Post.findById(postId)
    if (!post) {
      return res.status(404).json({ error: "Post not found" })
    }

    await assertNotBlocked(userId, post.userId)

    const likeKey = `likes.${userId}`
    const isLiked = Boolean(post.likes?.get?.(userId))
    let message = ""
    let updatedPost
    if (isLiked) {
      updatedPost = await Post.findByIdAndUpdate(postId, { $unset: { [likeKey]: "" } }, { new: true })
      message = "your like has been removed"
    } else {
      updatedPost = await Post.findByIdAndUpdate(postId, { $set: { [likeKey]: true } }, { new: true })
      message = "you liked this post"
      void createNotification({
        recipientId: String(post.userId),
        actorId: userId,
        type: "post_like",
        postId: String(post._id),
      })
    }

    const [formatted] = await presentPosts(req, [updatedPost])

    res.status(200).json({ message, updatedPost: formatted })
  } catch (e) {
    if (e.status === 403 && e.expose) {
      return res.status(403).json({ error: e.message })
    }
    next(e)
  }
}

/** List users who liked a post (from the post likes map keys). Supports ?page=&limit=. */
export const getPostLikers = async (req, res, next) => {
  try {
    const { postId } = req.params
    const post = await Post.findById(postId)
    if (!post) {
      return res.status(404).json({ error: "Post not found" })
    }

    await assertVisibleUser(req, post.userId, "Post not found")
    const pagination = parseLikersPagination(req.query)
    const result = await resolveLikersPage(likesMapKeys(post.likes), pagination, {
      hideUserIds: await hiddenUserIdsForRequest(req),
    })
    res.status(200).json(result)
  } catch (e) {
    next(e)
  }
}

export const addComment = async (req, res, next) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: "Unauthenticated" })
    }

    await assertFeatureEnabled(req, "commentsCreate")

    const { postId } = req.params
    const text = typeof req.body.text === "string" ? req.body.text.trim() : ""
    if (!text) {
      return res.status(400).json({ error: "Comment text is required" })
    }
    if (text.length > 2000) {
      return res.status(400).json({ error: "Comment is too long" })
    }

    const post = await Post.findById(postId)
    if (!post) {
      return res.status(404).json({ error: "Post not found" })
    }
    await assertNotBlocked(userId, post.userId)
    if ((post.comments?.length || 0) >= COMMENTS_PER_POST_MAX) {
      return res.status(400).json({
        error: `This post has reached the maximum of ${COMMENTS_PER_POST_MAX} comments`,
      })
    }

    post.comments.push({ userId, text, likes: {} })
    await post.save()

    const added = post.comments[post.comments.length - 1]
    void createNotification({
      recipientId: String(post.userId),
      actorId: userId,
      type: "comment",
      postId: String(post._id),
      commentId: added?._id ? String(added._id) : null,
    })

    const [formatted] = await presentPosts(req, [post])
    res.status(201).json({ updatedPost: formatted })
  } catch (e) {
    if (e.status === 403 && e.expose) {
      return res.status(403).json({ error: e.message })
    }
    next(e)
  }
}

export const likeComment = async (req, res, next) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: "Unauthenticated" })
    }

    await assertFeatureEnabled(req, "likesComments")

    const { postId, commentId } = req.params
    const post = await Post.findById(postId)
    if (!post) {
      return res.status(404).json({ error: "Post not found" })
    }

    const comment = post.comments.id(commentId)
    if (!comment) {
      return res.status(404).json({ error: "Comment not found" })
    }

    await assertNotBlocked(userId, comment.userId)
    await assertNotBlocked(userId, post.userId)

    if (!comment.likes) {
      comment.likes = new Map()
    }

    const likePath = `comments.$.likes.${userId}`
    const isLiked = Boolean(comment.likes?.get?.(userId))
    let message = ""
    let updatedPost
    if (isLiked) {
      updatedPost = await Post.findOneAndUpdate(
        { _id: postId, "comments._id": commentId },
        { $unset: { [likePath]: "" } },
        { new: true }
      )
      message = "Comment like removed"
    } else {
      updatedPost = await Post.findOneAndUpdate(
        { _id: postId, "comments._id": commentId },
        { $set: { [likePath]: true } },
        { new: true }
      )
      message = "Comment liked"
      void createNotification({
        recipientId: String(comment.userId),
        actorId: userId,
        type: "comment_like",
        postId: String(post._id),
        commentId: String(comment._id),
      })
    }

    if (!updatedPost) {
      return res.status(404).json({ error: "Comment not found" })
    }

    const [formatted] = await presentPosts(req, [updatedPost])
    res.status(200).json({ message, updatedPost: formatted })
  } catch (e) {
    next(e)
  }
}

/** List users who liked a comment (from the comment likes map keys). Supports ?page=&limit=. */
export const getCommentLikers = async (req, res, next) => {
  try {
    const { postId, commentId } = req.params
    const post = await Post.findById(postId)
    if (!post) {
      return res.status(404).json({ error: "Post not found" })
    }

    await assertVisibleUser(req, post.userId, "Post not found")
    const comment = post.comments.id(commentId)
    if (!comment) {
      return res.status(404).json({ error: "Comment not found" })
    }

    const pagination = parseLikersPagination(req.query)
    const result = await resolveLikersPage(likesMapKeys(comment.likes), pagination, {
      hideUserIds: await hiddenUserIdsForRequest(req),
    })
    res.status(200).json(result)
  } catch (e) {
    next(e)
  }
}

export const editComment = async (req, res, next) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: "Unauthenticated" })
    }

    await assertFeatureEnabled(req, "commentsEdit")

    const { postId, commentId } = req.params
    const text = typeof req.body.text === "string" ? req.body.text.trim() : ""
    if (!text) {
      return res.status(400).json({ error: "Comment text is required" })
    }
    if (text.length > 2000) {
      return res.status(400).json({ error: "Comment is too long" })
    }

    const post = await Post.findById(postId)
    if (!post) {
      return res.status(404).json({ error: "Post not found" })
    }

    const comment = post.comments.id(commentId)
    if (!comment) {
      return res.status(404).json({ error: "Comment not found" })
    }

    if (String(comment.userId) !== String(userId)) {
      return res.status(403).json({ error: "You can only edit your own comments" })
    }

    if (comment.text !== text) {
      comment.text = text
      comment.editedAt = new Date()
    }
    post.markModified("comments")
    await post.save()

    const [formatted] = await presentPosts(req, [post])
    res.status(200).json({ message: "Comment updated", updatedPost: formatted })
  } catch (e) {
    next(e)
  }
}

export const deleteComment = async (req, res, next) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: "Unauthenticated" })
    }

    const { postId, commentId } = req.params
    const post = await Post.findById(postId)
    if (!post) {
      return res.status(404).json({ error: "Post not found" })
    }

    const comment = post.comments.id(commentId)
    if (!comment) {
      return res.status(404).json({ error: "Comment not found" })
    }

    const isOwner = String(comment.userId) === String(userId)
    const isAdmin = req.user?.role === "admin"
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "You can only delete your own comments" })
    }
    // Owner delete respects flag; admin moderation always allowed.
    if (isOwner && !isAdmin) {
      await assertFeatureEnabled(req, "commentsDelete")
    }

    comment.deleteOne()
    await post.save()

    const [formatted] = await presentPosts(req, [post])
    res.status(200).json({ message: "Comment deleted", updatedPost: formatted })
  } catch (e) {
    next(e)
  }
}

export const deletePost = async (req, res, next) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: "Unauthenticated" })
    }

    const { postId } = req.params
    const post = await Post.findById(postId)
    if (!post) {
      return res.status(404).json({ error: "Post not found" })
    }

    const isOwner = String(post.userId) === String(userId)
    const isAdmin = req.user?.role === "admin"
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "You can only delete your own posts" })
    }
    if (isOwner && !isAdmin) {
      await assertFeatureEnabled(req, "postsDelete")
    }

    await Post.findByIdAndDelete(postId)
    // Drop deleted post from everyone's bookmarks.
    await User.updateMany({ savedPosts: postId }, { $pull: { savedPosts: postId } })
    res.status(200).json({ message: "Post deleted", postId })
  } catch (e) {
    next(e)
  }
}

/** Update own post description and/or image (multipart optional `picture`). */
export const updatePost = async (req, res, next) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: "Unauthenticated" })
    }

    await assertFeatureEnabled(req, "postsEdit")

    const { postId } = req.params
    const post = await Post.findById(postId)
    if (!post) {
      return res.status(404).json({ error: "Post not found" })
    }

    if (String(post.userId) !== String(userId)) {
      return res.status(403).json({ error: "You can only edit your own posts" })
    }

    const hasDescriptionField = typeof req.body.description === "string"
    const description = hasDescriptionField ? req.body.description.trim() : (post.description || "").trim()

    const removeImageRaw = req.body.removeImage
    const removeImage = removeImageRaw === true || removeImageRaw === "true" || removeImageRaw === "1"

    let url = post.url || ""
    if (removeImage) {
      await assertFeatureEnabled(req, "postsImages")
      url = ""
    }
    if (req.file?.buffer) {
      await assertFeatureEnabled(req, "postsImages")
      const uploaded = await uploadImageBuffer(req.file.buffer, req.file.originalname, "/xivi/posts")
      url = uploaded.url || ""
    }

    if (!description && !url) {
      return res.status(400).json({ error: "Post must include text or an image" })
    }
    if (graphemeLength(description) > POST_DESCRIPTION_MAX) {
      return res.status(400).json({ error: `Post text must be ${POST_DESCRIPTION_MAX} characters or fewer` })
    }

    const contentChanged = (post.description || "") !== description || (post.url || "") !== url
    post.description = description
    post.url = url
    if (contentChanged) {
      post.editedAt = new Date()
    }
    await post.save()

    const [formatted] = await presentPosts(req, [post])
    res.status(200).json({ message: "Post updated", updatedPost: formatted })
  } catch (e) {
    if (e.message?.includes("IMAGEKIT_PRIVATE_KEY")) {
      return res.status(503).json({ error: "Image upload is not configured" })
    }
    next(e)
  }
}

/** Idempotent save: add post to JWT user's savedPosts (own or others’). */
export const savePost = async (req, res, next) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: "Unauthenticated" })
    }

    await assertFeatureEnabled(req, "postsSave")

    const { postId } = req.params
    const post = await Post.findById(postId).select("_id userId")
    if (!post) {
      return res.status(404).json({ error: "Post not found" })
    }

    await assertNotBlocked(userId, post.userId)

    const user = await User.findByIdAndUpdate(userId, { $addToSet: { savedPosts: post._id } }, { new: true }).select(
      "savedPosts"
    )

    if (!user) {
      return res.status(401).json({ error: "Unauthenticated" })
    }

    res.status(200).json({
      message: "Post saved",
      saved: true,
      savedPosts: (user.savedPosts || []).map(id => String(id)),
    })
  } catch (e) {
    next(e)
  }
}

/** Remove post from JWT user's savedPosts. */
export const unsavePost = async (req, res, next) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: "Unauthenticated" })
    }

    await assertFeatureEnabled(req, "postsSave")

    const { postId } = req.params
    const post = await Post.findById(postId).select("_id")
    if (!post) {
      return res.status(404).json({ error: "Post not found" })
    }

    const user = await User.findByIdAndUpdate(userId, { $pull: { savedPosts: post._id } }, { new: true }).select(
      "savedPosts"
    )

    if (!user) {
      return res.status(401).json({ error: "Unauthenticated" })
    }

    res.status(200).json({
      message: "Post unsaved",
      saved: false,
      savedPosts: (user.savedPosts || []).map(id => String(id)),
    })
  } catch (e) {
    next(e)
  }
}

/** List posts the JWT user has saved (newest save first). Private to owner. Cursor = last post id. */
export const getSavedPosts = async (req, res, next) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: "Unauthenticated" })
    }

    const user = await User.findById(userId).select("savedPosts")
    if (!user) {
      return res.status(401).json({ error: "Unauthenticated" })
    }

    const { limit } = parseCursorPagination(req.query)
    const cursorId = typeof req.query.cursor === "string" ? req.query.cursor.trim() : ""
    const idsNewestFirst = [...(user.savedPosts || [])].reverse().map(id => String(id))

    let start = 0
    if (cursorId) {
      const idx = idsNewestFirst.indexOf(cursorId)
      start = idx >= 0 ? idx + 1 : idsNewestFirst.length
    }

    const pageIds = idsNewestFirst.slice(start, start + limit + 1)
    const hasMore = pageIds.length > limit
    const sliceIds = hasMore ? pageIds.slice(0, limit) : pageIds

    if (sliceIds.length === 0) {
      return res.status(200).json({ posts: [], nextCursor: null, hasMore: false })
    }

    const hidden = await hiddenUserIdsForRequest(req)
    const posts = await Post.find({
      _id: { $in: sliceIds },
      ...(hidden.length ? { userId: { $nin: hidden } } : {}),
    })
    const byId = Object.fromEntries(posts.map(p => [String(p._id), p]))
    const ordered = sliceIds.map(id => byId[id]).filter(Boolean)
    const nextCursor = hasMore ? sliceIds[sliceIds.length - 1] : null

    res.status(200).json({
      posts: await withAuthors(ordered, { hideUserIds: hidden }),
      nextCursor,
      hasMore,
    })
  } catch (e) {
    next(e)
  }
}

/**
 * Posts the JWT user has liked (Map key = user id).
 * Sorted by post `createdAt` desc (document sort; not “liked at” time).
 */
export const getLikedPosts = async (req, res, next) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: "Unauthenticated" })
    }

    const { limit, cursorDate } = parseCursorPagination(req.query)
    const hidden = await hiddenUserIdsForRequest(req)
    const filter = {
      [`likes.${userId}`]: true,
      ...(cursorDate ? { createdAt: { $lt: cursorDate } } : {}),
    }
    excludeHiddenAuthors(filter, hidden)
    const docs = await Post.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
    const { pageDocs, nextCursor, hasMore } = pageFromDocs(docs, limit)
    res.status(200).json({
      posts: await withAuthors(pageDocs, { hideUserIds: hidden }),
      nextCursor,
      hasMore,
    })
  } catch (e) {
    next(e)
  }
}

/**
 * Distinct posts the JWT user has commented on.
 * Sorted by post `createdAt` desc (not newest-comment time).
 */
export const getCommentedPosts = async (req, res, next) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: "Unauthenticated" })
    }

    const { limit, cursorDate } = parseCursorPagination(req.query)
    const hidden = await hiddenUserIdsForRequest(req)
    const filter = {
      "comments.userId": String(userId),
      ...(cursorDate ? { createdAt: { $lt: cursorDate } } : {}),
    }
    excludeHiddenAuthors(filter, hidden)
    const docs = await Post.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
    const { pageDocs, nextCursor, hasMore } = pageFromDocs(docs, limit)
    res.status(200).json({
      posts: await withAuthors(pageDocs, { hideUserIds: hidden }),
      nextCursor,
      hasMore,
    })
  } catch (e) {
    next(e)
  }
}
