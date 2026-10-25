import { graphemeLength, truncateGraphemes } from "@/lib/postLimits"

/** Client-side share helpers for the single-post page (`/post/[postId]`). No SDKs / API keys. */

const SHARE_TEXT_MAX = 120
const SHARE_TEXT_CUT = 117

export function getPostPagePath(postId: string): string {
  return `/post/${encodeURIComponent(postId)}`
}

/** Absolute URL to the single-post page (uses `window.location.origin` in the browser). */
export function getPostPageUrl(postId: string, origin?: string): string {
  const base =
    origin ?? (typeof window !== "undefined" ? window.location.origin : "")
  return `${base.replace(/\/+$/, "")}${getPostPagePath(postId)}`
}

/** Short share text from a post description, or a default line. */
export function buildShareText(description?: string): string {
  const trimmed = (description || "").trim().replace(/\s+/g, " ")
  if (!trimmed) return "Check out this post on Xivi"
  if (graphemeLength(trimmed) <= SHARE_TEXT_MAX) return trimmed
  return `${truncateGraphemes(trimmed, SHARE_TEXT_CUT)}…`
}

export type ShareIntentUrls = {
  pageUrl: string
  x: string
  facebook: string
  linkedin: string
  whatsapp: string
}

/** Build copy-link URL and network intent URLs for a post. */
export function buildShareUrls(
  postId: string,
  options?: { text?: string; origin?: string }
): ShareIntentUrls {
  const pageUrl = getPostPageUrl(postId, options?.origin)
  const text = options?.text ?? "Check out this post on Xivi"
  const encodedUrl = encodeURIComponent(pageUrl)
  const encodedText = encodeURIComponent(text)

  return {
    pageUrl,
    x: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    // api.whatsapp.com keeps UTF-8 emoji; wa.me/?text= often shows � on desktop WhatsApp.
    whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(`${text} ${pageUrl}`)}`,
  }
}

/** Open a share intent in a new tab with noopener/noreferrer. */
export function openShareWindow(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer")
}
