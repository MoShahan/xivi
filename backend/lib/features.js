import SiteSettings from "../models/SiteSettings.js"

/** Catalog keys (camelCase) - keep in sync with frontend `featureCatalog.ts`. */
export const FEATURE_KEYS = [
  "postsCreate",
  "postsImages",
  "postsEmoji",
  "postsEdit",
  "postsDelete",
  "commentsCreate",
  "commentsEdit",
  "commentsDelete",
  "likesPosts",
  "likesComments",
  "share",
  "notifications",
  "profileEdit",
  "profileAvatar",
  "postsSave",
  "friendRequests",
  "follow",
  "messaging",
] 

export const FEATURE_DISABLED_ERROR = "This feature is currently disabled"

export const DEFAULT_FEATURES = Object.fromEntries(FEATURE_KEYS.map(k => [k, true]))

const GLOBAL_ID = "global"
const CACHE_TTL_MS = 30_000

let cache = { at: 0, features: null, updatedAt: null, updatedBy: null }

export function invalidateFeaturesCache() {
  cache = { at: 0, features: null, updatedAt: null, updatedBy: null }
}

export function featureDisabledError() {
  const err = new Error(FEATURE_DISABLED_ERROR)
  err.status = 403
  err.expose = true
  return err
}

/** Merge unknown keys rejected; only known booleans applied. */
export function mergeFeatures(current, partial) {
  const next = { ...DEFAULT_FEATURES, ...current }
  if (!partial || typeof partial !== "object") {
    return next
  }
  const unknown = Object.keys(partial).filter(k => !FEATURE_KEYS.includes(k))
  if (unknown.length) {
    const err = new Error(`Unknown feature key(s): ${unknown.join(", ")}`)
    err.status = 400
    err.expose = true
    throw err
  }
  for (const key of FEATURE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(partial, key)) {
      if (typeof partial[key] !== "boolean") {
        const err = new Error(`Feature "${key}" must be a boolean`)
        err.status = 400
        err.expose = true
        throw err
      }
      next[key] = partial[key]
    }
  }
  return next
}

/**
 * Lazy-load (or create) global site features. Cached ~30s in-process.
 * @returns {Promise<{ features: Record<string, boolean>, updatedAt: Date|null, updatedBy: string|null }>}
 */
export async function getSiteSettingsDoc() {
  if (cache.features && Date.now() - cache.at < CACHE_TTL_MS) {
    return {
      features: { ...cache.features },
      updatedAt: cache.updatedAt,
      updatedBy: cache.updatedBy,
    }
  }

  let doc = await SiteSettings.findById(GLOBAL_ID)
  if (!doc) {
    doc = await SiteSettings.create({
      _id: GLOBAL_ID,
      features: { ...DEFAULT_FEATURES },
    })
  }

  const features = mergeFeatures({}, doc.features?.toObject?.() || doc.features || {})
  cache = {
    at: Date.now(),
    features,
    updatedAt: doc.updatedAt || null,
    updatedBy: doc.updatedBy ? String(doc.updatedBy) : null,
  }
  return {
    features: { ...features },
    updatedAt: cache.updatedAt,
    updatedBy: cache.updatedBy,
  }
}

export async function patchSiteFeatures(partial, adminUserId) {
  const current = await getSiteSettingsDoc()
  const features = mergeFeatures(current.features, partial)

  const doc = await SiteSettings.findByIdAndUpdate(
    GLOBAL_ID,
    {
      $set: {
        features,
        updatedBy: adminUserId,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )

  invalidateFeaturesCache()
  const featuresOut = mergeFeatures({}, doc.features?.toObject?.() || doc.features || {})
  cache = {
    at: Date.now(),
    features: featuresOut,
    updatedAt: doc.updatedAt || null,
    updatedBy: doc.updatedBy ? String(doc.updatedBy) : null,
  }
  return {
    features: { ...featuresOut },
    updatedAt: cache.updatedAt,
    updatedBy: cache.updatedBy,
  }
}

/** True if admin or flag is on. */
export async function isFeatureEnabled(req, key) {
  if (!FEATURE_KEYS.includes(key)) {
    throw new Error(`Unknown feature key: ${key}`)
  }
  if (req.user?.role === "admin") return true
  const { features } = await getSiteSettingsDoc()
  return Boolean(features[key])
}

/** Admins bypass; others 403 if flag is false. */
export async function assertFeatureEnabled(req, key) {
  if (!(await isFeatureEnabled(req, key))) {
    throw featureDisabledError()
  }
}

/** Express middleware factory. */
export function requireFeature(key) {
  return async (req, res, next) => {
    try {
      await assertFeatureEnabled(req, key)
      next()
    } catch (e) {
      if (e.status === 403 && e.expose) {
        return res.status(403).json({ error: e.message })
      }
      if (e.status === 400 && e.expose) {
        return res.status(400).json({ error: e.message })
      }
      next(e)
    }
  }
}
