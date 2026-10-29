import mongoose from "mongoose"

const Schema = mongoose.Schema

const MessageSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, maxlength: 2000 },
  },
  { timestamps: true }
)

MessageSchema.index({ conversationId: 1, createdAt: -1 })

const Message = mongoose.model("Message", MessageSchema)

export default Message
