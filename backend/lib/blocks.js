import Block, { BLOCK_REASONS, CUSTOM_REASON_MAX } from "../models/Block.js"
import FriendRequest from "../models/FriendRequest.js"
import User from "../models/User.js"

export { BLOCK_REASONS, CUSTOM_REASON_MAX }

export const BLOCK_INTERACT_ERROR = "You cannot interact with this user"

/**
 * @param {number} status
 * @param {string} message
 */
export function httpError(status, message) {
  const err = new Error(message)
  err.status = status
  err.expose = true
  return err
}

/**
 * @param {unknown} body
 * @returns {{ reason: string, customReason: string }}
 */
export function parseBlockReason(body = {}) {
  const reason = typeof body.reason === "string" ? body.reason.trim() : ""
  if (!BLOCK_REASONS.includes(reason)) {
    throw httpError(400, "Choose a reason for this block")
  }

  let customReason = ""
  if (reason === "other") {
    customReason = typeof body.customReason === "string" ? body.customReason.trim() : ""
    if (!customReason) {
      throw httpError(400, "Please describe why you are blocking this person")
    }
    if (customReason.length > CUSTOM_REASON_MAX) {
      throw httpError(400, `Custom reason must be ${CUSTOM_REASON_MAX} characters or fewer`)
    }
  }

  return { reason, customReason }
}

/** Admins skip incoming blocks on reads so they can still moderate. */
export function skipIncomingBlocks(req) {
  return req?.user?.role === "admin"
}

/**
 * People this viewer must not see: those they blocked, plus (unless skipIncoming) those who blocked them.
 * @param {string} viewerId
 * @param {{ skipIncoming?: boolean }} [options]
 * @returns {Promise<string[]>}
 */
export async function getHiddenUserIds(viewerId, options = {}) {
  if (!viewerId) return []
  const skipIncoming = options.skipIncoming === true

  const outgoing = await Block.find({ blocker: viewerId }).select("blocked").lean()
  const iBlocked = outgoing.map(doc => String(doc.blocked))

  if (skipIncoming) {
    return [...new Set(iBlocked)]
  }

  const incoming = await Block.find({ blocked: viewerId }).select("blocker").lean()
  const blockedMe = incoming.map(doc => String(doc.blocker))
  return [...new Set([...iBlocked, ...blockedMe])]
}

/**
 * @param {import("express").Request} req
 * @returns {Promise<string[]>}
 */
export async function hiddenUserIdsForRequest(req) {
  const viewerId = req?.user?.id
  if (!viewerId) return []
  return getHiddenUserIds(viewerId, { skipIncoming: skipIncomingBlocks(req) })
}

/**
 * @param {string} blockerId
 * @param {string} blockedId
 */
export async function isBlockedByMe(blockerId, blockedId) {
  if (!blockerId || !blockedId || String(blockerId) === String(blockedId)) return false
  const row = await Block.exists({ blocker: blockerId, blocked: blockedId })
  return Boolean(row)
}

/**
 * @param {string} a
 * @param {string} b
 */
export async function isBlockedEitherWay(a, b) {
  if (!a || !b || String(a) === String(b)) return false
  const row = await Block.exists({
    $or: [
      { blocker: a, blocked: b },
      { blocker: b, blocked: a },
    ],
  })
  return Boolean(row)
}

/**
 * Reject writes between a blocked pair (both directions; no admin bypass).
 * @param {string} viewerId
 * @param {string} targetId
 */
export async function assertNotBlocked(viewerId, targetId) {
  if (await isBlockedEitherWay(viewerId, targetId)) {
    throw httpError(403, BLOCK_INTERACT_ERROR)
  }
}

/**
 * Hide a user from this viewer (outgoing always; incoming unless admin).
 * @param {string} viewerId
 * @param {string} targetId
 * @param {{ skipIncoming?: boolean }} [options]
 */
export async function isHiddenFromViewer(viewerId, targetId, options = {}) {
  if (!viewerId || !targetId || String(viewerId) === String(targetId)) return false
  if (await isBlockedByMe(viewerId, targetId)) return true
  if (options.skipIncoming) return false
  return isBlockedByMe(targetId, viewerId)
}

/**
 * 404 when the viewer must not see this user (posts, people lists).
 * @param {import("express").Request} req
 * @param {string} targetId
 * @param {string} [message]
 */
export async function assertVisibleUser(req, targetId, message = "User not found") {
  const viewerId = req?.user?.id
  if (!viewerId) return
  if (await isHiddenFromViewer(viewerId, targetId, { skipIncoming: skipIncomingBlocks(req) })) {
    throw httpError(404, message)
  }
}

/**
 * Unfriend, unfollow both ways, and cancel pending friend requests. No notifications.
 * @param {string} blockerId
 * @param {string} blockedId
 */
export async function severRelationship(blockerId, blockedId) {
  await Promise.all([
    User.updateOne({ _id: blockerId }, { $pull: { friends: blockedId, following: blockedId } }),
    User.updateOne({ _id: blockedId }, { $pull: { friends: blockerId, following: blockerId } }),
  ])

  await FriendRequest.updateMany(
    {
      status: "pending",
      $or: [
        { from: blockerId, to: blockedId },
        { from: blockedId, to: blockerId },
      ],
    },
    { $set: { status: "cancelled" } }
  )
}

/**
 * Apply author exclusion to a Mongo filter. `userId` on posts is a string.
 * @param {Record<string, unknown>} filter
 * @param {string[]} hiddenIds
 */
export function excludeHiddenAuthors(filter, hiddenIds) {
  const hidden = [...new Set((hiddenIds || []).map(String).filter(Boolean))]
  if (hidden.length === 0) return filter

  const current = filter.userId
  if (current && typeof current === "object" && Array.isArray(current.$in)) {
    const hide = new Set(hidden)
    filter.userId = { $in: current.$in.filter(id => !hide.has(String(id))) }
    return filter
  }

  filter.userId = { $nin: hidden }
  return filter
}
