import { toFriendId } from "./friends.js"
import { DEFAULT_AVATAR_COLOR } from "./profileColors.js"
import { isUserOnline } from "./realtime.js"

export const MESSAGE_TEXT_MAX = 2000

/** Stable unique key for a 1:1 pair. */
export function participantKey(idA, idB) {
  return [String(idA), String(idB)].sort().join(":")
}

export function otherParticipantId(conversation, viewerId) {
  const viewer = String(viewerId)
  return (conversation.participants || []).map(id => String(id)).find(id => id !== viewer) || ""
}

export function lastReadMapToObject(lastReadAt) {
  if (!lastReadAt) return {}
  if (lastReadAt instanceof Map) {
    return Object.fromEntries(
      [...lastReadAt.entries()].map(([key, value]) => [String(key), value])
    )
  }
  if (typeof lastReadAt === "object") {
    const out = {}
    for (const [key, value] of Object.entries(lastReadAt)) {
      out[String(key)] = value
    }
    return out
  }
  return {}
}

export function getLastReadAt(conversation, userId) {
  const map = lastReadMapToObject(conversation.lastReadAt)
  const value = map[String(userId)]
  return value ? new Date(value) : null
}

export function isUnreadFor(conversation, viewerId) {
  const viewer = String(viewerId)
  if (!conversation.lastMessageAt || !conversation.lastMessageText) return false
  if (conversation.lastSenderId && String(conversation.lastSenderId) === viewer) return false
  const lastRead = getLastReadAt(conversation, viewer)
  if (!lastRead) return true
  return new Date(conversation.lastMessageAt).getTime() > lastRead.getTime()
}

export function formatMessage(doc) {
  const m = doc.toObject ? doc.toObject() : { ...doc }
  return {
    _id: String(m._id),
    conversationId: String(m.conversationId),
    senderId: String(m.senderId),
    text: m.text || "",
    createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : null,
  }
}

export function formatOtherUser(user, { online } = {}) {
  if (!user) return null
  const lastSeenAt = user.lastSeenAt ? new Date(user.lastSeenAt).toISOString() : null
  const isOnline = online != null ? Boolean(online) : isUserOnline(user._id)
  return {
    _id: String(user._id),
    firstName: user.firstName,
    lastName: user.lastName,
    picturePath: user.picturePath || "",
    avatarColor: user.avatarColor || DEFAULT_AVATAR_COLOR,
    online: isOnline,
    lastSeenAt,
  }
}

/**
 * @param {object} conversation
 * @param {string} viewerId
 * @param {object} otherUser
 * @param {{ isFriend?: boolean }} [opts]
 */
export function formatConversation(conversation, viewerId, otherUser, opts = {}) {
  const c = conversation.toObject ? conversation.toObject() : { ...conversation }
  const viewer = String(viewerId)
  const otherId = otherUser?._id ? String(otherUser._id) : otherParticipantId(c, viewer)
  const lastRead = lastReadMapToObject(c.lastReadAt)
  const mine = lastRead[viewer] ? new Date(lastRead[viewer]).toISOString() : null
  const other = lastRead[otherId] ? new Date(lastRead[otherId]).toISOString() : null
  const isFriend = Boolean(opts.isFriend)

  return {
    _id: String(c._id),
    box: isFriend ? "friends" : "requests",
    otherUser: formatOtherUser(otherUser),
    lastMessageText: c.lastMessageText || "",
    lastMessageAt: c.lastMessageAt ? new Date(c.lastMessageAt).toISOString() : null,
    lastSenderId: c.lastSenderId ? String(c.lastSenderId) : null,
    lastReadAt: { mine, other },
    unread: isUnreadFor(c, viewer),
    createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : null,
  }
}

export function friendIdSet(user) {
  return new Set((user?.friends || []).map(toFriendId).filter(Boolean))
}
