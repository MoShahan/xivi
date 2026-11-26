import type { AppNotification, NotificationType } from "@/types/notifications"

export type NotificationTypeKind = "like" | "comment" | "mention" | "friend_request" | "friend"

export function notificationTypeKind(type: NotificationType): NotificationTypeKind {
  switch (type) {
    case "post_like":
    case "comment_like":
      return "like"
    case "comment":
      return "comment"
    case "mention":
      return "mention"
    case "friend_request":
      return "friend_request"
    case "friend":
    case "friend_accept":
      return "friend"
  }
}

export function notificationTypeLabel(type: NotificationType): string {
  switch (type) {
    case "post_like":
      return "Post like"
    case "comment_like":
      return "Comment like"
    case "comment":
      return "Comment"
    case "mention":
      return "Mention"
    case "friend_request":
      return "Friend request"
    case "friend":
    case "friend_accept":
      return "Friend"
  }
}

export function notificationCopy(n: AppNotification): string {
  const name = `${n.actor?.firstName || ""} ${n.actor?.lastName || ""}`.trim() || "Someone"
  switch (n.type) {
    case "post_like":
      return `${name} liked your post`
    case "comment":
      return `${name} commented on your post`
    case "comment_like":
      return `${name} liked your comment`
    case "mention":
      return n.commentId ? `${name} mentioned you in a comment` : `${name} mentioned you in a post`
    case "friend":
      return `${name} added you as a friend`
    case "friend_request":
      return `${name} sent you a friend request`
    case "friend_accept":
      return `${name} accepted your friend request`
    default:
      return `${name} interacted with you`
  }
}

export function notificationHref(n: AppNotification): string | null {
  if (n.type === "friend_request") return "/friend-requests"
  if (n.postId) return `/post/${n.postId}`
  if (n.actor?._id) return `/profile/${n.actor._id}`
  return null
}
