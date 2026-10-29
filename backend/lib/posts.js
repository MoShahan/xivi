import User from "../models/User.js"

/**
 * Normalize Mongoose Map / plain likes to a plain object for JSON clients.
 * @param {unknown} likes
 * @returns {Record<string, boolean>}
 */
export function serializeLikes(likes) {
  if (!likes) return {}
  if (likes instanceof Map) {
    return Object.fromEntries(likes)
  }
  if (typeof likes === "object") {
    return { ...likes }
  }
  return {}
}

/** User ids that liked (keys of a likes Map / plain object). */
export function likesMapKeys(likes) {
  if (!likes) return []
  if (likes instanceof Map) return [...likes.keys()].map(String)
  if (typeof likes === "object") return Object.keys(likes).map(String)
  return []
}

/**
 * Resolve like-map user ids to public profile snapshots (no password).
 * @param {string[]} ids
 * @returns {Promise<{ _id: string, firstName: string, lastName: string, picturePath: string }[]>}
 */
export async function usersFromLikeIds(ids) {
  const unique = [...new Set((ids || []).map(String).filter(Boolean))]
  if (unique.length === 0) return []

  const users = await User.find({ _id: { $in: unique } })
    .select("_id firstName lastName picturePath avatarColor")
    .lean()

  const byId = Object.fromEntries(users.map(u => [String(u._id), u]))
  return unique
    .map(id => byId[id])
    .filter(Boolean)
    .map(u => ({
      _id: String(u._id),
      firstName: u.firstName,
      lastName: u.lastName,
      picturePath: u.picturePath || "",
      avatarColor: u.avatarColor || "#314F3B",
    }))
}

const DEFAULT_LIKERS_LIMIT = 20
const MAX_LIKERS_LIMIT = 50

/**
 * Parse page/limit query for likers lists.
 * @param {Record<string, unknown>} query
 */
export function parseLikersPagination(query = {}) {
  const rawPage = Number.parseInt(String(query.page ?? "1"), 10)
  const rawLimit = Number.parseInt(String(query.limit ?? String(DEFAULT_LIKERS_LIMIT)), 10)
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1
  const limit = Math.min(MAX_LIKERS_LIMIT, Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : DEFAULT_LIKERS_LIMIT)
  return { page, limit, skip: (page - 1) * limit }
}

/**
 * Page through like-map ids and resolve user snapshots.
 * @param {string[]} ids
 * @param {{ page: number, limit: number, skip: number }} pagination
 */
export async function resolveLikersPage(ids, pagination, options = {}) {
  const hide = new Set((options.hideUserIds || []).map(String).filter(Boolean))
  const unique = [...new Set((ids || []).map(String).filter(id => id && !hide.has(id)))]
  const total = unique.length
  const { page, limit, skip } = pagination
  const slice = unique.slice(skip, skip + limit)
  const likers = await usersFromLikeIds(slice)
  return {
    likers,
    page,
    limit,
    total,
    hasMore: skip + limit < total,
  }
}

function authorSnapshot(author) {
  if (!author) return null
  return {
    firstName: author.firstName,
    lastName: author.lastName,
    location: author.location || "",
    picturePath: author.picturePath || "",
    avatarColor: author.avatarColor || "#314F3B",
  }
}

function formatComment(comment, byId) {
  // Legacy bare string comments
  if (typeof comment === "string") {
    return {
      _id: undefined,
      userId: "",
      text: comment,
      createdAt: undefined,
      editedAt: null,
      likes: {},
      user: null,
    }
  }

  const raw = comment?.toObject ? comment.toObject() : comment
  return {
    _id: raw._id ? String(raw._id) : undefined,
    userId: raw.userId ? String(raw.userId) : "",
    text: raw.text || "",
    createdAt: raw.createdAt,
    editedAt: raw.editedAt || null,
    likes: serializeLikes(raw.likes),
    user: authorSnapshot(byId[String(raw.userId)]),
  }
}

/**
 * Attach author snapshot (`user`) to each post and comment authors.
 * `Post.userId` is a string, not a ref.
 * @param {import("mongoose").Document[] | object[]} posts
 * @param {{ hideUserIds?: string[] }} [options]
 */
export async function withAuthors(posts, options = {}) {
  const hideSet = new Set((options.hideUserIds || []).map(String).filter(Boolean))
  const list = (Array.isArray(posts) ? posts : []).map(p => (p?.toObject ? p.toObject() : { ...p }))
  if (list.length === 0) return []

  const ids = new Set()
  for (const post of list) {
    if (post.userId) ids.add(String(post.userId))
    for (const c of post.comments || []) {
      if (c && typeof c === "object" && c.userId) {
        const cid = String(c.userId)
        if (!hideSet.has(cid)) ids.add(cid)
      }
    }
  }

  const users = await User.find({ _id: { $in: [...ids] } })
    .select("firstName lastName location picturePath avatarColor")
    .lean()

  const byId = Object.fromEntries(users.map(u => [String(u._id), u]))

  return list.map(post => {
    const author = byId[String(post.userId)]
    const comments = (post.comments || []).filter(c => {
      if (typeof c === "string") return true
      const uid = c?.userId ? String(c.userId) : ""
      return !uid || !hideSet.has(uid)
    })
    return {
      ...post,
      likes: serializeLikes(post.likes),
      comments: comments.map(c => formatComment(c, byId)),
      user: authorSnapshot(author),
    }
  })
}
