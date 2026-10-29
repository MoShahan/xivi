import mongoose from "mongoose"

import User from "../models/User.js"

import { getHiddenUserIds } from "./blocks.js"
import { formatFriend, toFriendId } from "./friends.js"
import { DEFAULT_AVATAR_COLOR } from "./profileColors.js"
import { getRelationshipsMap } from "./relationships.js"

const EMPTY_REL = {
  isFriend: false,
  isFollowing: false,
  outgoingRequestId: null,
  incomingRequestId: null,
  blockedByMe: false,
}

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 30

const CARD_SELECT = "_id firstName lastName occupation location picturePath avatarColor isActive"

/**
 * Parse people-list pagination: `?limit=` (default 20, max 30) + optional `cursor` (last `_id`).
 * @param {Record<string, unknown>} query
 */
export function parsePeoplePagination(query = {}) {
  const rawLimit = Number.parseInt(String(query.limit ?? String(DEFAULT_LIMIT)), 10)
  const limit = Math.min(MAX_LIMIT, Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : DEFAULT_LIMIT)

  const cursor = typeof query.cursor === "string" ? query.cursor.trim() : ""
  let cursorId = null
  if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
    cursorId = String(cursor)
  }

  return { limit, cursorId }
}

/**
 * Page through a stored id array using cursor = last returned user `_id`.
 * @param {unknown[]} ids
 * @param {{ limit: number, cursorId: string | null }} pagination
 */
export function pageIdList(ids, pagination) {
  const unique = [...new Set((ids || []).map(toFriendId).filter(Boolean))]
  const total = unique.length
  const { limit, cursorId } = pagination

  let start = 0
  if (cursorId) {
    const idx = unique.indexOf(cursorId)
    start = idx >= 0 ? idx + 1 : 0
  }

  const slice = unique.slice(start, start + limit)
  const hasMore = start + limit < total
  const nextCursor = hasMore && slice.length ? slice[slice.length - 1] : null

  return { ids: slice, nextCursor, hasMore, total }
}

/**
 * Resolve user ids to public cards + viewer relationship flags.
 * Skips missing / inactive users (does not renumber totals from the id list).
 * @param {string[]} ids
 * @param {string} viewerId
 */
export async function resolvePeopleCards(ids, viewerId) {
  const unique = [...new Set((ids || []).map(String).filter(Boolean))]
  if (!unique.length) return []

  const users = await User.find({
    _id: { $in: unique },
    isActive: { $ne: false },
  })
    .select(CARD_SELECT)
    .lean()

  const byId = new Map(users.map(u => [String(u._id), u]))
  const ordered = unique.map(id => byId.get(id)).filter(Boolean)
  const relMap = await getRelationshipsMap(
    viewerId,
    ordered.map(u => String(u._id))
  )

  return ordered.map(u => {
    const id = String(u._id)
    const card = formatFriend(u) || {
      _id: id,
      firstName: u.firstName,
      lastName: u.lastName,
      occupation: u.occupation || "",
      location: u.location || "",
      picturePath: u.picturePath || "",
      avatarColor: u.avatarColor || DEFAULT_AVATAR_COLOR,
    }
    const rel = relMap[id] || { ...EMPTY_REL }
    return { ...card, relationship: rel }
  })
}

/**
 * Paginate people who follow `targetId` (reverse of `following`).
 * @param {string} targetId
 * @param {{ limit: number, cursorId: string | null }} pagination
 * @param {string} viewerId
 * @param {{ skipIncoming?: boolean }} [options]
 */
export async function listFollowersPage(targetId, pagination, viewerId, options = {}) {
  const { limit, cursorId } = pagination
  const hidden = await getHiddenUserIds(viewerId, { skipIncoming: options.skipIncoming === true })
  const baseFilter = { following: targetId, isActive: { $ne: false } }
  if (hidden.length) {
    baseFilter._id = { $nin: hidden }
  }

  const filter = { ...baseFilter }
  if (cursorId) {
    filter._id = { ...(filter._id || {}), $gt: cursorId }
  }

  const [docs, total] = await Promise.all([
    User.find(filter)
      .select(CARD_SELECT)
      .sort({ _id: 1 })
      .limit(limit + 1)
      .lean(),
    User.countDocuments(baseFilter),
  ])

  const hasMore = docs.length > limit
  const pageDocs = hasMore ? docs.slice(0, limit) : docs
  const nextCursor = hasMore && pageDocs.length ? String(pageDocs[pageDocs.length - 1]._id) : null

  const relMap = await getRelationshipsMap(
    viewerId,
    pageDocs.map(u => String(u._id))
  )

  const users = pageDocs.map(u => {
    const id = String(u._id)
    const card = formatFriend(u)
    const rel = relMap[id] || { ...EMPTY_REL }
    return { ...card, relationship: rel }
  })

  return { users, nextCursor, hasMore, total }
}

/**
 * Counts for profile DTOs.
 * @param {{ _id: unknown, friends?: unknown[], following?: unknown[] }} userDoc
 */
export async function relationshipCounts(userDoc) {
  const friendCount = (userDoc.friends || []).length
  const followingCount = (userDoc.following || []).length
  const followerCount = await User.countDocuments({
    following: userDoc._id,
    isActive: { $ne: false },
  })
  return { friendCount, followingCount, followerCount }
}
