/** Split plain text into safe text/link parts for display (no HTML storage). */

export type LinkifyTextPart = { type: "text"; value: string }
export type LinkifyLinkPart = { type: "link"; value: string; href: string }
export type LinkifyPart = LinkifyTextPart | LinkifyLinkPart

/** Matches http(s) URLs and www. hosts; path/query stop at whitespace or common closers. */
const URL_RE =
  /\b(?:https?:\/\/|www\.)[^\s<>"'`{}\|\^\[\]\\]+/gi

const TRAILING_PUNCT_RE = /[.,;:!?)\]'"]+$/

function stripTrailingPunctuation(raw: string): { url: string; trailing: string } {
  const match = raw.match(TRAILING_PUNCT_RE)
  if (!match) return { url: raw, trailing: "" }
  const trailing = match[0]
  return { url: raw.slice(0, -trailing.length), trailing }
}

/** Normalize and accept only http(s) hrefs. */
export function toSafeHttpHref(rawUrl: string): string | null {
  const trimmed = rawUrl.trim()
  if (!trimmed) return null

  const candidate = /^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed

  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
    return parsed.href
  } catch {
    return null
  }
}

function pushText(parts: LinkifyPart[], value: string): void {
  if (!value) return
  const last = parts[parts.length - 1]
  if (last?.type === "text") {
    last.value += value
    return
  }
  parts.push({ type: "text", value })
}

/**
 * Split `text` into text and link segments. Unsafe schemes stay as plain text.
 * Newlines and surrounding characters are preserved.
 */
export function linkifyText(text: string): LinkifyPart[] {
  if (!text) return []

  const parts: LinkifyPart[] = []
  let lastIndex = 0
  URL_RE.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = URL_RE.exec(text)) !== null) {
    const raw = match[0]
    const start = match.index

    if (start > lastIndex) {
      pushText(parts, text.slice(lastIndex, start))
    }

    const { url, trailing } = stripTrailingPunctuation(raw)
    const href = url ? toSafeHttpHref(url) : null

    if (href && url) {
      parts.push({ type: "link", value: url, href })
      if (trailing) pushText(parts, trailing)
    } else {
      pushText(parts, raw)
    }

    lastIndex = start + raw.length
  }

  if (lastIndex < text.length) {
    pushText(parts, text.slice(lastIndex))
  }

  return parts.length > 0 ? parts : [{ type: "text", value: text }]
}
