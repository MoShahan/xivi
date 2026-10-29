import { hiddenUserIdsForRequest } from "../lib/blocks.js"
import { assertFeatureEnabled, isFeatureEnabled } from "../lib/features.js"
import { pageFromDocs, parseCursorPagination } from "../lib/pagination.js"
import Notification from "../models/Notification.js"

const ACTOR_FIELDS = "firstName lastName picturePath avatarColor"

function formatNotification(doc) {
  const n = doc.toObject ? doc.toObject() : { ...doc }
  n._id = String(n._id)
  n.recipient = String(n.recipient)
  n.postId = n.postId ? String(n.postId) : null
  n.commentId = n.commentId || null
  if (n.actor && typeof n.actor === "object") {
    n.actor = {
      _id: String(n.actor._id),
      firstName: n.actor.firstName,
      lastName: n.actor.lastName,
      picturePath: n.actor.picturePath || "",
      avatarColor: n.actor.avatarColor || "#314F3B",
    }
  } else if (n.actor) {
    n.actor = { _id: String(n.actor) }
  }
  return n
}

export const listNotifications = async (req, res, next) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: "Unauthenticated" })

    if (!(await isFeatureEnabled(req, "notifications"))) {
      return res.status(200).json({ notifications: [], nextCursor: null, hasMore: false })
    }

    const { limit, cursorDate } = parseCursorPagination(req.query)
    const hidden = await hiddenUserIdsForRequest(req)
    const filter = {
      recipient: userId,
      ...(cursorDate ? { createdAt: { $lt: cursorDate } } : {}),
      ...(hidden.length ? { actor: { $nin: hidden } } : {}),
    }

    const docs = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .populate("actor", ACTOR_FIELDS)

    const { pageDocs, nextCursor, hasMore } = pageFromDocs(docs, limit)
    res.status(200).json({
      notifications: pageDocs.map(formatNotification),
      nextCursor,
      hasMore,
    })
  } catch (e) {
    next(e)
  }
}

export const unreadCount = async (req, res, next) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: "Unauthenticated" })

    if (!(await isFeatureEnabled(req, "notifications"))) {
      return res.status(200).json({ count: 0 })
    }

    const hidden = await hiddenUserIdsForRequest(req)
    const countFilter = { recipient: userId, read: false }
    if (hidden.length) countFilter.actor = { $nin: hidden }
    const count = await Notification.countDocuments(countFilter)
    res.status(200).json({ count })
  } catch (e) {
    next(e)
  }
}

export const markOneRead = async (req, res, next) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: "Unauthenticated" })

    await assertFeatureEnabled(req, "notifications")

    const { id } = req.params
    const updated = await Notification.findOneAndUpdate(
      { _id: id, recipient: userId },
      { $set: { read: true } },
      { new: true }
    ).populate("actor", ACTOR_FIELDS)

    if (!updated) return res.status(404).json({ error: "Notification not found" })
    res.status(200).json({ notification: formatNotification(updated) })
  } catch (e) {
    next(e)
  }
}

export const markAllRead = async (req, res, next) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: "Unauthenticated" })

    await assertFeatureEnabled(req, "notifications")

    await Notification.updateMany({ recipient: userId, read: false }, { $set: { read: true } })
    res.status(200).json({ ok: true })
  } catch (e) {
    next(e)
  }
}
