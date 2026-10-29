import {
  assertNotBlocked,
  hiddenUserIdsForRequest,
  isHiddenFromViewer,
  skipIncomingBlocks,
} from "../lib/blocks.js"
import {
  formatConversation,
  formatMessage,
  friendIdSet,
  getLastReadAt,
  MESSAGE_TEXT_MAX,
  otherParticipantId,
  participantKey,
} from "../lib/conversations.js"
import { assertFeatureEnabled, isFeatureEnabled } from "../lib/features.js"
import { isValidObjectId } from "../lib/objectId.js"
import { pageFromDocs, parseCursorPagination } from "../lib/pagination.js"
import { emitToConversation, emitToParticipants } from "../lib/realtime.js"
import Conversation from "../models/Conversation.js"
import Message from "../models/Message.js"
import User from "../models/User.js"

const OTHER_USER_FIELDS = "firstName lastName picturePath avatarColor lastSeenAt isActive"

function parseBox(query) {
  const raw = typeof query?.box === "string" ? query.box.trim().toLowerCase() : "friends"
  return raw === "requests" ? "requests" : "friends"
}

function isParticipant(conversation, userId) {
  return (conversation.participants || []).some(id => String(id) === String(userId))
}

async function loadOtherUsers(conversations, viewerId) {
  const ids = [
    ...new Set(conversations.map(c => otherParticipantId(c, viewerId)).filter(Boolean)),
  ]
  if (!ids.length) return new Map()
  const users = await User.find({ _id: { $in: ids } }).select(OTHER_USER_FIELDS)
  return new Map(users.map(u => [String(u._id), u]))
}

async function hydrateConversation(conversation, viewerId, friendSet) {
  const otherId = otherParticipantId(conversation, viewerId)
  const other = await User.findById(otherId).select(OTHER_USER_FIELDS)
  const isFriend = friendSet ? friendSet.has(otherId) : false
  return formatConversation(conversation, viewerId, other, { isFriend })
}

async function getViewerFriendSet(viewerId) {
  const me = await User.findById(viewerId).select("friends")
  return friendIdSet(me)
}

function setLastRead(conversation, userId, at = new Date()) {
  if (!conversation.lastReadAt || typeof conversation.lastReadAt.set !== "function") {
    conversation.lastReadAt = new Map()
  }
  conversation.lastReadAt.set(String(userId), at)
  conversation.markModified("lastReadAt")
}

async function findOrCreateConversation(viewerId, recipientId) {
  const key = participantKey(viewerId, recipientId)
  let conversation = await Conversation.findOne({ participantKey: key })
  if (conversation) return { conversation, created: false }

  try {
    conversation = await Conversation.create({
      participants: [String(viewerId), String(recipientId)].sort(),
      participantKey: key,
      lastMessageAt: new Date(),
      lastMessageText: "",
      lastSenderId: null,
    })
    setLastRead(conversation, viewerId)
    await conversation.save()
    return { conversation, created: true }
  } catch (e) {
    if (e?.code === 11000) {
      conversation = await Conversation.findOne({ participantKey: key })
      if (conversation) return { conversation, created: false }
    }
    throw e
  }
}

async function saveMessage(conversation, senderId, text) {
  const now = new Date()
  const message = await Message.create({
    conversationId: conversation._id,
    senderId,
    text,
  })
  conversation.lastMessageAt = now
  conversation.lastMessageText = text
  conversation.lastSenderId = senderId
  setLastRead(conversation, senderId, now)
  await conversation.save()
  return message
}

function emitNewMessage(conversation, formattedConversation, formattedMessage) {
  const participantIds = (conversation.participants || []).map(id => String(id))
  const payload = { conversation: formattedConversation, message: formattedMessage }
  emitToConversation(String(conversation._id), "message", payload)
  emitToParticipants(participantIds, "message", payload)
}

function emitRead(conversation, userId, lastReadAt) {
  const participantIds = (conversation.participants || []).map(id => String(id))
  const payload = {
    conversationId: String(conversation._id),
    userId: String(userId),
    lastReadAt: lastReadAt ? new Date(lastReadAt).toISOString() : null,
  }
  emitToConversation(String(conversation._id), "read", payload)
  emitToParticipants(participantIds, "read", payload)
}

export const listConversations = async (req, res, next) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: "Unauthenticated" })

    if (!(await isFeatureEnabled(req, "messaging"))) {
      return res.status(200).json({ conversations: [], nextCursor: null, hasMore: false })
    }

    const box = parseBox(req.query)
    const friendSet = await getViewerFriendSet(userId)
    const friendIds = [...friendSet]
    const hiddenIds = await hiddenUserIdsForRequest(req)

    const { limit, cursorDate } = parseCursorPagination(req.query)
    const clauses = [{ participants: userId }]
    if (box === "friends") {
      if (!friendIds.length) {
        return res.status(200).json({ conversations: [], nextCursor: null, hasMore: false })
      }
      clauses.push({ participants: { $in: friendIds } })
    } else if (friendIds.length) {
      clauses.push({ participants: { $nin: friendIds } })
    }
    if (hiddenIds.length) {
      clauses.push({ participants: { $nin: hiddenIds } })
    }

    const filter = clauses.length === 1 ? clauses[0] : { $and: clauses }

    if (cursorDate) {
      filter.lastMessageAt = { $lt: cursorDate }
    }

    const docs = await Conversation.find(filter)
      .sort({ lastMessageAt: -1, _id: -1 })
      .limit(limit + 1)

    const { pageDocs, hasMore } = pageFromDocs(docs, limit)
    const last = pageDocs[pageDocs.length - 1]
    const nextCursor =
      hasMore && last?.lastMessageAt ? new Date(last.lastMessageAt).toISOString() : null

    const others = await loadOtherUsers(pageDocs, userId)
    const conversations = pageDocs.map(doc => {
      const otherId = otherParticipantId(doc, userId)
      const other = others.get(otherId)
      return formatConversation(doc, userId, other, { isFriend: friendSet.has(otherId) })
    })

    res.status(200).json({ conversations, nextCursor, hasMore })
  } catch (e) {
    next(e)
  }
}

export const unreadCount = async (req, res, next) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: "Unauthenticated" })

    if (!(await isFeatureEnabled(req, "messaging"))) {
      return res.status(200).json({ count: 0 })
    }

    const hiddenIds = await hiddenUserIdsForRequest(req)
    const countFilter = {
      participants: userId,
      lastSenderId: { $ne: userId },
      lastMessageText: { $nin: ["", null] },
      $expr: {
        $gt: ["$lastMessageAt", { $ifNull: [`$lastReadAt.${userId}`, new Date(0)] }],
      },
    }
    if (hiddenIds.length) {
      countFilter.$and = [{ participants: { $nin: hiddenIds } }]
    }

    const count = await Conversation.countDocuments(countFilter)

    res.status(200).json({ count })
  } catch (e) {
    next(e)
  }
}

export const createConversation = async (req, res, next) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: "Unauthenticated" })

    await assertFeatureEnabled(req, "messaging")

    const recipientId =
      typeof req.body?.recipientId === "string" ? req.body.recipientId.trim() : ""
    if (!isValidObjectId(recipientId)) {
      return res.status(400).json({ error: "Invalid recipientId" })
    }
    if (String(recipientId) === String(userId)) {
      return res.status(400).json({ error: "Cannot message yourself" })
    }

    await assertNotBlocked(userId, recipientId)

    const recipient = await User.findById(recipientId).select(OTHER_USER_FIELDS)
    if (!recipient || recipient.isActive === false) {
      return res.status(404).json({ error: "User not found" })
    }

    const text = typeof req.body?.text === "string" ? req.body.text.trim() : ""
    if (text && text.length > MESSAGE_TEXT_MAX) {
      return res.status(400).json({ error: "Message is too long" })
    }

    const { conversation, created } = await findOrCreateConversation(userId, recipientId)
    const friendSet = await getViewerFriendSet(userId)

    let message = null
    if (text) {
      message = await saveMessage(conversation, userId, text)
    }

    const formatted = await hydrateConversation(conversation, userId, friendSet)
    if (message) {
      const formattedMessage = formatMessage(message)
      emitNewMessage(conversation, formatted, formattedMessage)
      return res.status(created ? 201 : 200).json({
        conversation: formatted,
        message: formattedMessage,
      })
    }

    res.status(created ? 201 : 200).json({ conversation: formatted })
  } catch (e) {
    next(e)
  }
}

export const getConversation = async (req, res, next) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: "Unauthenticated" })

    if (!(await isFeatureEnabled(req, "messaging"))) {
      return res.status(404).json({ error: "Conversation not found" })
    }

    const conversation = await Conversation.findById(req.params.id)
    if (!conversation || !isParticipant(conversation, userId)) {
      return res.status(404).json({ error: "Conversation not found" })
    }
    const otherId = otherParticipantId(conversation, userId)
    if (await isHiddenFromViewer(userId, otherId, { skipIncoming: skipIncomingBlocks(req) })) {
      return res.status(404).json({ error: "Conversation not found" })
    }

    const friendSet = await getViewerFriendSet(userId)
    const formatted = await hydrateConversation(conversation, userId, friendSet)
    res.status(200).json({ conversation: formatted })
  } catch (e) {
    next(e)
  }
}

export const listMessages = async (req, res, next) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: "Unauthenticated" })

    if (!(await isFeatureEnabled(req, "messaging"))) {
      return res.status(404).json({ error: "Conversation not found" })
    }

    const conversation = await Conversation.findById(req.params.id)
    if (!conversation || !isParticipant(conversation, userId)) {
      return res.status(404).json({ error: "Conversation not found" })
    }
    const otherIdForThread = otherParticipantId(conversation, userId)
    if (
      await isHiddenFromViewer(userId, otherIdForThread, { skipIncoming: skipIncomingBlocks(req) })
    ) {
      return res.status(404).json({ error: "Conversation not found" })
    }

    const { limit, cursorDate } = parseCursorPagination(req.query)
    const filter = { conversationId: conversation._id }
    if (cursorDate) filter.createdAt = { $lt: cursorDate }

    const docs = await Message.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit + 1)

    const { pageDocs, nextCursor, hasMore } = pageFromDocs(docs, limit)
    res.status(200).json({
      messages: pageDocs.map(formatMessage),
      nextCursor,
      hasMore,
      lastReadAt: {
        mine: getLastReadAt(conversation, userId)?.toISOString() || null,
        other:
          getLastReadAt(conversation, otherParticipantId(conversation, userId))?.toISOString() ||
          null,
      },
    })
  } catch (e) {
    next(e)
  }
}

export const sendMessage = async (req, res, next) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: "Unauthenticated" })

    await assertFeatureEnabled(req, "messaging")

    const text = typeof req.body?.text === "string" ? req.body.text.trim() : ""
    if (!text) return res.status(400).json({ error: "Message text is required" })
    if (text.length > MESSAGE_TEXT_MAX) {
      return res.status(400).json({ error: "Message is too long" })
    }

    const conversation = await Conversation.findById(req.params.id)
    if (!conversation || !isParticipant(conversation, userId)) {
      return res.status(404).json({ error: "Conversation not found" })
    }

    const otherId = otherParticipantId(conversation, userId)
    await assertNotBlocked(userId, otherId)
    const other = await User.findById(otherId).select("isActive")
    if (!other || other.isActive === false) {
      return res.status(404).json({ error: "User not found" })
    }

    const message = await saveMessage(conversation, userId, text)
    const friendSet = await getViewerFriendSet(userId)
    const formatted = await hydrateConversation(conversation, userId, friendSet)
    const formattedMessage = formatMessage(message)
    emitNewMessage(conversation, formatted, formattedMessage)

    res.status(201).json({ conversation: formatted, message: formattedMessage })
  } catch (e) {
    next(e)
  }
}

export const markRead = async (req, res, next) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: "Unauthenticated" })

    await assertFeatureEnabled(req, "messaging")

    const conversation = await Conversation.findById(req.params.id)
    if (!conversation || !isParticipant(conversation, userId)) {
      return res.status(404).json({ error: "Conversation not found" })
    }
    const otherId = otherParticipantId(conversation, userId)
    if (await isHiddenFromViewer(userId, otherId, { skipIncoming: skipIncomingBlocks(req) })) {
      return res.status(404).json({ error: "Conversation not found" })
    }

    const now = new Date()
    setLastRead(conversation, userId, now)
    await conversation.save()

    emitRead(conversation, userId, now)
    const friendSet = await getViewerFriendSet(userId)
    const formatted = await hydrateConversation(conversation, userId, friendSet)
    res.status(200).json({ conversation: formatted })
  } catch (e) {
    next(e)
  }
}
