import NewsCache from "../models/NewsCache.js"

const GNEWS_TOP_HEADLINES = "https://gnews.io/api/v4/top-headlines"
const MAX_ARTICLES = 10

/** @type {Map<string, Promise<{ hourKey: string, fetchedAt: string, articles: object[] }>>} */
const inFlight = new Map()

/**
 * @param {number} status
 * @param {string} message
 */
function httpError(status, message) {
  const err = new Error(message)
  err.status = status
  err.expose = true
  return err
}

/**
 * UTC hour bucket key, e.g. `2026-11-25T15`.
 * @param {Date} [date]
 */
export function getHourKey(date = new Date()) {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, "0")
  const d = String(date.getUTCDate()).padStart(2, "0")
  const h = String(date.getUTCHours()).padStart(2, "0")
  return `${y}-${m}-${d}T${h}`
}

/**
 * @param {unknown} raw
 */
function mapArticle(raw) {
  if (!raw || typeof raw !== "object") return null
  const a = /** @type {Record<string, unknown>} */ (raw)
  const title = typeof a.title === "string" ? a.title.trim() : ""
  const url = typeof a.url === "string" ? a.url.trim() : ""
  if (!title || !url) return null

  const source =
    a.source && typeof a.source === "object" ? /** @type {Record<string, unknown>} */ (a.source) : {}

  return {
    id: typeof a.id === "string" && a.id ? a.id : url,
    title,
    description: typeof a.description === "string" ? a.description : "",
    url,
    image: typeof a.image === "string" ? a.image : "",
    publishedAt: typeof a.publishedAt === "string" ? a.publishedAt : "",
    sourceName: typeof source.name === "string" ? source.name : "",
    sourceUrl: typeof source.url === "string" ? source.url : "",
  }
}

/**
 * @param {import("mongoose").Document | { hourKey: string, fetchedAt: Date, articles: object[] }} doc
 */
function toFeedDto(doc) {
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc
  return {
    hourKey: plain.hourKey,
    fetchedAt: new Date(plain.fetchedAt).toISOString(),
    articles: (plain.articles || []).map(a => ({
      id: a.id,
      title: a.title,
      description: a.description || "",
      url: a.url,
      image: a.image || "",
      publishedAt: a.publishedAt || "",
      sourceName: a.sourceName || "",
      sourceUrl: a.sourceUrl || "",
    })),
  }
}

async function fetchFromGnews() {
  const apiKey = process.env.GNEWS_API_KEY
  if (!apiKey || !String(apiKey).trim()) {
    throw httpError(503, "News is temporarily unavailable")
  }

  const params = new URLSearchParams({
    category: "general",
    lang: "en",
    max: String(MAX_ARTICLES),
    apikey: String(apiKey).trim(),
  })

  const response = await fetch(`${GNEWS_TOP_HEADLINES}?${params}`, {
    headers: { Accept: "application/json" },
  })

  if (!response.ok) {
    throw httpError(502, "Unable to load news right now")
  }

  const data = await response.json()
  const list = Array.isArray(data?.articles) ? data.articles : []
  const articles = list.map(mapArticle).filter(Boolean).slice(0, MAX_ARTICLES)

  return articles
}

async function loadLatestSnapshot() {
  const doc = await NewsCache.findOne().sort({ fetchedAt: -1 }).lean()
  return doc ? toFeedDto(doc) : null
}

async function fetchAndStore(hourKey) {
  let articles
  try {
    articles = await fetchFromGnews()
  } catch (err) {
    // Missing API key is config - do not mask with a stale snapshot.
    if (err?.status === 503) throw err

    const fallback = await loadLatestSnapshot()
    if (fallback) return fallback
    if (err?.expose) throw err
    throw httpError(502, "Unable to load news right now")
  }

  const fetchedAt = new Date()

  try {
    const doc = await NewsCache.findOneAndUpdate(
      { hourKey },
      { hourKey, provider: "gnews", fetchedAt, articles },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
    return toFeedDto(doc)
  } catch (err) {
    // Race: another request inserted the same hourKey.
    if (err?.code === 11000) {
      const existing = await NewsCache.findOne({ hourKey })
      if (existing) return toFeedDto(existing)
    }
    throw err
  }
}

/**
 * Return top headlines for the current UTC hour, caching in MongoDB.
 * Concurrent misses share one in-flight GNews request.
 */
export async function getNewsForCurrentHour() {
  const hourKey = getHourKey()
  const cached = await NewsCache.findOne({ hourKey })
  if (cached) return toFeedDto(cached)

  const existing = inFlight.get(hourKey)
  if (existing) return existing

  const promise = fetchAndStore(hourKey).finally(() => {
    inFlight.delete(hourKey)
  })
  inFlight.set(hourKey, promise)
  return promise
}

/** Test helper: clear in-flight fetch map. */
export function resetNewsInFlight() {
  inFlight.clear()
}
