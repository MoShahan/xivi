import mongoose from "mongoose"

const Schema = mongoose.Schema

const NOTIFICATION_TYPES = [
  "post_like",
  "comment",
  "comment_like",
  "mention",
  "friend",
  "friend_request",
  "friend_accept",
]

const NotificationSchema = new Schema(
  {
    recipient: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    actor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    postId: { type: Schema.Types.ObjectId, ref: "Post", default: null },
    commentId: { type: String, default: null },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
)

NotificationSchema.index({ recipient: 1, createdAt: -1 })
/** TTL: auto-delete notifications ~90 days after creation (D3). */
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 })

const Notification = mongoose.model("Notification", NotificationSchema)

export default Notification
export { NOTIFICATION_TYPES }
