export type NotificationType =
  | "post_like"
  | "comment"
  | "comment_like"
  | "mention"
  | "friend"
  | "friend_request"
  | "friend_accept"

export type NotificationActor = {
  _id: string
  firstName?: string
  lastName?: string
  picturePath?: string
  avatarColor?: string
}

export type AppNotification = {
  _id: string
  recipient: string
  actor: NotificationActor
  type: NotificationType
  postId: string | null
  commentId: string | null
  read: boolean
  createdAt?: string
}
