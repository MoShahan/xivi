import { assertVisibleUser, hiddenUserIdsForRequest, isBlockedByMe, skipIncomingBlocks } from "../lib/blocks.js"
import { assertFeatureEnabled } from "../lib/features.js"
import { formatFriendsList } from "../lib/friends.js"
import { uploadImageBuffer } from "../lib/imagekit.js"
import { pageFromDocs, parseCursorPagination } from "../lib/pagination.js"
import {
  listFollowersPage,
  pageIdList,
  parsePeoplePagination,
  relationshipCounts,
  resolvePeopleCards,
} from "../lib/peopleLists.js"
import { DEFAULT_AVATAR_COLOR, DEFAULT_COVER_COLOR, sanitizeProfileColor } from "../lib/profileColors.js"
import { getRelationshipsMap } from "../lib/relationships.js"
import { pickSocialFields } from "../lib/social.js"
import Block from "../models/Block.js"
import ProfileView, { utcDayKey } from "../models/ProfileView.js"
import User from "../models/User.js"

const PUBLIC_USER_FIELDS =
  "_id firstName lastName picturePath avatarColor coverColor location occupation facebook x linkedin instagram friends following viewedProfile createdAt role isActive"

const DISCOVER_FIELDS = "_id firstName lastName picturePath avatarColor location occupation createdAt"

function sanitizeName(raw, fallback) {
  if (typeof raw !== "string") return fallback
  const trimmed = raw.trim().replace(/\s+/g, " ")
  if (!trimmed) return fallback
  return trimmed.slice(0, 50)
}

function sanitizeShortText(raw, max = 100) {
  if (typeof raw !== "string") return ""
  return raw.trim().replace(/\s+/g, " ").slice(0, max)
}

/** Public profile JSON (no password). Friends stay as raw ids unless formatted separately. */
function toPublicUser(userDoc) {
  const user = userDoc.toObject ? userDoc.toObject() : { ...userDoc }
  delete user.password
  delete user.__v
  user._id = String(user._id)
  user.friends = (user.friends || []).map(id => String(id))
  // following id list is owner-only; counts are public (see attachRelationshipCounts)
  delete user.following
  user.savedPosts = (user.savedPosts || []).map(id => String(id))
  user.facebook = user.facebook || ""
  user.x = user.x || ""
  user.linkedin = user.linkedin || ""
  user.instagram = user.instagram || ""
  user.avatarColor = user.avatarColor || DEFAULT_AVATAR_COLOR
  user.coverColor = user.coverColor || DEFAULT_COVER_COLOR
  user.role = user.role || "user"
  user.isActive = user.isActive !== false
  return user
}

/** Attach friend / follower / following counts (does not expose following ids). */
async function attachRelationshipCounts(userDoc, publicUser) {
  const counts = await relationshipCounts(userDoc)
  publicUser.friendCount = counts.friendCount
  publicUser.followerCount = counts.followerCount
  publicUser.followingCount = counts.followingCount
  return publicUser
}

/** Admin: soft-deactivate a user (cannot log in). */
export const deactivateUser = async (req, res, next) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" })
    }
    const authUserId = req.user.id
    const { id } = req.params
    if (String(authUserId) === String(id)) {
      return res.status(400).json({ error: "Cannot deactivate your own account" })
    }

    const target = await User.findById(id)
    if (!target) return res.status(404).json({ msg: "User not found" })
    if (target.role === "admin") {
      return res.status(400).json({ error: "Cannot deactivate an admin account" })
    }

    target.isActive = false
    target.deactivatedAt = new Date()
    target.deactivatedBy = authUserId
    await target.save()

    const publicUser = await attachRelationshipCounts(target, toPublicUser(target))
    res.status(200).json({ message: "User deactivated", user: publicUser })
  } catch (e) {
    next(e)
  }
}

/** Admin: reactivate a deactivated user. */
export const reactivateUser = async (req, res, next) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" })
    }
    const { id } = req.params
    const target = await User.findById(id)
    if (!target) return res.status(404).json({ msg: "User not found" })

    target.isActive = true
    target.deactivatedAt = null
    target.deactivatedBy = null
    await target.save()

    const publicUser = await attachRelationshipCounts(target, toPublicUser(target))
    res.status(200).json({ message: "User reactivated", user: publicUser })
  } catch (e) {
    next(e)
  }
}

export const getUser = async (req, res, next) => {
  try {
    const { id } = req.params
    const user = await User.findById(id).select(PUBLIC_USER_FIELDS)
    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    const viewerId = req.user?.id
    const viewerIsAdmin = req.user?.role === "admin"
    // A14: hide deactivated profiles from non-admins
    if (user.isActive === false && !viewerIsAdmin && String(viewerId) !== String(id)) {
      return res.status(404).json({ error: "User not found" })
    }

    if (viewerId && String(viewerId) !== String(id)) {
      if (await isBlockedByMe(viewerId, id)) {
        return res.status(200).json({
          _id: String(user._id),
          firstName: user.firstName,
          lastName: user.lastName,
          picturePath: user.picturePath || "",
          avatarColor: user.avatarColor || DEFAULT_AVATAR_COLOR,
          blockedByMe: true,
        })
      }
      if ((await isBlockedByMe(id, viewerId)) && !viewerIsAdmin) {
        return res.status(404).json({ error: "User not found" })
      }
    }

    // A8: count at most one view per viewer per UTC day
    if (viewerId && String(viewerId) !== String(id) && user.isActive !== false) {
      try {
        await ProfileView.create({
          viewer: viewerId,
          profile: id,
          day: utcDayKey(),
        })
        await User.updateOne({ _id: id }, { $inc: { viewedProfile: 1 } })
        user.viewedProfile = (user.viewedProfile || 0) + 1
      } catch (err) {
        // Duplicate key = already counted today - ignore
        if (err?.code !== 11000) throw err
      }
    }

    const publicUser = await attachRelationshipCounts(user, toPublicUser(user))
    if (viewerId && String(viewerId) === String(id)) {
      publicUser.blockedCount = await Block.countDocuments({ blocker: viewerId })
    }
    res.status(200).json(publicUser)
  } catch (e) {
    next(e)
  }
}

/**
 * Own-profile update: names, location, occupation, social handles, optional avatar.
 * Multipart field `picture` for avatar; text fields in body.
 */
export const updateProfile = async (req, res, next) => {
  try {
    const authUserId = req.user?.id
    if (!authUserId) {
      return res.status(401).json({ error: "Unauthenticated" })
    }

    const user = await User.findById(authUserId)
    if (!user) {
      return res.status(404).json({ msg: "User not found" })
    }

    const touchingProfileFields =
      Object.prototype.hasOwnProperty.call(req.body, "firstName") ||
      Object.prototype.hasOwnProperty.call(req.body, "lastName") ||
      Object.prototype.hasOwnProperty.call(req.body, "location") ||
      Object.prototype.hasOwnProperty.call(req.body, "occupation") ||
      Object.prototype.hasOwnProperty.call(req.body, "avatarColor") ||
      Object.prototype.hasOwnProperty.call(req.body, "coverColor") ||
      Object.prototype.hasOwnProperty.call(req.body, "facebook") ||
      Object.prototype.hasOwnProperty.call(req.body, "x") ||
      Object.prototype.hasOwnProperty.call(req.body, "linkedin") ||
      Object.prototype.hasOwnProperty.call(req.body, "instagram")

    if (touchingProfileFields) {
      await assertFeatureEnabled(req, "profileEdit")
    }
    if (req.file?.buffer) {
      await assertFeatureEnabled(req, "profileAvatar")
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "firstName")) {
      user.firstName = sanitizeName(req.body.firstName, user.firstName)
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "lastName")) {
      user.lastName = sanitizeName(req.body.lastName, user.lastName)
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "location")) {
      user.location = sanitizeShortText(req.body.location, 100)
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "occupation")) {
      user.occupation = sanitizeShortText(req.body.occupation, 100)
    }

    const social = pickSocialFields(req.body)
    for (const [key, value] of Object.entries(social)) {
      user[key] = value
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "avatarColor")) {
      const color = sanitizeProfileColor(req.body.avatarColor)
      if (!color) {
        return res.status(400).json({ error: "Invalid avatar color" })
      }
      user.avatarColor = color
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "coverColor")) {
      const color = sanitizeProfileColor(req.body.coverColor)
      if (!color) {
        return res.status(400).json({ error: "Invalid cover color" })
      }
      user.coverColor = color
    }

    if (req.file?.buffer) {
      const uploaded = await uploadImageBuffer(req.file.buffer, req.file.originalname, "/xivi/avatars")
      user.picturePath = uploaded.url || user.picturePath
    }

    await user.save()

    const safe = await attachRelationshipCounts(user, toPublicUser(user))
    safe.friends = await formatFriendsList(user.friends)
    safe.following = (user.following || []).map(id => String(id))
    res.status(200).json({ user: safe })
  } catch (e) {
    if (e.message?.includes("IMAGEKIT_PRIVATE_KEY")) {
      return res.status(503).json({ error: "Image upload is not configured" })
    }
    next(e)
  }
}

const MENTION_SUGGEST_DEFAULT = 8
const MENTION_SUGGEST_MAX = 15
const MENTION_CARD_FIELDS = "_id firstName lastName picturePath avatarColor"

function toMentionCard(u) {
  return {
    _id: String(u._id),
    firstName: u.firstName,
    lastName: u.lastName,
    picturePath: u.picturePath || "",
    avatarColor: u.avatarColor || DEFAULT_AVATAR_COLOR,
  }
}

function nameMatchesQuery(user, qLower) {
  if (!qLower) return true
  const first = String(user.firstName || "").toLowerCase()
  const last = String(user.lastName || "").toLowerCase()
  const full = `${first} ${last}`.trim()
  return first.includes(qLower) || last.includes(qLower) || full.includes(qLower)
}

/**
 * Lightweight @mention picker: network-first (friends ∪ following), then name search fill.
 * Query: `?q=&limit=` (default 8, max 15). Never returns email.
 */
export const mentionSuggest = async (req, res, next) => {
  try {
    const authUserId = req.user?.id
    if (!authUserId) {
      return res.status(401).json({ error: "Unauthenticated" })
    }

    const q = typeof req.query.q === "string" ? req.query.q.trim() : ""
    const qLower = q.toLowerCase()
    const rawLimit = Number.parseInt(String(req.query.limit ?? String(MENTION_SUGGEST_DEFAULT)), 10)
    const limit = Math.min(
      MENTION_SUGGEST_MAX,
      Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : MENTION_SUGGEST_DEFAULT
    )

    const hidden = await hiddenUserIdsForRequest(req)
    const hideSet = new Set([String(authUserId), ...hidden.map(String)])

    const me = await User.findById(authUserId).select("friends following").lean()
    if (!me) {
      return res.status(401).json({ error: "Unauthenticated" })
    }

    const networkIds = [
      ...new Set([...(me.friends || []).map(id => String(id)), ...(me.following || []).map(id => String(id))]),
    ].filter(id => id && !hideSet.has(id))

    const results = []
    const seen = new Set()

    if (networkIds.length > 0) {
      const networkUsers = await User.find({
        _id: { $in: networkIds },
        isActive: { $ne: false },
      })
        .select(MENTION_CARD_FIELDS)
        .lean()

      const matched = networkUsers
        .filter(u => nameMatchesQuery(u, qLower))
        .sort((a, b) => {
          const an = `${a.firstName || ""} ${a.lastName || ""}`.trim().toLowerCase()
          const bn = `${b.firstName || ""} ${b.lastName || ""}`.trim().toLowerCase()
          return an.localeCompare(bn)
        })

      for (const u of matched) {
        const id = String(u._id)
        if (seen.has(id)) continue
        seen.add(id)
        results.push(toMentionCard(u))
        if (results.length >= limit) break
      }
    }

    if (results.length < limit) {
      const filter = {
        _id: { $nin: [...hideSet, ...seen] },
        isActive: { $ne: false },
      }
      if (q) {
        const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        const re = new RegExp(escaped, "i")
        filter.$or = [{ firstName: re }, { lastName: re }]
      } else if (networkIds.length === 0) {
        // Empty query with no network: do not dump the whole site.
        return res.status(200).json({ users: results })
      } else {
        // Empty query already filled from network; no global fill.
        return res.status(200).json({ users: results })
      }

      const fill = await User.find(filter)
        .select(MENTION_CARD_FIELDS)
        .sort({ createdAt: -1 })
        .limit(limit - results.length)
        .lean()

      for (const u of fill) {
        const id = String(u._id)
        if (seen.has(id) || hideSet.has(id)) continue
        seen.add(id)
        results.push(toMentionCard(u))
      }
    }

    res.status(200).json({ users: results })
  } catch (e) {
    next(e)
  }
}

/**
 * Discover users: recent registrants by default, or name search when `q` is set.
 * Excludes the authenticated user. Cursor pagination: `?limit=&cursor=` (default 10, max 30).
 * A6: search names only (never email).
 */
export const discoverUsers = async (req, res, next) => {
  try {
    const authUserId = req.user?.id
    if (!authUserId) {
      return res.status(401).json({ error: "Unauthenticated" })
    }

    const { limit, cursorDate } = parseCursorPagination(req.query)
    const q = typeof req.query.q === "string" ? req.query.q.trim() : ""

    const hidden = await hiddenUserIdsForRequest(req)
    const filter = { _id: { $nin: [authUserId, ...hidden] }, isActive: { $ne: false } }

    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const re = new RegExp(escaped, "i")
      filter.$or = [{ firstName: re }, { lastName: re }]
    }

    if (cursorDate) {
      filter.createdAt = { $lt: cursorDate }
    }

    const docs = await User.find(filter)
      .select(DISCOVER_FIELDS)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean()

    const { pageDocs, nextCursor, hasMore } = pageFromDocs(docs, limit)
    const ids = pageDocs.map(u => String(u._id))
    const relMap = await getRelationshipsMap(authUserId, ids)

    res.status(200).json({
      users: pageDocs.map(u => {
        const id = String(u._id)
        const rel = relMap[id] || {
          isFriend: false,
          isFollowing: false,
          outgoingRequestId: null,
          incomingRequestId: null,
          blockedByMe: false,
        }
        return {
          _id: id,
          firstName: u.firstName,
          lastName: u.lastName,
          picturePath: u.picturePath || "",
          avatarColor: u.avatarColor || DEFAULT_AVATAR_COLOR,
          location: u.location || "",
          occupation: u.occupation || "",
          createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : undefined,
          relationship: rel,
        }
      }),
      nextCursor,
      hasMore,
    })
  } catch (e) {
    next(e)
  }
}

/** GET /users/:id/friends?cursor=&limit= → { users, nextCursor, hasMore, total } */
export const getUserFriends = async (req, res, next) => {
  try {
    const authUserId = req.user?.id
    if (!authUserId) return res.status(401).json({ error: "Unauthenticated" })

    const { id } = req.params
    await assertVisibleUser(req, id)
    const user = await User.findById(id).select("friends")
    if (!user) {
      return res.status(404).json({ msg: "User not found" })
    }

    const pagination = parsePeoplePagination(req.query)
    const hidden = new Set(await hiddenUserIdsForRequest(req))
    const visibleIds = (user.friends || []).filter(fid => !hidden.has(String(fid)))
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

/** GET /users/:id/following?cursor=&limit= → people this user follows */
export const getUserFollowing = async (req, res, next) => {
  try {
    const authUserId = req.user?.id
    if (!authUserId) return res.status(401).json({ error: "Unauthenticated" })

    const { id } = req.params
    await assertVisibleUser(req, id)
    const user = await User.findById(id).select("following")
    if (!user) {
      return res.status(404).json({ msg: "User not found" })
    }

    const pagination = parsePeoplePagination(req.query)
    const hidden = new Set(await hiddenUserIdsForRequest(req))
    const visibleIds = (user.following || []).filter(fid => !hidden.has(String(fid)))
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

/** GET /users/:id/followers?cursor=&limit= → people who follow this user */
export const getUserFollowers = async (req, res, next) => {
  try {
    const authUserId = req.user?.id
    if (!authUserId) return res.status(401).json({ error: "Unauthenticated" })

    const { id } = req.params
    await assertVisibleUser(req, id)
    const exists = await User.exists({ _id: id })
    if (!exists) {
      return res.status(404).json({ msg: "User not found" })
    }

    const pagination = parsePeoplePagination(req.query)
    const result = await listFollowersPage(id, pagination, authUserId, {
      skipIncoming: skipIncomingBlocks(req),
    })
    res.status(200).json(result)
  } catch (e) {
    next(e)
  }
}
