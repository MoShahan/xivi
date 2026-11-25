import mongoose from "mongoose"

const Schema = mongoose.Schema

const NewsArticleSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    url: { type: String, required: true },
    image: { type: String, default: "" },
    publishedAt: { type: String, default: "" },
    sourceName: { type: String, default: "" },
    sourceUrl: { type: String, default: "" },
  },
  { _id: false }
)

const NewsCacheSchema = new Schema(
  {
    /** UTC hour bucket, e.g. `2026-11-25T15`. */
    hourKey: { type: String, required: true, unique: true },
    provider: { type: String, required: true, default: "gnews" },
    fetchedAt: { type: Date, required: true },
    articles: { type: [NewsArticleSchema], default: [] },
  },
  { timestamps: true }
)

/** Drop hour buckets ~48 hours after fetch. */
NewsCacheSchema.index({ fetchedAt: 1 }, { expireAfterSeconds: 60 * 60 * 48 })

const NewsCache = mongoose.model("NewsCache", NewsCacheSchema)

export default NewsCache
