import rateLimit from "express-rate-limit"

const skipInTest = () => process.env.NODE_ENV === "test"

const base = {
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  // We key by authenticated user id when present; IP is only a fallback label.
  validate: { keyGeneratorIpFallback: false },
}

/**
 * Authenticated write / abuse-prone API limiter (keyed by user id when present).
 * Apply after `verifyAccessToken`.
 */
export const authWriteLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: { error: "Too many requests. Please try again later." },
  keyGenerator: req => {
    const uid = req.user?.id
    if (uid) return `user:${uid}`
    return `ip:${req.ip}`
  },
})

/** Stricter cap for create/upload-style endpoints. */
export const authCreateLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: { error: "Too many create attempts. Please try again later." },
  keyGenerator: req => {
    const uid = req.user?.id
    if (uid) return `create:${uid}`
    return `ip:${req.ip}`
  },
})

/**
 * Authenticated read/scrape limiter for heavy list GETs (feed, discover, messages, notifications).
 * Apply after `verifyAccessToken`. Generous enough for normal UX; blocks bulk scraping.
 */
export const authReadLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: "Too many requests. Please try again later." },
  keyGenerator: req => {
    const uid = req.user?.id
    if (uid) return `read:${uid}`
    return `ip:${req.ip}`
  },
})
