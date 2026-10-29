const DEFAULT_LIMIT = 10
const MAX_LIMIT = 30

/**
 * Parse an optional ISO date query param. Invalid values are ignored.
 * @param {unknown} value
 * @returns {Date | null}
 */
function parseIsoDate(value) {
  const raw = typeof value === "string" ? value.trim() : ""
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Parse feed pagination query: `?limit=` + optional `cursor` / `since` (ISO dates).
 * If both `since` and `cursor` are present, `since` wins.
 * @param {Record<string, unknown>} query
 */
export function parseCursorPagination(query = {}) {
  const rawLimit = Number.parseInt(String(query.limit ?? String(DEFAULT_LIMIT)), 10)
  const limit = Math.min(MAX_LIMIT, Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : DEFAULT_LIMIT)

  const sinceDate = parseIsoDate(query.since)
  const cursorDate = sinceDate ? null : parseIsoDate(query.cursor)

  return { limit, cursorDate, sinceDate }
}

/**
 * `createdAt` bounds for newest-first lists.
 * `since` is newer-than (`$gt`); `cursor` is older-than (`$lt`).
 * @param {{ sinceDate?: Date | null, cursorDate?: Date | null }} bounds
 */
export function createdAtFilter({ sinceDate = null, cursorDate = null } = {}) {
  if (sinceDate) return { createdAt: { $gt: sinceDate } }
  if (cursorDate) return { createdAt: { $lt: cursorDate } }
  return {}
}

/**
 * @param {import("mongoose").Document[] | object[]} docs
 * @param {number} limit
 */
export function pageFromDocs(docs, limit) {
  const hasMore = docs.length > limit
  const pageDocs = hasMore ? docs.slice(0, limit) : docs
  const last = pageDocs[pageDocs.length - 1]
  const createdAt = last?.createdAt
  const nextCursor = hasMore && createdAt ? new Date(createdAt).toISOString() : null
  return { pageDocs, nextCursor, hasMore }
}
