"use client"

import React, { useRef, useState } from "react"
import {
  Bookmark,
  BookmarkBorder,
  ChatBubbleOutlineOutlined,
  ContentCopy,
  DeleteOutlined,
  EditOutlined,
  Facebook,
  FavoriteBorderOutlined,
  FavoriteOutlined,
  ImageOutlined,
  LinkedIn,
  MoreVert,
  SendRounded,
  ShareOutlined,
  WhatsApp,
  X,
} from "@mui/icons-material"
import {
  alpha,
  Box,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  InputBase,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material"
import { useRouter } from "next/navigation"

import { useAppDispatch, useAppSelector } from "@/app/hooks"
import { api, mediaUrl } from "@/lib/api"
import { getErrorMessage } from "@/lib/errors"
import { ACCEPT_IMAGE, validateImageFile } from "@/lib/imageUpload"
import {
  COMMENT_MAX,
  COMMENT_TOO_LONG,
  graphemeLength,
  POST_DESCRIPTION_LIMIT_REACHED,
  POST_DESCRIPTION_MAX,
  POST_DESCRIPTION_MAX_LABEL,
  truncateGraphemes,
} from "@/lib/postLimits"
import { buildShareText, buildShareUrls, openShareWindow } from "@/lib/share"
import { formatCompactTime, formatPostTime, withEditedLabel } from "@/lib/time"
import { useFeatureFlags } from "@/providers/FeatureFlagsProvider"
import { useToast } from "@/providers/ToastProvider"
import { removePost, setPost, setSavedPosts } from "@/state"
import { type Post, sameUserId } from "@/types/models"

import EmojiPickerButton, { insertEmojiAtCursor } from "./EmojiPickerButton"
import ExpandableText from "./ExpandableText"
import FlexBetween from "./FlexBetween"
import Friend from "./Friend"
import LikersDialog from "./LikersDialog"
import UserImage from "./UserImage"
import WidgetWrapper from "./WidgetWrapper"

type PostWidgetProps = {
  post: Post
  /** Called after a successful delete (e.g. leave the single-post page). */
  onDeleted?: () => void
}

const COMMENTS_INITIAL_VISIBLE = 3
const COMMENTS_LOAD_STEP = 5

const PostWidget = ({ post, onDeleted }: PostWidgetProps) => {
  const dispatch = useAppDispatch()
  const router = useRouter()
  const user = useAppSelector(state => state.user)
  const { success, error: toastError, info } = useToast()
  const likes = post.likes ?? {}
  const isLiked = Boolean(user?._id && likes[user._id])
  const likesCount = Object.keys(likes).length
  const comments = post.comments ?? []
  const isOwnPost = Boolean(user?._id && String(user._id) === String(post.userId))
  const isAdmin = user?.role === "admin"
  const { enabled } = useFeatureFlags()
  const canLikePosts = enabled("likesPosts")
  const canLikeComments = enabled("likesComments")
  const canCommentsCreate = enabled("commentsCreate")
  const canCommentsEdit = enabled("commentsEdit")
  const canCommentsDelete = enabled("commentsDelete")
  const canPostsEdit = enabled("postsEdit")
  const canPostsDelete = enabled("postsDelete")
  const canSave = enabled("postsSave")
  const canShare = enabled("share")
  const canEmoji = enabled("postsEmoji")
  const showEditPost = isOwnPost && canPostsEdit
  const showDeletePost = (isOwnPost && canPostsDelete) || isAdmin
  const canModeratePost = showEditPost || showDeletePost
  const isSaved = Boolean(user?.savedPosts?.some(id => String(id) === String(post._id)))

  const theme = useTheme()
  const primary = theme.palette.primary.main
  const neutral = theme.palette.neutral.main
  const medium = theme.palette.neutral.medium

  const [isComments, setIsComments] = useState(false)
  const [visibleCommentCount, setVisibleCommentCount] = useState(COMMENTS_INITIAL_VISIBLE)
  const [commentText, setCommentText] = useState("")
  const [commentError, setCommentError] = useState<string | undefined>()
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const [shareAnchor, setShareAnchor] = useState<null | HTMLElement>(null)
  const [commentMenu, setCommentMenu] = useState<{ anchor: HTMLElement; commentId: string } | null>(
    null
  )
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editCommentText, setEditCommentText] = useState("")
  const [editCommentError, setEditCommentError] = useState<string | undefined>()
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [confirmDeleteCommentId, setConfirmDeleteCommentId] = useState<string | null>(null)
  const [isDeletingComment, setIsDeletingComment] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [likersOpen, setLikersOpen] = useState(false)
  const [commentLikersId, setCommentLikersId] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editDescription, setEditDescription] = useState("")
  const [editPicture, setEditPicture] = useState<File | null>(null)
  const [editRemoveImage, setEditRemoveImage] = useState(false)
  const [editError, setEditError] = useState<string | undefined>()
  const [isSavingEditPost, setIsSavingEditPost] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const editDescriptionInputRef = useRef<HTMLInputElement>(null)
  const commentInputRef = useRef<HTMLInputElement>(null)
  const editCommentInputRef = useRef<HTMLInputElement>(null)
  const likeInFlight = useRef(false)
  const commentLikeInFlight = useRef<Set<string>>(new Set())

  const authorName =
    [post.user?.firstName, post.user?.lastName].filter(Boolean).join(" ").trim() || "Unknown user"
  const editCharCount = graphemeLength(editDescription)
  const editAtLimit = editCharCount >= POST_DESCRIPTION_MAX

  const patchLike = async () => {
    if (!user?._id || likeInFlight.current) return
    const uid = String(user._id)
    const previous = post
    const nextLikes = { ...(post.likes ?? {}) }
    if (nextLikes[uid]) delete nextLikes[uid]
    else nextLikes[uid] = true
    likeInFlight.current = true
    dispatch(setPost({ post: { ...post, likes: nextLikes } }))
    try {
      const { data } = await api.patch<{ message: string; updatedPost: Post }>(`/posts/${post._id}/like`)
      dispatch(setPost({ post: data.updatedPost }))
    } catch (err: unknown) {
      dispatch(setPost({ post: previous }))
      toastError(getErrorMessage(err, "Failed to update like"))
    } finally {
      likeInFlight.current = false
    }
  }

  const toggleSave = async () => {
    try {
      const { data } = isSaved
        ? await api.delete<{ message: string; saved: boolean; savedPosts: string[] }>(
            `/posts/${post._id}/save`
          )
        : await api.put<{ message: string; saved: boolean; savedPosts: string[] }>(
            `/posts/${post._id}/save`
          )
      dispatch(setSavedPosts({ savedPosts: data.savedPosts }))
      success(data.message || (data.saved ? "Post saved" : "Post unsaved"))
    } catch (err: unknown) {
      toastError(getErrorMessage(err, isSaved ? "Failed to unsave post" : "Failed to save post"))
    }
  }

  const goToProfile = (userId: string | undefined) => {
    if (!userId) return
    if (sameUserId(user?._id, userId)) {
      router.push("/profile")
    } else {
      router.push(`/profile/${userId}`)
    }
  }

  const patchCommentLike = async (commentId: string) => {
    if (!user?._id || commentLikeInFlight.current.has(commentId)) return
    const uid = String(user._id)
    const previous = post
    const nextComments = (post.comments ?? []).map(c => {
      if (String(c._id) !== String(commentId)) return c
      const nextLikes = { ...(c.likes ?? {}) }
      if (nextLikes[uid]) delete nextLikes[uid]
      else nextLikes[uid] = true
      return { ...c, likes: nextLikes }
    })
    commentLikeInFlight.current.add(commentId)
    dispatch(setPost({ post: { ...post, comments: nextComments } }))
    try {
      const { data } = await api.patch<{ message: string; updatedPost: Post }>(
        `/posts/${post._id}/comments/${commentId}/like`
      )
      dispatch(setPost({ post: data.updatedPost }))
    } catch (err: unknown) {
      dispatch(setPost({ post: previous }))
      toastError(getErrorMessage(err, "Failed to update comment like"))
    } finally {
      commentLikeInFlight.current.delete(commentId)
    }
  }

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = commentText.trim()
    if (!text) {
      setCommentError("Write a comment")
      return
    }
    if (graphemeLength(text) > COMMENT_MAX) {
      setCommentError(COMMENT_TOO_LONG)
      return
    }
    if (!user?._id) {
      setCommentError("You must be signed in to comment")
      return
    }
    const previous = post
    const tempId = `temp-${Date.now()}`
    const optimisticComment = {
      _id: tempId,
      userId: String(user._id),
      text,
      createdAt: new Date().toISOString(),
      likes: {},
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        picturePath: user.picturePath,
        avatarColor: user.avatarColor,
      },
    }
    const optimisticComments = [...(post.comments ?? []), optimisticComment]
    dispatch(setPost({ post: { ...post, comments: optimisticComments } }))
    setCommentText("")
    setVisibleCommentCount(optimisticComments.length)
    setCommentError(undefined)
    try {
      setIsSubmittingComment(true)
      const { data } = await api.post<{ updatedPost: Post }>(`/posts/${post._id}/comments`, { text })
      dispatch(setPost({ post: data.updatedPost }))
      setVisibleCommentCount(data.updatedPost.comments?.length ?? COMMENTS_INITIAL_VISIBLE)
      success("Comment added")
    } catch (err: unknown) {
      dispatch(setPost({ post: previous }))
      setCommentText(text)
      const msg = getErrorMessage(err, "Failed to add comment")
      setCommentError(msg)
      toastError(msg)
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const handleDelete = async () => {
    try {
      setIsDeleting(true)
      await api.delete(`/posts/${post._id}`)
      dispatch(removePost({ postId: post._id }))
      setConfirmDeleteOpen(false)
      success("Post deleted")
      onDeleted?.()
    } catch (err: unknown) {
      toastError(getErrorMessage(err, "Failed to delete post"))
    } finally {
      setIsDeleting(false)
    }
  }

  const openEditPost = () => {
    setMenuAnchor(null)
    setEditDescription(post.description || "")
    setEditPicture(null)
    setEditRemoveImage(false)
    setEditError(undefined)
    setEditOpen(true)
  }

  const closeEditPost = () => {
    if (isSavingEditPost) return
    setEditOpen(false)
    setEditPicture(null)
    setEditRemoveImage(false)
    setEditError(undefined)
  }

  const saveEditPost = async () => {
    const description = editDescription.trim()
    const keepingImage = Boolean(post.url) && !editRemoveImage
    const addingImage = Boolean(editPicture)
    if (!description && !keepingImage && !addingImage) {
      setEditError("Add text or a photo")
      return
    }
    if (graphemeLength(description) > POST_DESCRIPTION_MAX) {
      setEditError(`Keep posts under ${POST_DESCRIPTION_MAX_LABEL}`)
      return
    }

    try {
      setIsSavingEditPost(true)
      setEditError(undefined)
      const formData = new FormData()
      formData.append("description", description)
      if (editRemoveImage && !editPicture) {
        formData.append("removeImage", "true")
      }
      if (editPicture) {
        formData.append("picture", editPicture)
      }

      const { data } = await api.patch<{ message: string; updatedPost: Post }>(
        `/posts/${post._id}`,
        formData
      )
      dispatch(setPost({ post: data.updatedPost }))
      setEditOpen(false)
      setEditPicture(null)
      setEditRemoveImage(false)
      success(data.message || "Post updated")
    } catch (err: unknown) {
      setEditError(getErrorMessage(err, "Failed to update post"))
      toastError(getErrorMessage(err, "Failed to update post"))
    } finally {
      setIsSavingEditPost(false)
    }
  }

  const share = buildShareUrls(post._id, { text: buildShareText(post.description) })

  const copyPostLink = async () => {
    setShareAnchor(null)
    try {
      await navigator.clipboard.writeText(share.pageUrl)
      success("Link copied")
    } catch {
      toastError("Could not copy link")
    }
  }

  const shareTo = (url: string) => {
    setShareAnchor(null)
    openShareWindow(url)
    info("Opening share…")
  }

  const startEditComment = (commentId: string, currentText: string) => {
    setCommentMenu(null)
    setEditingCommentId(commentId)
    setEditCommentText(currentText)
    setEditCommentError(undefined)
  }

  const cancelEditComment = () => {
    setEditingCommentId(null)
    setEditCommentText("")
    setEditCommentError(undefined)
  }

  const saveEditComment = async (commentId: string) => {
    const text = editCommentText.trim()
    if (!text) {
      setEditCommentError("Write a comment")
      return
    }
    if (graphemeLength(text) > COMMENT_MAX) {
      setEditCommentError(COMMENT_TOO_LONG)
      return
    }
    try {
      setIsSavingEdit(true)
      setEditCommentError(undefined)
      const { data } = await api.patch<{ message: string; updatedPost: Post }>(
        `/posts/${post._id}/comments/${commentId}`,
        { text }
      )
      dispatch(setPost({ post: data.updatedPost }))
      cancelEditComment()
      success("Comment updated")
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Failed to update comment")
      setEditCommentError(msg)
      toastError(msg)
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleDeleteComment = async () => {
    if (!confirmDeleteCommentId) return
    try {
      setIsDeletingComment(true)
      const { data } = await api.delete<{ message: string; updatedPost: Post }>(
        `/posts/${post._id}/comments/${confirmDeleteCommentId}`
      )
      dispatch(setPost({ post: data.updatedPost }))
      setConfirmDeleteCommentId(null)
      if (editingCommentId === confirmDeleteCommentId) cancelEditComment()
      success("Comment deleted")
    } catch (err: unknown) {
      toastError(getErrorMessage(err, "Failed to delete comment"))
    } finally {
      setIsDeletingComment(false)
    }
  }

  return (
    <WidgetWrapper>
      <Friend
        id={post.userId}
        name={authorName}
        subtitle={withEditedLabel(formatPostTime(post.createdAt), post.editedAt)}
        url={post.user?.picturePath || ""}
        avatarColor={post.user?.avatarColor}
        avatarSize="44px"
        showFriendButton={false}
        endAction={
          canModeratePost ? (
            <>
              <Tooltip title="Post options">
                <IconButton
                  aria-label="Post options"
                  aria-haspopup="true"
                  aria-expanded={Boolean(menuAnchor)}
                  onClick={e => setMenuAnchor(e.currentTarget)}
                >
                  <MoreVert />
                </IconButton>
              </Tooltip>
              <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={() => setMenuAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
              >
                {showEditPost ? (
                  <MenuItem onClick={openEditPost}>
                    <ListItemIcon>
                      <EditOutlined fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Edit post</ListItemText>
                  </MenuItem>
                ) : null}
                {showDeletePost ? (
                  <MenuItem
                    onClick={() => {
                      setMenuAnchor(null)
                      setConfirmDeleteOpen(true)
                    }}
                  >
                    <ListItemIcon>
                      <DeleteOutlined fontSize="small" color="error" />
                    </ListItemIcon>
                    <ListItemText slotProps={{ primary: { sx: { color: "error.main" } } }}>
                      {isOwnPost ? "Delete post" : "Delete post (admin)"}
                    </ListItemText>
                  </MenuItem>
                ) : null}
              </Menu>
            </>
          ) : undefined
        }
      />
      {post?.description ? (
        <ExpandableText
          text={post.description}
          maxWords={40}
          typographySx={{
            color: theme.palette.text.primary,
            mt: "0.75rem",
            fontSize: "0.9375rem",
            lineHeight: 1.55,
          }}
          buttonSx={{ color: primary, ml: 0 }}
        />
      ) : null}
      {post?.url ? (
        <Box
          sx={{
            mt: "0.75rem",
            borderRadius: 2,
            overflow: "hidden",
            bgcolor: "action.hover",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: imageFailed ? 120 : undefined,
            maxHeight: { xs: "min(300px, 45vh)", sm: "min(360px, 50vh)" },
          }}
        >
          {imageFailed ? (
            <Typography
              sx={{
                px: 2,
                py: 3,
                color: theme.palette.neutral.medium,
                fontSize: "0.875rem",
                textAlign: "center",
              }}
            >
              Image unavailable
            </Typography>
          ) : (
            <Box
              component="img"
              alt="Post image"
              src={mediaUrl(post.url)}
              onError={() => setImageFailed(true)}
              sx={{
                display: "block",
                width: "100%",
                maxHeight: { xs: "min(300px, 45vh)", sm: "min(360px, 50vh)" },
                objectFit: "contain",
              }}
            />
          )}
        </Box>
      ) : null}
      <Divider sx={{ mt: "0.75rem", mb: "0.15rem", opacity: 0.7 }} />
      <FlexBetween sx={{ py: 0.15 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            {canLikePosts ? (
              <Tooltip title={isLiked ? "Unlike" : "Like"}>
                <IconButton
                  size="small"
                  onClick={() => void patchLike()}
                  aria-label={isLiked ? "Unlike" : "Like"}
                  aria-pressed={isLiked}
                  sx={{
                    p: "0.35rem",
                    transition: "transform 0.15s ease",
                    "&:active": { transform: "scale(0.88)" },
                  }}
                >
                  {isLiked ? (
                    <FavoriteOutlined
                      sx={{
                        color: primary,
                        fontSize: "1.25rem",
                        transform: "scale(1.06)",
                        transition: "transform 0.15s ease",
                      }}
                    />
                  ) : (
                    <FavoriteBorderOutlined sx={{ fontSize: "1.25rem" }} />
                  )}
                </IconButton>
              </Tooltip>
            ) : null}
            <Typography
              component="button"
              type="button"
              onClick={() => setLikersOpen(true)}
              aria-label={`View who liked this post (${likesCount})`}
              sx={{
                border: 0,
                background: "none",
                padding: "0.15rem 0.1rem 0.15rem 0",
                margin: 0,
                ml: "-0.15rem",
                minWidth: 0,
                cursor: "pointer",
                color: isLiked ? primary : "inherit",
                font: "inherit",
                fontWeight: 600,
                fontSize: "0.8125rem",
                lineHeight: 1,
                borderRadius: 1,
                transition: "color 0.15s ease",
                "&:hover": { textDecoration: "underline", color: primary },
              }}
            >
              {likesCount}
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Tooltip title={isComments ? "Hide comments" : "Comments"}>
              <IconButton
                size="small"
                onClick={() => {
                  setIsComments(prev => {
                    if (prev) setVisibleCommentCount(COMMENTS_INITIAL_VISIBLE)
                    return !prev
                  })
                }}
                aria-label={isComments ? "Hide comments" : "Show comments"}
                aria-expanded={isComments}
                sx={{
                  p: "0.35rem",
                  ...(isComments ? { color: primary } : null),
                }}
              >
                <ChatBubbleOutlineOutlined sx={{ fontSize: "1.25rem" }} />
              </IconButton>
            </Tooltip>
            <Typography
              sx={{
                fontWeight: 600,
                fontSize: "0.8125rem",
                lineHeight: 1,
                minWidth: 0,
                ml: "-0.15rem",
                color: isComments ? primary : "inherit",
              }}
            >
              {comments.length}
            </Typography>
          </Box>
        </Box>
        <FlexBetween sx={{ gap: 0 }}>
          {canSave ? (
            <Tooltip title={isSaved ? "Unsave" : "Save"}>
              <IconButton
                size="small"
                onClick={() => void toggleSave()}
                aria-label={isSaved ? "Unsave post" : "Save post"}
                aria-pressed={isSaved}
                sx={{
                  transition: "transform 0.15s ease",
                  "&:active": { transform: "scale(0.88)" },
                }}
              >
                {isSaved ? (
                  <Bookmark sx={{ color: primary, fontSize: "1.25rem" }} />
                ) : (
                  <BookmarkBorder sx={{ fontSize: "1.25rem" }} />
                )}
              </IconButton>
            </Tooltip>
          ) : null}
          {canShare ? (
            <Tooltip title="Share">
              <IconButton
                size="small"
                aria-label="Share"
                aria-haspopup="true"
                aria-expanded={Boolean(shareAnchor)}
                onClick={e => setShareAnchor(e.currentTarget)}
              >
                <ShareOutlined sx={{ fontSize: "1.25rem" }} />
              </IconButton>
            </Tooltip>
          ) : null}
        </FlexBetween>
        <Menu
          anchorEl={shareAnchor}
          open={canShare && Boolean(shareAnchor)}
          onClose={() => setShareAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <MenuItem onClick={copyPostLink}>
            <ListItemIcon>
              <ContentCopy fontSize="small" />
            </ListItemIcon>
            <ListItemText>Copy link</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => shareTo(share.x)}>
            <ListItemIcon>
              <X fontSize="small" />
            </ListItemIcon>
            <ListItemText>Share on X</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => shareTo(share.facebook)}>
            <ListItemIcon>
              <Facebook fontSize="small" />
            </ListItemIcon>
            <ListItemText>Share on Facebook</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => shareTo(share.linkedin)}>
            <ListItemIcon>
              <LinkedIn fontSize="small" />
            </ListItemIcon>
            <ListItemText>Share on LinkedIn</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => shareTo(share.whatsapp)}>
            <ListItemIcon>
              <WhatsApp fontSize="small" />
            </ListItemIcon>
            <ListItemText>Share on WhatsApp</ListItemText>
          </MenuItem>
        </Menu>
      </FlexBetween>
      <Collapse in={isComments} timeout={220} unmountOnExit>
        <Box
          sx={{
            mt: 1.25,
            pt: 1.25,
            borderTop: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 700,
              fontSize: "0.7rem",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: medium,
              mb: 1.25,
              px: 0.25,
            }}
          >
            {comments.length === 0
              ? "Comments"
              : `${comments.length} comment${comments.length === 1 ? "" : "s"}`}
          </Typography>

          {comments.length === 0 ? (
            <Box
              role="status"
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                py: 1.1,
                px: 1.5,
                mb: 1.15,
                borderRadius: 2,
                border: `1px dashed ${theme.palette.divider}`,
                bgcolor: theme =>
                  theme.palette.mode === "dark"
                    ? alpha(theme.palette.common.white, 0.03)
                    : alpha(theme.palette.common.black, 0.02),
              }}
            >
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  flexShrink: 0,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: alpha(primary, theme.palette.mode === "dark" ? 0.14 : 0.1),
                  color: primary,
                }}
              >
                <ChatBubbleOutlineOutlined sx={{ fontSize: "0.95rem" }} />
              </Box>
              <Typography sx={{ color: medium, fontSize: "0.8125rem", lineHeight: 1.35 }}>
                Be the first to comment
              </Typography>
            </Box>
          ) : (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1.75,
                mb: comments.length > visibleCommentCount ? 0.5 : 1.25,
                px: 0.25,
              }}
            >
              {comments.slice(0, visibleCommentCount).map((comment, index) => {
                const name =
                  [comment.user?.firstName, comment.user?.lastName].filter(Boolean).join(" ").trim() ||
                  "User"
                const commentLikes = comment.likes ?? {}
                const isCommentLiked = Boolean(user?._id && commentLikes[user._id])
                const commentLikesCount = Object.keys(commentLikes).length
                const isOwnComment = Boolean(comment._id && sameUserId(user?._id, comment.userId))
                const canModerateComment =
                  (isOwnComment && (canCommentsEdit || canCommentsDelete)) || isAdmin
                const isEditing = Boolean(comment._id && editingCommentId === comment._id)
                return (
                  <Box
                    key={comment._id || `${post._id}-c-${index}`}
                    sx={{
                      display: "flex",
                      gap: 1.25,
                      alignItems: "flex-start",
                      "@keyframes commentEnter": {
                        from: { opacity: 0, transform: "translateY(6px)" },
                        to: { opacity: 1, transform: "translateY(0)" },
                      },
                      animation: "commentEnter 0.28s ease both",
                      animationDelay: `${Math.min(index, 6) * 35}ms`,
                    }}
                  >
                    <Box
                      onClick={() => goToProfile(comment.userId)}
                      onKeyDown={e => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          goToProfile(comment.userId)
                        }
                      }}
                      role={comment.userId ? "link" : undefined}
                      tabIndex={comment.userId ? 0 : undefined}
                      aria-label={comment.userId ? `View ${name}'s profile` : undefined}
                      sx={{
                        flexShrink: 0,
                        mt: 0.1,
                        cursor: comment.userId ? "pointer" : "default",
                        borderRadius: "50%",
                      }}
                    >
                      <UserImage
                        image={comment.user?.picturePath || ""}
                        name={name}
                        size="36px"
                        bgColor={comment.user?.avatarColor}
                      />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.75,
                          minWidth: 0,
                        }}
                      >
                        <Typography
                          component="button"
                          type="button"
                          title={name}
                          onClick={() => goToProfile(comment.userId)}
                          sx={{
                            border: 0,
                            background: "none",
                            padding: 0,
                            margin: 0,
                            font: "inherit",
                            cursor: comment.userId ? "pointer" : "default",
                            color: theme.palette.neutral.dark,
                            fontWeight: 700,
                            fontSize: "0.875rem",
                            lineHeight: 1.3,
                            textAlign: "left",
                            borderRadius: 0.5,
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            transition: "color 0.15s ease",
                            "&:hover": {
                              color: comment.userId ? primary : theme.palette.neutral.dark,
                            },
                          }}
                        >
                          {name}
                        </Typography>
                        {comment.createdAt ? (
                          <Typography
                            sx={{
                              color: medium,
                              fontSize: "0.75rem",
                              fontWeight: 500,
                              flexShrink: 0,
                              lineHeight: 1.3,
                            }}
                          >
                            {withEditedLabel(formatCompactTime(comment.createdAt), comment.editedAt)}
                          </Typography>
                        ) : null}
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            gap: 0.15,
                            ml: "auto",
                            flexShrink: 0,
                            width: 76,
                          }}
                        >
                          {comment._id && !isEditing && canLikeComments ? (
                            <Box
                              sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "flex-end",
                                gap: 0.15,
                                minWidth: 40,
                              }}
                            >
                              <IconButton
                                size="small"
                                onClick={() => void patchCommentLike(comment._id!)}
                                aria-label={isCommentLiked ? "Unlike comment" : "Like comment"}
                                aria-pressed={isCommentLiked}
                                sx={{ p: 0.35, color: isCommentLiked ? primary : medium }}
                              >
                                {isCommentLiked ? (
                                  <FavoriteOutlined sx={{ fontSize: "1rem" }} />
                                ) : (
                                  <FavoriteBorderOutlined sx={{ fontSize: "1rem" }} />
                                )}
                              </IconButton>
                              <Typography
                                component={commentLikesCount > 0 ? "button" : "span"}
                                type={commentLikesCount > 0 ? "button" : undefined}
                                onClick={
                                  commentLikesCount > 0
                                    ? () => setCommentLikersId(comment._id!)
                                    : undefined
                                }
                                aria-label={
                                  commentLikesCount > 0
                                    ? `View who liked this comment (${commentLikesCount})`
                                    : undefined
                                }
                                sx={{
                                  border: 0,
                                  background: "none",
                                  cursor: commentLikesCount > 0 ? "pointer" : "default",
                                  fontFamily: "inherit",
                                  fontSize: "0.8rem",
                                  fontWeight: 500,
                                  color: isCommentLiked ? primary : medium,
                                  p: 0,
                                  minWidth: "1.75ch",
                                  textAlign: "left",
                                  visibility: commentLikesCount > 0 ? "visible" : "hidden",
                                  "&:hover":
                                    commentLikesCount > 0 ? { textDecoration: "underline" } : undefined,
                                }}
                              >
                                {commentLikesCount || 0}
                              </Typography>
                            </Box>
                          ) : comment._id && !isEditing && commentLikesCount > 0 ? (
                            <Typography
                              component="button"
                              type="button"
                              onClick={() => setCommentLikersId(comment._id!)}
                              aria-label={`View who liked this comment (${commentLikesCount})`}
                              sx={{
                                border: 0,
                                background: "none",
                                cursor: "pointer",
                                fontFamily: "inherit",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "flex-end",
                                gap: 0.15,
                                minWidth: 40,
                                fontSize: "0.8rem",
                                fontWeight: 500,
                                color: medium,
                                p: 0.35,
                                "&:hover": { textDecoration: "underline" },
                              }}
                            >
                              <FavoriteBorderOutlined sx={{ fontSize: "1rem" }} />
                              {commentLikesCount}
                            </Typography>
                          ) : (
                            <Box sx={{ minWidth: 40 }} aria-hidden />
                          )}
                          {canModerateComment && comment._id && !isEditing ? (
                            <IconButton
                              size="small"
                              aria-label="Comment options"
                              aria-haspopup="true"
                              aria-expanded={commentMenu?.commentId === comment._id}
                              onClick={e =>
                                setCommentMenu({ anchor: e.currentTarget, commentId: comment._id! })
                              }
                              sx={{ p: 0.3, color: medium, width: 28, height: 28 }}
                            >
                              <MoreVert sx={{ fontSize: "1.15rem" }} />
                            </IconButton>
                          ) : (
                            <Box sx={{ width: 28, height: 28, flexShrink: 0 }} aria-hidden />
                          )}
                        </Box>
                      </Box>
                      {isEditing && comment._id ? (
                        <Box sx={{ mt: 0.65 }}>
                          <InputBase
                            fullWidth
                            multiline
                            maxRows={4}
                            autoFocus
                            inputRef={editCommentInputRef}
                            inputProps={{
                              "aria-label": "Edit comment",
                              "aria-invalid": Boolean(editCommentError),
                            }}
                            value={editCommentText}
                            onChange={e => {
                              setEditCommentText(truncateGraphemes(e.target.value, COMMENT_MAX))
                              if (editCommentError) setEditCommentError(undefined)
                            }}
                            disabled={isSavingEdit}
                            sx={{
                              backgroundColor: theme.palette.background.paper,
                              borderRadius: 2,
                              padding: "0.55rem 0.75rem",
                              fontSize: "0.9rem",
                              border: editCommentError
                                ? `1px solid ${theme.palette.error.main}`
                                : `1px solid ${theme.palette.divider}`,
                              "&.Mui-focused": {
                                borderColor: alpha(primary, 0.55),
                                boxShadow: `0 0 0 3px ${alpha(primary, 0.12)}`,
                              },
                            }}
                          />
                          {editCommentError && (
                            <Typography
                              sx={{ color: "error.main", mt: 0.35, fontSize: "0.75rem" }}
                              role="alert"
                            >
                              {editCommentError}
                            </Typography>
                          )}
                          <Box sx={{ display: "flex", gap: 0.75, mt: 0.85, alignItems: "center" }}>
                            {canEmoji ? (
                              <EmojiPickerButton
                                dense
                                disabled={isSavingEdit}
                                onSelect={emoji =>
                                  insertEmojiAtCursor(
                                    editCommentInputRef.current,
                                    editCommentText,
                                    emoji,
                                    next => setEditCommentText(truncateGraphemes(next, COMMENT_MAX))
                                  )
                                }
                              />
                            ) : null}
                            <Button
                              size="small"
                              variant="contained"
                              disabled={isSavingEdit}
                              onClick={() => saveEditComment(comment._id!)}
                              sx={{ textTransform: "none", fontWeight: 600, borderRadius: 2 }}
                            >
                              {isSavingEdit ? "Saving…" : "Save"}
                            </Button>
                            <Button
                              size="small"
                              disabled={isSavingEdit}
                              onClick={cancelEditComment}
                              sx={{ textTransform: "none" }}
                            >
                              Cancel
                            </Button>
                          </Box>
                        </Box>
                      ) : (
                        <ExpandableText
                          text={comment.text}
                          maxWords={30}
                          typographySx={{
                            color: theme.palette.text.primary,
                            fontWeight: 400,
                            fontSize: "0.9rem",
                            mt: 0.15,
                            lineHeight: 1.45,
                          }}
                          buttonSx={{ color: primary }}
                        />
                      )}
                    </Box>
                  </Box>
                )
              })}
            </Box>
          )}

          {comments.length > visibleCommentCount && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 0.75, mb: 0.5 }}>
              <Button
                size="small"
                onClick={() =>
                  setVisibleCommentCount(count =>
                    Math.min(count + COMMENTS_LOAD_STEP, comments.length)
                  )
                }
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  color: primary,
                  borderRadius: 2,
                  px: 1.5,
                  "&:hover": { bgcolor: alpha(primary, 0.08) },
                }}
              >
                View {Math.min(COMMENTS_LOAD_STEP, comments.length - visibleCommentCount)} more
              </Button>
            </Box>
          )}

          <Menu
            anchorEl={commentMenu?.anchor ?? null}
            open={Boolean(commentMenu)}
            onClose={() => setCommentMenu(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            {(() => {
              const menuTarget = comments.find(c => c._id === commentMenu?.commentId)
              const menuIsOwn = Boolean(menuTarget && sameUserId(user?._id, menuTarget.userId))
              const showCommentEdit = menuIsOwn && canCommentsEdit
              const showCommentDelete = (menuIsOwn && canCommentsDelete) || isAdmin
              return (
                <>
                  {showCommentEdit ? (
                    <MenuItem
                      onClick={() => {
                        if (menuTarget?._id) startEditComment(menuTarget._id, menuTarget.text)
                      }}
                    >
                      <ListItemIcon>
                        <EditOutlined fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>Edit</ListItemText>
                    </MenuItem>
                  ) : null}
                  {showCommentDelete ? (
                    <MenuItem
                      onClick={() => {
                        const id = commentMenu?.commentId
                        setCommentMenu(null)
                        if (id) setConfirmDeleteCommentId(id)
                      }}
                    >
                      <ListItemIcon>
                        <DeleteOutlined fontSize="small" color="error" />
                      </ListItemIcon>
                      <ListItemText slotProps={{ primary: { sx: { color: "error.main" } } }}>
                        {menuIsOwn ? "Delete" : "Delete (admin)"}
                      </ListItemText>
                    </MenuItem>
                  ) : null}
                </>
              )
            })()}
          </Menu>

          {canCommentsCreate ? (
          <Box
            component="form"
            onSubmit={submitComment}
            noValidate
            sx={{
              display: "flex",
              alignItems: "flex-end",
              gap: 1,
              mt: comments.length === 0 ? 0 : 0.25,
            }}
          >
            <Box sx={{ flexShrink: 0, mb: 0.35 }}>
              <UserImage
                image={user?.picturePath || ""}
                name={user ? `${user.firstName} ${user.lastName}` : "You"}
                size="34px"
                bgColor={user?.avatarColor}
              />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 0.5,
                  pl: 1.75,
                  pr: 0.5,
                  py: 0.4,
                  minHeight: 44,
                  borderRadius: "16px",
                  bgcolor: theme =>
                    theme.palette.mode === "dark"
                      ? alpha(theme.palette.common.white, 0.06)
                      : theme.palette.neutral.light,
                  border: commentError
                    ? `1px solid ${theme.palette.error.main}`
                    : `1px solid ${theme.palette.divider}`,
                  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                  "&:focus-within": {
                    borderColor: alpha(primary, 0.55),
                    boxShadow: `0 0 0 3px ${alpha(primary, 0.12)}`,
                  },
                }}
              >
                <InputBase
                  fullWidth
                  multiline
                  maxRows={6}
                  inputRef={commentInputRef}
                  placeholder="Add a comment…"
                  inputProps={{ "aria-label": "Add a comment", "aria-invalid": Boolean(commentError) }}
                  value={commentText}
                  onChange={e => {
                    setCommentText(truncateGraphemes(e.target.value, COMMENT_MAX))
                    if (commentError) setCommentError(undefined)
                  }}
                  disabled={isSubmittingComment}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    py: 0.7,
                    fontSize: "0.9rem",
                    lineHeight: 1.45,
                    "& textarea": {
                      overflow: "auto !important",
                    },
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      const form = e.currentTarget.closest("form")
                      if (form && !isSubmittingComment && commentText.trim()) {
                        if (typeof form.requestSubmit === "function") form.requestSubmit()
                        else form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }))
                      }
                    }
                  }}
                />
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.25,
                    flexShrink: 0,
                    pb: 0.2,
                  }}
                >
                  {canEmoji ? (
                    <EmojiPickerButton
                      dense
                      disabled={isSubmittingComment}
                      onSelect={emoji =>
                        insertEmojiAtCursor(
                          commentInputRef.current,
                          commentText,
                          emoji,
                          next => {
                            setCommentText(truncateGraphemes(next, COMMENT_MAX))
                            if (commentError) setCommentError(undefined)
                          }
                        )
                      }
                    />
                  ) : null}
                  <Tooltip title="Post comment">
                    <Box component="span" sx={{ display: "inline-flex" }}>
                      <IconButton
                        type="submit"
                        size="small"
                        disabled={isSubmittingComment || !commentText.trim()}
                        aria-label="Post comment"
                        sx={{
                          color: theme.palette.common.white,
                          bgcolor: primary,
                          width: 32,
                          height: 32,
                          "&:hover": { bgcolor: theme.palette.primary.dark },
                          "&.Mui-disabled": {
                            bgcolor: alpha(primary, 0.35),
                            color: alpha(theme.palette.common.white, 0.7),
                          },
                        }}
                      >
                        <SendRounded sx={{ fontSize: "1.05rem" }} />
                      </IconButton>
                    </Box>
                  </Tooltip>
                </Box>
              </Box>
              {commentError && (
                <Typography sx={{ color: "error.main", mt: 0.5, ml: 0.5, fontSize: "0.75rem" }} role="alert">
                  {commentError}
                </Typography>
              )}
            </Box>
          </Box>
          ) : comments.length === 0 ? (
            <Typography sx={{ color: medium, fontSize: "0.85rem", py: 1.25, textAlign: "center" }}>
              Commenting is temporarily disabled.
            </Typography>
          ) : null}
        </Box>
      </Collapse>

      <Dialog open={editOpen} onClose={closeEditPost} fullWidth maxWidth="sm">
        <DialogTitle>Edit post</DialogTitle>
        <DialogContent>
          <Box
            sx={{
              mt: 1,
              backgroundColor: theme.palette.neutral.light,
              borderRadius: "12px",
              border: editError
                ? `1px solid ${theme.palette.error.main}`
                : `1px solid ${theme.palette.divider}`,
              transition: "border-color 0.15s ease, box-shadow 0.15s ease",
              "&:focus-within": {
                borderColor: primary,
                boxShadow: `0 0 0 3px ${alpha(primary, 0.14)}`,
              },
            }}
          >
            <InputBase
              fullWidth
              multiline
              minRows={3}
              maxRows={8}
              inputRef={editDescriptionInputRef}
              value={editDescription}
              onChange={e => {
                setEditDescription(truncateGraphemes(e.target.value, POST_DESCRIPTION_MAX))
                if (editError) setEditError(undefined)
              }}
              disabled={isSavingEditPost}
              placeholder="What's on your mind?"
              aria-describedby="edit-post-char-count"
              sx={{
                px: 1.25,
                pt: 1,
                pb: 0.5,
                fontSize: "0.95rem",
              }}
            />
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                px: 0.65,
                pb: 0.55,
                gap: 1,
              }}
            >
              <Typography
                id="edit-post-char-count"
                component="span"
                aria-live="polite"
                sx={{
                  fontSize: "0.75rem",
                  fontWeight: editAtLimit ? 600 : 400,
                  color: editAtLimit ? "error.main" : theme.palette.neutral.mediumMain,
                  pl: 0.5,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {editCharCount.toLocaleString()} / {POST_DESCRIPTION_MAX.toLocaleString()}
              </Typography>
              {canEmoji ? (
                <EmojiPickerButton
                  dense
                  disabled={isSavingEditPost}
                  onSelect={emoji =>
                    insertEmojiAtCursor(
                      editDescriptionInputRef.current,
                      editDescription,
                      emoji,
                      next => setEditDescription(truncateGraphemes(next, POST_DESCRIPTION_MAX))
                    )
                  }
                />
              ) : null}
            </Box>
          </Box>
          {(editError || editAtLimit) && (
            <Typography sx={{ color: "error.main", mt: "0.35rem", fontSize: "0.75rem" }} role="alert">
              {editError || POST_DESCRIPTION_LIMIT_REACHED}
            </Typography>
          )}

          {post.url && !editRemoveImage && !editPicture && (
            <Box sx={{ mt: "1rem" }}>
              <Box
                component="img"
                src={mediaUrl(post.url)}
                alt="Current post"
                sx={{ width: "100%", maxHeight: 240, objectFit: "contain", borderRadius: "0.75rem" }}
              />
              <Button
                size="small"
                color="error"
                disabled={isSavingEditPost}
                onClick={() => setEditRemoveImage(true)}
                sx={{ mt: 0.5, textTransform: "none" }}
              >
                Remove image
              </Button>
            </Box>
          )}

          {(editRemoveImage || !post.url) && !editPicture && (
            <Typography sx={{ color: medium, mt: "0.75rem", fontSize: "0.8125rem" }}>
              {editRemoveImage ? "Image will be removed on save." : "No image on this post."}
            </Typography>
          )}

          {editPicture && (
            <Typography sx={{ color: neutral, mt: "0.75rem", fontSize: "0.875rem" }}>
              New image: {editPicture.name}
            </Typography>
          )}

          <Box sx={{ mt: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <Button
              component="label"
              size="small"
              startIcon={<ImageOutlined />}
              disabled={isSavingEditPost}
              sx={{ textTransform: "none" }}
            >
              {editPicture || post.url ? "Replace image" : "Add image"}
              <input
                hidden
                type="file"
                accept={ACCEPT_IMAGE}
                onChange={e => {
                  const file = e.target.files?.[0] ?? null
                  e.target.value = ""
                  if (!file) return
                  const invalid = validateImageFile(file)
                  if (invalid) {
                    toastError(invalid)
                    return
                  }
                  setEditPicture(file)
                  setEditRemoveImage(false)
                  if (editError) setEditError(undefined)
                }}
              />
            </Button>
            {editPicture && (
              <Button
                size="small"
                disabled={isSavingEditPost}
                onClick={() => setEditPicture(null)}
                sx={{ textTransform: "none" }}
              >
                Clear new image
              </Button>
            )}
            {editRemoveImage && (
              <Button
                size="small"
                disabled={isSavingEditPost}
                onClick={() => setEditRemoveImage(false)}
                sx={{ textTransform: "none" }}
              >
                Keep current image
              </Button>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditPost} disabled={isSavingEditPost}>
            Cancel
          </Button>
          <Button onClick={() => void saveEditPost()} disabled={isSavingEditPost} variant="contained">
            {isSavingEditPost ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmDeleteOpen} onClose={() => !isDeleting && setConfirmDeleteOpen(false)}>
        <DialogTitle>Delete post?</DialogTitle>
        <DialogContent>
          <DialogContentText>This cannot be undone. The post will be removed from the feed.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteOpen(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button onClick={handleDelete} color="error" disabled={isDeleting} autoFocus>
            {isDeleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(confirmDeleteCommentId)}
        onClose={() => !isDeletingComment && setConfirmDeleteCommentId(null)}
      >
        <DialogTitle>Delete comment?</DialogTitle>
        <DialogContent>
          <DialogContentText>This cannot be undone.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteCommentId(null)} disabled={isDeletingComment}>
            Cancel
          </Button>
          <Button onClick={handleDeleteComment} color="error" disabled={isDeletingComment} autoFocus>
            {isDeletingComment ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      <LikersDialog
        open={likersOpen}
        onClose={() => setLikersOpen(false)}
        fetchPath={likersOpen ? `/posts/${post._id}/likes` : null}
        title="Liked by"
      />

      <LikersDialog
        open={Boolean(commentLikersId)}
        onClose={() => setCommentLikersId(null)}
        fetchPath={
          commentLikersId ? `/posts/${post._id}/comments/${commentLikersId}/likes` : null
        }
        title="Liked by"
      />
    </WidgetWrapper>
  )
}

export default PostWidget
