import Block from "../models/Block.js"
import FriendRequest from "../models/FriendRequest.js"
import User from "../models/User.js"

import { toFriendId } from "./friends.js"

/**
 * @param {import("mongoose").Types.ObjectId|string} viewerId
 * @param {import("mongoose").Types.ObjectId|string} targetId
 */
export async function getRelationship(viewerId, targetId) {
  const viewer = String(viewerId)
  const target = String(targetId)

  if (viewer === target) {
    return {
      isSelf: true,
      isFriend: false,
      isFollowing: false,
      outgoingRequestId: null,
      incomingRequestId: null,
      blockedByMe: false,
    }
  }

  const [me, outgoing, incoming, blockedRow] = await Promise.all([
    User.findById(viewer).select("friends following"),
    FriendRequest.findOne({ from: viewer, to: target, status: "pending" }).select("_id"),
    FriendRequest.findOne({ from: target, to: viewer, status: "pending" }).select("_id"),
    Block.exists({ blocker: viewer, blocked: target }),
  ])

  if (!me) {
    return {
      isSelf: false,
      isFriend: false,
      isFollowing: false,
      outgoingRequestId: null,
      incomingRequestId: null,
      blockedByMe: false,
    }
  }

  const isFriend = (me.friends || []).some(fid => toFriendId(fid) === target)
  const isFollowing = (me.following || []).some(fid => toFriendId(fid) === target)

  return {
    isSelf: false,
    isFriend,
    isFollowing,
    outgoingRequestId: outgoing ? String(outgoing._id) : null,
    incomingRequestId: incoming ? String(incoming._id) : null,
    blockedByMe: Boolean(blockedRow),
  }
}

/**
 * Batch relationship flags for discover rows.
 * @param {string} viewerId
 * @param {string[]} targetIds
 */
export async function getRelationshipsMap(viewerId, targetIds) {
  const ids = [...new Set(targetIds.map(String))].filter(id => id && id !== String(viewerId))
  /** @type {Record<string, { isFriend: boolean, isFollowing: boolean, outgoingRequestId: string|null, incomingRequestId: string|null, blockedByMe: boolean }>} */
  const map = {}
  for (const id of ids) {
    map[id] = {
      isFriend: false,
      isFollowing: false,
      outgoingRequestId: null,
      incomingRequestId: null,
      blockedByMe: false,
    }
  }
  if (ids.length === 0) return map

  const me = await User.findById(viewerId).select("friends following")
  if (!me) return map

  const friendSet = new Set((me.friends || []).map(toFriendId))
  const followingSet = new Set((me.following || []).map(toFriendId))
  for (const id of ids) {
    map[id].isFriend = friendSet.has(id)
    map[id].isFollowing = followingSet.has(id)
  }

  const [outgoing, incoming, blocks] = await Promise.all([
    FriendRequest.find({ from: viewerId, to: { $in: ids }, status: "pending" }).select("_id from to"),
    FriendRequest.find({ to: viewerId, from: { $in: ids }, status: "pending" }).select("_id from to"),
    Block.find({ blocker: viewerId, blocked: { $in: ids } }).select("blocked"),
  ])

  for (const req of outgoing) {
    const to = String(req.to)
    if (map[to]) map[to].outgoingRequestId = String(req._id)
  }
  for (const req of incoming) {
    const from = String(req.from)
    if (map[from]) map[from].incomingRequestId = String(req._id)
  }
  for (const row of blocks) {
    const blocked = String(row.blocked)
    if (map[blocked]) map[blocked].blockedByMe = true
  }

  return map
}
