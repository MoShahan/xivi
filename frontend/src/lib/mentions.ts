import { type LinkifyPart, linkifyText } from "@/lib/linkify"

export const MENTIONS_MAX = 10

export type MentionRef = {
  userId: string
  display: string
}

export type MentionSuggestUser = {
  _id: string
  firstName: string
  lastName: string
  picturePath?: string
  avatarColor?: string
}

export type RichTextPart =
  | { type: "text"; value: string }
  | { type: "link"; value: string; href: string }
  | { type: "mention"; value: string; userId: string }

export function mentionDisplayOf(user: { firstName?: string; lastName?: string }): string {
  return `${user.firstName || ""} ${user.lastName || ""}`.trim()
}

/** Active `@query` just before `cursor` (query has no spaces after `@` for suggest, or partial name). */
export function getActiveMentionQuery(text: string, cursor: number): { start: number; query: string } | null {
  if (cursor < 0 || cursor > text.length) return null
  const before = text.slice(0, cursor)
  const at = before.lastIndexOf("@")
  if (at === -1) return null
  if (at > 0) {
    const prev = before[at - 1]
    if (prev && !/\s/.test(prev)) return null
  }
  const query = before.slice(at + 1)
  // Abort if newline or another @ inside the token; allow spaces for "First Last" typing.
  if (query.includes("\n") || query.includes("@")) return null
  if (query.length > 60) return null
  return { start: at, query }
}

/**
 * Keep only mention ids whose `@display` still appears in text.
 * Prefer `known` display map when available.
 */
export function pruneMentionedUserIds(text: string, mentionedUserIds: string[], known: MentionRef[] = []): string[] {
  const displayById = new Map(known.map(m => [m.userId, m.display]))
  return mentionedUserIds.filter(id => {
    const display = displayById.get(id)
    if (!display) return true
    return textContainsMention(text, display)
  })
}

export function textContainsMention(text: string, display: string): boolean {
  if (!text || !display) return false
  const needle = `@${display}`
  let from = 0
  while (from <= text.length) {
    const idx = text.indexOf(needle, from)
    if (idx === -1) return false
    const end = idx + needle.length
    const next = text[end]
    if (next == null || !/[\p{L}\p{N}_]/u.test(next)) return true
    from = idx + 1
  }
  return false
}

type MentionSpan = { start: number; end: number; userId: string; value: string }

function collectMentionSpans(text: string, mentions: MentionRef[]): MentionSpan[] {
  if (!text || !mentions?.length) return []

  // Longest display first so `@Anna` wins over `@Ann` when both exist.
  const unique = new Map<string, string>()
  for (const m of mentions) {
    const display = (m.display || "").trim()
    const userId = String(m.userId || "")
    if (!display || !userId) continue
    unique.set(display, userId)
  }
  const displays = [...unique.keys()].sort((a, b) => b.length - a.length)
  const occupied: boolean[] = Array.from({ length: text.length }, () => false)
  const spans: MentionSpan[] = []

  for (const display of displays) {
    const userId = unique.get(display)!
    const needle = `@${display}`
    let from = 0
    while (from <= text.length) {
      const idx = text.indexOf(needle, from)
      if (idx === -1) break
      const end = idx + needle.length
      const next = text[end]
      const boundaryOk = next == null || !/[\p{L}\p{N}_]/u.test(next)
      const free = boundaryOk && !occupied.slice(idx, end).some(Boolean)
      if (free) {
        for (let i = idx; i < end; i++) occupied[i] = true
        spans.push({ start: idx, end, userId, value: needle })
      }
      from = idx + 1
    }
  }

  return spans.sort((a, b) => a.start - b.start)
}

function linkifyToRich(parts: LinkifyPart[]): RichTextPart[] {
  return parts.map(part =>
    part.type === "link"
      ? { type: "link" as const, value: part.value, href: part.href }
      : { type: "text" as const, value: part.value }
  )
}

/** Split plain text into text / URL / mention parts for safe React rendering. */
export function splitRichText(text: string, mentions: MentionRef[] = []): RichTextPart[] {
  if (!text) return []
  const spans = collectMentionSpans(text, mentions)
  if (spans.length === 0) return linkifyToRich(linkifyText(text))

  const out: RichTextPart[] = []
  let cursor = 0
  for (const span of spans) {
    if (span.start > cursor) {
      out.push(...linkifyToRich(linkifyText(text.slice(cursor, span.start))))
    }
    out.push({ type: "mention", value: span.value, userId: span.userId })
    cursor = span.end
  }
  if (cursor < text.length) {
    out.push(...linkifyToRich(linkifyText(text.slice(cursor))))
  }
  return out.length > 0 ? out : [{ type: "text", value: text }]
}
