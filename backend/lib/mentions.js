import User from "../models/User.js"

import { httpError, isBlockedEitherWay } from "./blocks.js"
import { isValidObjectId } from "./objectId.js"

export const MENTIONS_MAX = 10

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
export function parseMentionedUserIds(raw) {
  let value = raw
  if (value == null || value === "") return []

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return []
    try {
      value = JSON.parse(trimmed)
    } catch {
      throw httpError(400, "mentionedUserIds must be a JSON array")
    }
  }

  if (!Array.isArray(value)) {
    throw httpError(400, "mentionedUserIds must be an array")
  }

  const ids = []
  const seen = new Set()
  for (const item of value) {
    const id = String(item ?? "").trim()
    if (!id) continue
    if (!isValidObjectId(id)) {
      throw httpError(400, "Invalid mentioned user id")
    }
    if (seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }

  if (ids.length > MENTIONS_MAX) {
    throw httpError(400, `You can mention at most ${MENTIONS_MAX} people`)
  }

  return ids
}

/**
 * @param {{ firstName?: string, lastName?: string }} user
 * @returns {string}
 */
export function mentionDisplayName(user) {
  return `${user?.firstName || ""} ${user?.lastName || ""}`.trim()
}

/**
 * True when `@First Last` appears as a token in text (not a substring of a longer @token).
 * @param {string} text
 * @param {string} display
 */
export function textContainsMention(text, display) {
  if (!text || !display) return false
  const needle = `@${display}`
  let from = 0
  while (from <= text.length) {
    const idx = text.indexOf(needle, from)
    if (idx === -1) return false
    const end = idx + needle.length
    const next = text[end]
    // Allow end-of-string or a non-letter/digit continuation (punctuation, space, newline).
    if (next == null || !/[\p{L}\p{N}_]/u.test(next)) {
      return true
    }
    from = idx + 1
  }
  return false
}

/**
 * Validate client mention ids against text and return sanitized mention docs.
 * @param {{ text: string, mentionedUserIds: unknown, actorId: string }} opts
 * @returns {Promise<{ userId: string, display: string }[]>}
 */
export async function resolveMentions({ text, mentionedUserIds, actorId }) {
  const ids = parseMentionedUserIds(mentionedUserIds)
  if (ids.length === 0) return []

  const body = typeof text === "string" ? text : ""
  const users = await User.find({ _id: { $in: ids } })
    .select("_id firstName lastName isActive")
    .lean()
  const byId = Object.fromEntries(users.map(u => [String(u._id), u]))

  const mentions = []
  for (const id of ids) {
    const user = byId[id]
    if (!user) {
      throw httpError(400, "One or more mentioned users were not found")
    }
    if (user.isActive === false) {
      throw httpError(400, "Cannot mention an inactive user")
    }
    if (String(actorId) !== id && (await isBlockedEitherWay(actorId, id))) {
      throw httpError(400, "Cannot mention a blocked user")
    }

    const display = mentionDisplayName(user)
    if (!display) {
      throw httpError(400, "Cannot mention a user without a name")
    }
    if (!textContainsMention(body, display)) {
      throw httpError(400, `Mention of @${display} must appear in the text`)
    }

    mentions.push({ userId: id, display })
  }

  return mentions
}

/**
 * @param {{ userId?: string }[] | null | undefined} mentions
 * @returns {string[]}
 */
export function mentionUserIds(mentions) {
  if (!Array.isArray(mentions)) return []
  return [...new Set(mentions.map(m => String(m?.userId || "")).filter(Boolean))]
}

/**
 * Ids present in `next` but not in `prev`.
 * @param {{ userId?: string }[] | null | undefined} prev
 * @param {{ userId?: string }[] | null | undefined} next
 */
export function newlyMentionedUserIds(prev, next) {
  const before = new Set(mentionUserIds(prev))
  return mentionUserIds(next).filter(id => !before.has(id))
}
