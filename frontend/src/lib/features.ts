import type { FeatureFlagKey } from "@/lib/featureCatalog"
import type { UserRole } from "@/types/models"

export type FeaturesMap = Record<FeatureFlagKey, boolean>

export const ALL_FEATURE_KEYS: FeatureFlagKey[] = [
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

export const DEFAULT_FEATURES: FeaturesMap = Object.fromEntries(
  ALL_FEATURE_KEYS.map(k => [k, true])
) as FeaturesMap

/** Admins always bypass; others follow the site flag (default true). */
export function canUseFeature(
  role: UserRole | undefined,
  features: FeaturesMap | null | undefined,
  key: FeatureFlagKey
): boolean {
  if (role === "admin") return true
  if (!features) return true
  return features[key] !== false
}

export function mergeFeatures(partial?: Partial<FeaturesMap> | null): FeaturesMap {
  return { ...DEFAULT_FEATURES, ...(partial || {}) }
}
