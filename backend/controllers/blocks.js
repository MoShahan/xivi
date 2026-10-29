import { isBlockedByMe, parseBlockReason, severRelationship } from "../lib/blocks.js"
import { formatFriend } from "../lib/friends.js"
import { parsePeoplePagination } from "../lib/peopleLists.js"
import { DEFAULT_AVATAR_COLOR } from "../lib/profileColors.js"
import Block from "../models/Block.js"
import User from "../models/User.js"

function formatBlock(doc) {
  return {
    _id: String(doc._id),
    blocker: String(doc.blocker),
    blocked: String(doc.blocked),
    reason: doc.reason,
    customReason: doc.customReason || "",
    createdAt: doc.createdAt,
  }
}

function unknownCard(id) {
  return {
    _id: String(id),
    firstName: "Unknown",
    lastName: "user",
    occupation: "",
    location: "",
    picturePath: "",
    avatarColor: DEFAULT_AVATAR_COLOR,
  }
}

/** POST /users/:id/block */
export const blockUser = async (req, res, next) => {
  try {
    const authUserId = req.user?.id
    if (!authUserId) return res.status(401).json({ error: "Unauthenticated" })

    const { id: targetId } = req.params
    if (String(authUserId) === String(targetId)) {
      return res.status(400).json({ error: "Cannot block yourself" })
    }

    const target = await User.findById(targetId)
    if (!target || target.isActive === false) {
      return res.status(404).json({ error: "User not found" })
    }

    if (await isBlockedByMe(authUserId, targetId)) {
      return res.status(409).json({ error: "Already blocked" })
    }

    const { reason, customReason } = parseBlockReason(req.body)
    const created = await Block.create({
      blocker: authUserId,
      blocked: targetId,
      reason,
      customReason,
    })

    await severRelationship(authUserId, targetId)

    res.status(201).json({
      block: formatBlock(created),
      blockedUser: formatFriend(target),
    })
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(409).json({ error: "Already blocked" })
    }
    next(e)
  }
}

/** DELETE /users/:id/block */
export const unblockUser = async (req, res, next) => {
  try {
    const authUserId = req.user?.id
    if (!authUserId) return res.status(401).json({ error: "Unauthenticated" })

    const { id: targetId } = req.params
    if (String(authUserId) === String(targetId)) {
      return res.status(400).json({ error: "Cannot unblock yourself" })
    }

    const deleted = await Block.findOneAndDelete({ blocker: authUserId, blocked: targetId })
    if (!deleted) {
      return res.status(404).json({ error: "Block not found" })
    }

    res.status(200).json({ message: "User unblocked" })
  } catch (e) {
    next(e)
  }
}

/** GET /users/me/blocks?limit=&cursor= */
export const listMyBlocks = async (req, res, next) => {
  try {
    const authUserId = req.user?.id
    if (!authUserId) return res.status(401).json({ error: "Unauthenticated" })

    const { limit, cursorId } = parsePeoplePagination(req.query)
    const filter = { blocker: authUserId }

    if (cursorId) {
      const cursorDoc = await Block.findOne({ blocker: authUserId, blocked: cursorId }).select("createdAt _id")
      if (cursorDoc) {
        filter.$or = [
          { createdAt: { $lt: cursorDoc.createdAt } },
          { createdAt: cursorDoc.createdAt, _id: { $lt: cursorDoc._id } },
        ]
      }
    }

    const [docs, total] = await Promise.all([
      Block.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit + 1)
        .lean(),
      Block.countDocuments({ blocker: authUserId }),
    ])

    const hasMore = docs.length > limit
    const pageDocs = hasMore ? docs.slice(0, limit) : docs
    const userIds = pageDocs.map(d => String(d.blocked))
    const users = await User.find({ _id: { $in: userIds } })
      .select("_id firstName lastName occupation location picturePath avatarColor")
      .lean()
    const byId = new Map(users.map(u => [String(u._id), u]))

    const rows = pageDocs.map(d => {
      const id = String(d.blocked)
      const card = formatFriend(byId.get(id)) || unknownCard(id)
      return {
        ...card,
        reason: d.reason,
        customReason: d.customReason || "",
        blockedAt: d.createdAt,
      }
    })

    const nextCursor = hasMore && pageDocs.length ? String(pageDocs[pageDocs.length - 1].blocked) : null

    res.status(200).json({
      users: rows,
      nextCursor,
      hasMore,
      total,
    })
  } catch (e) {
    next(e)
  }
}
