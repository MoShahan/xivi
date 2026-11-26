import mongoose from "mongoose"

const Schema = mongoose.Schema

/** @mention targets stored with the plain-text body (`@${display}`). */
const MentionSchema = new Schema(
  {
    userId: { type: String, required: true },
    /** Exact `First Last` as inserted (without `@`). */
    display: { type: String, required: true, trim: true },
  },
  { _id: false }
)

const CommentSchema = new Schema(
  {
    userId: { type: String, required: true },
    text: { type: String, required: true, trim: true },
    likes: { type: Map, of: Boolean, default: {} },
    mentions: { type: [MentionSchema], default: [] },
    /** Set only when the comment text is edited. */
    editedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

const PostSchema = new Schema(
  {
    userId: { type: String, required: true },
    description: { type: String, default: "" },
    url: { default: "", type: String },
    likes: { type: Map, of: Boolean },
    comments: { type: [CommentSchema], default: [] },
    mentions: { type: [MentionSchema], default: [] },
    /** Set only when description or image is edited (not likes / comments). */
    editedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

PostSchema.index({ userId: 1, createdAt: -1 })
PostSchema.index({ createdAt: -1 })

const Post = mongoose.model("Post", PostSchema)

export default Post
