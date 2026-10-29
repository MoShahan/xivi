import mongoose from "mongoose"

const Schema = mongoose.Schema

export const BLOCK_REASONS = [
  "harassment",
  "bullying",
  "hate_speech",
  "offensive",
  "spam",
  "impersonation",
  "fake_account",
  "dont_want",
  "other",
]
export const CUSTOM_REASON_MAX = 200

const BlockSchema = new Schema(
  {
    blocker: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    blocked: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, enum: BLOCK_REASONS, required: true },
    customReason: { type: String, default: "", maxlength: CUSTOM_REASON_MAX },
  },
  { timestamps: true }
)

BlockSchema.index({ blocker: 1, blocked: 1 }, { unique: true })
BlockSchema.index({ blocker: 1, createdAt: -1 })
BlockSchema.index({ blocked: 1 })

const Block = mongoose.model("Block", BlockSchema)

export default Block
