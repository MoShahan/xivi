import mongoose from "mongoose"

const Schema = mongoose.Schema

const ConversationSchema = new Schema(
  {
    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
      required: true,
      validate: {
        validator: value => Array.isArray(value) && value.length === 2,
        message: "A conversation must have exactly two participants",
      },
    },
    /** Sorted `"idA:idB"` so each pair is unique. */
    participantKey: { type: String, required: true, unique: true },
    lastMessageAt: { type: Date, default: Date.now },
    lastMessageText: { type: String, default: "" },
    lastSenderId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    lastReadAt: { type: Map, of: Date, default: () => new Map() },
  },
  { timestamps: true }
)

ConversationSchema.index({ participants: 1, lastMessageAt: -1 })

const Conversation = mongoose.model("Conversation", ConversationSchema)

export default Conversation
