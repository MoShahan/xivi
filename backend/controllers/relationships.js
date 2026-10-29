import { assertNotBlocked, hiddenUserIdsForRequest, isBlockedByMe } from "../lib/blocks.js"
import { assertFeatureEnabled } from "../lib/features.js"
import { formatFriendsList, toFriendId } from "../lib/friends.js"
import { createNotification } from "../lib/notifications.js"
import { pageIdList, parsePeoplePagination, resolvePeopleCards } from "../lib/peopleLists.js"
import { DEFAULT_AVATAR_COLOR } from "../lib/profileColors.js"
import { getRelationship, getRelationshipsMap } from "../lib/relationships.js"
import FriendRequest from "../models/FriendRequest.js"
import User from "../models/User.js"

const ACTOR_SELECT = "_id firstName lastName picturePath avatarColor"

function formatActor(u) {
  if (!u) return null
  return {
    _id: String(u._id),
    firstName: u.firstName,
    lastName: u.lastName,
    picturePath: u.picturePath || "",
    avatarColor: u.avatarColor || DEFAULT_AVATAR_COLOR,
  }
}

function formatRequest(doc, otherUser) {
  return {
    _id: String(doc._id),
    from: String(doc.from),
    to: String(doc.to),
    status: doc.status,
    createdAt: doc.createdAt,
    user: formatActor(otherUser),
  }
}

/** GET /users/:id/relationship */
export const getUserRelationship = async (req, res, next) => {
  try {
    const authUserId = req.user?.id
    if (!authUserId) return res.status(401).json({ error: "Unauthenticated" })

    const { id } = req.params
    const target = await User.findById(id).select("_id")
    if (!target) return res.status(404).json({ msg: "User not found" })

    const theyBlockedMe = await isBlockedByMe(id, authUserId)
    if (theyBlockedMe && req.user?.role !== "admin") {
      return res.status(404).json({ error: "User not found" })
    }

    const relationship = await getRelationship(authUserId, id)
    res.status(200).json({ relationship })
  } catch (e) {
    next(e)
  }
}

/** POST /users/:id/friend-requests - send request */
export const sendFriendRequest = async (req, res, next) => {
  try {
    const authUserId = req.user?.id
    if (!authUserId) return res.status(401).json({ error: "Unauthenticated" })

    await assertFeatureEnabled(req, "friendRequests")

    const { id: toId } = req.params
    if (String(authUserId) === String(toId)) {
      return res.status(400).json({ error: "Cannot send a friend request to yourself" })
    }

    const [me, them] = await Promise.all([User.findById(authUserId), User.findById(toId)])
    if (!me || !them || them.isActive === false) {
      return res.status(404).json({ error: "User not found" })
    }

    await assertNotBlocked(authUserId, toId)

    if ((me.friends || []).some(fid => toFriendId(fid) === String(toId))) {
      return res.status(409).json({ error: "Already friends" })
    }

    const incoming = await FriendRequest.findOne({
      from: toId,
      to: authUserId,
      status: "pending",
    })
    if (incoming) {
      return res.status(409).json({
        error: "They already sent you a friend request - accept it instead",
        incomingRequestId: String(incoming._id),
      })
    }

    const existing = await FriendRequest.findOne({
      from: authUserId,
      to: toId,
      status: "pending",
    })
    if (existing) {
      return res.status(200).json({
        message: "Friend request already sent",
        request: formatRequest(existing, them),
      })
    }

    const created = await FriendRequest.create({
      from: authUserId,
      to: toId,
      status: "pending",
    })

    void createNotification({
      recipientId: String(toId),
      actorId: String(authUserId),
      type: "friend_request",
    })

    res.status(201).json({
      message: "Friend request sent",
      request: formatRequest(created, them),
    })
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(200).json({ message: "Friend request already sent" })
    }
    next(e)
  }
}

/** GET /users/me/friend-requests?box=incoming|outgoing */
export const listFriendRequests = async (req, res, next) => {
  try {
    const authUserId = req.user?.id
    if (!authUserId) return res.status(401).json({ error: "Unauthenticated" })

    const boxRaw = typeof req.query.box === "string" ? req.query.box.trim().toLowerCase() : "incoming"
    const box = boxRaw === "outgoing" ? "outgoing" : "incoming"

    const filter = box === "outgoing" ? { from: authUserId, status: "pending" } : { to: authUserId, status: "pending" }

    const docs = await FriendRequest.find(filter).sort({ createdAt: -1 }).limit(50).lean()
    const hidden = new Set(await hiddenUserIdsForRequest(req))
    const visibleDocs = docs.filter(d => {
      const otherId = box === "outgoing" ? String(d.to) : String(d.from)
      return !hidden.has(otherId)
    })
    const otherIds = visibleDocs.map(d => (box === "outgoing" ? d.to : d.from))
    const users = await User.find({ _id: { $in: otherIds } })
      .select(ACTOR_SELECT)
      .lean()
    const byId = new Map(users.map(u => [String(u._id), u]))

    res.status(200).json({
      box,
      requests: visibleDocs.map(d => {
        const other = box === "outgoing" ? byId.get(String(d.to)) : byId.get(String(d.from))
        return formatRequest(d, other)
      }),
    })
  } catch (e) {
    next(e)
  }
}

/** GET /users/me/friend-requests/count - incoming pending */
export const countIncomingFriendRequests = async (req, res, next) => {
  try {
    const authUserId = req.user?.id
    if (!authUserId) return res.status(401).json({ error: "Unauthenticated" })

    const hidden = await hiddenUserIdsForRequest(req)
    const countFilter = { to: authUserId, status: "pending" }
    if (hidden.length) countFilter.from = { $nin: hidden }
    const count = await FriendRequest.countDocuments(countFilter)
    res.status(200).json({ count })
  } catch (e) {
    next(e)
  }
}

/** POST /users/me/friend-requests/:requestId/accept */
export const acceptFriendRequest = async (req, res, next) => {
  try {
    const authUserId = req.user?.id
    if (!authUserId) return res.status(401).json({ error: "Unauthenticated" })

    await assertFeatureEnabled(req, "friendRequests")

    const { requestId } = req.params
    const request = await FriendRequest.findById(requestId)
    if (!request || request.status !== "pending") {
      return res.status(404).json({ error: "Friend request not found" })
    }
    if (String(request.to) !== String(authUserId)) {
      return res.status(403).json({ error: "Not allowed to accept this request" })
    }

    const [me, them] = await Promise.all([User.findById(authUserId), User.findById(request.from)])
    if (!me || !them || them.isActive === false) {
      return res.status(404).json({ error: "User not found" })
    }

    await assertNotBlocked(authUserId, request.from)

    const fromId = String(request.from)
    const toId = String(authUserId)

    // D6: ordered $addToSet updates with compensating rollback (no multi-doc transaction required)
    await User.updateOne({ _id: me._id }, { $addToSet: { friends: them._id } })
    try {
      await User.updateOne({ _id: them._id }, { $addToSet: { friends: me._id } })
    } catch (err) {
      await User.updateOne({ _id: me._id }, { $pull: { friends: them._id } })
      throw err
    }

    request.status = "accepted"
    await request.save()

    await FriendRequest.updateMany(
      {
        status: "pending",
        $or: [
          { from: authUserId, to: request.from },
          { from: request.from, to: authUserId },
        ],
        _id: { $ne: request._id },
      },
      { $set: { status: "cancelled" } }
    )

    void createNotification({
      recipientId: fromId,
      actorId: toId,
      type: "friend_accept",
    })

    const updatedMe = await User.findById(authUserId).select("friends")
    const friends = await formatFriendsList(updatedMe?.friends)
    res.status(200).json({ message: "Friend request accepted", friends })
  } catch (e) {
    next(e)
  }
}

/** POST /users/me/friend-requests/:requestId/decline */
export const declineFriendRequest = async (req, res, next) => {
  try {
    const authUserId = req.user?.id
    if (!authUserId) return res.status(401).json({ error: "Unauthenticated" })

    await assertFeatureEnabled(req, "friendRequests")

    const { requestId } = req.params
    const request = await FriendRequest.findById(requestId)
    if (!request || request.status !== "pending") {
      return res.status(404).json({ error: "Friend request not found" })
    }
    if (String(request.to) !== String(authUserId)) {
      return res.status(403).json({ error: "Not allowed to decline this request" })
    }

    request.status = "declined"
    await request.save()
    res.status(200).json({ message: "Friend request declined" })
  } catch (e) {
    next(e)
  }
}

/** DELETE /users/me/friend-requests/:requestId - cancel outgoing */
export const cancelFriendRequest = async (req, res, next) => {
  try {
    const authUserId = req.user?.id
    if (!authUserId) return res.status(401).json({ error: "Unauthenticated" })

    await assertFeatureEnabled(req, "friendRequests")

    const { requestId } = req.params
    const request = await FriendRequest.findById(requestId)
    if (!request || request.status !== "pending") {
      return res.status(404).json({ error: "Friend request not found" })
    }
    if (String(request.from) !== String(authUserId)) {
      return res.status(403).json({ error: "Not allowed to cancel this request" })
    }

    request.status = "cancelled"
    await request.save()
    res.status(200).json({ message: "Friend request cancelled" })
  } catch (e) {
    next(e)
  }
}

/** DELETE /users/me/friends/:friendId - mutual unfriend */
export const unfriend = async (req, res, next) => {
  try {
    const authUserId = req.user?.id
    if (!authUserId) return res.status(401).json({ error: "Unauthenticated" })

    await assertFeatureEnabled(req, "friendRequests")

    const { friendId } = req.params
    if (String(authUserId) === String(friendId)) {
      return res.status(400).json({ error: "Cannot unfriend yourself" })
    }

    const [me, them] = await Promise.all([User.findById(authUserId), User.findById(friendId)])
    if (!me || !them) return res.status(404).json({ msg: "User not found" })

    me.friends = (me.friends || []).filter(fid => toFriendId(fid) !== String(friendId))
    them.friends = (them.friends || []).filter(fid => toFriendId(fid) !== String(authUserId))
    await Promise.all([me.save(), them.save()])

    const friends = await formatFriendsList(me.friends)
    res.status(200).json({ message: "Friend removed", friends })
  } catch (e) {
    next(e)
  }
}

/** POST /users/:id/follow */
export const followUser = async (req, res, next) => {
  try {
    const authUserId = req.user?.id
    if (!authUserId) return res.status(401).json({ error: "Unauthenticated" })

    await assertFeatureEnabled(req, "follow")

    const { id: targetId } = req.params
    if (String(authUserId) === String(targetId)) {
      return res.status(400).json({ error: "Cannot follow yourself" })
    }

    const [me, them] = await Promise.all([User.findById(authUserId), User.findById(targetId)])
    if (!me || !them || them.isActive === false) {
      return res.status(404).json({ error: "User not found" })
    }

    await assertNotBlocked(authUserId, targetId)

    const already = (me.following || []).some(fid => toFriendId(fid) === String(targetId))
    if (!already) {
      me.following.push(them._id)
      await me.save()
    }

    res.status(200).json({
      message: already ? "Already following" : "Following",
      following: (me.following || []).map(id => String(id)),
      isFollowing: true,
    })
  } catch (e) {
    next(e)
  }
}

/** DELETE /users/:id/follow */
export const unfollowUser = async (req, res, next) => {
  try {
    const authUserId = req.user?.id
    if (!authUserId) return res.status(401).json({ error: "Unauthenticated" })

    await assertFeatureEnabled(req, "follow")

    const { id: targetId } = req.params
    if (String(authUserId) === String(targetId)) {
      return res.status(400).json({ error: "Cannot unfollow yourself" })
    }

    const me = await User.findById(authUserId)
    if (!me) return res.status(404).json({ msg: "User not found" })

    me.following = (me.following || []).filter(fid => toFriendId(fid) !== String(targetId))
    await me.save()

    res.status(200).json({
      message: "Unfollowed",
      following: (me.following || []).map(id => String(id)),
      isFollowing: false,
    })
  } catch (e) {
    next(e)
  }
}

/** GET /users/me/following?cursor=&limit= - same shape as GET /users/:id/following */
export const listFollowing = async (req, res, next) => {
  try {
    const authUserId = req.user?.id
    if (!authUserId) return res.status(401).json({ error: "Unauthenticated" })

    const me = await User.findById(authUserId).select("following")
    if (!me) return res.status(404).json({ msg: "User not found" })

    const pagination = parsePeoplePagination(req.query)
    const hidden = new Set(await hiddenUserIdsForRequest(req))
    const visibleIds = (me.following || []).filter(id => !hidden.has(String(id)))
    const page = pageIdList(visibleIds, pagination)
    const users = await resolvePeopleCards(page.ids, authUserId)

    res.status(200).json({
      users,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      total: page.total,
    })
  } catch (e) {
    next(e)
  }
}

export { getRelationshipsMap }
