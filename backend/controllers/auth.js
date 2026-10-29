import bcrypt from "bcrypt"

import { roleForEmail } from "../lib/admins.js"
import { formatFriendsList } from "../lib/friends.js"
import { isValidPassword, PASSWORD_POLICY_MESSAGE } from "../lib/password.js"
import { relationshipCounts } from "../lib/peopleLists.js"
import { touchLastSeen } from "../lib/realtime.js"
import {
  consumeRefreshSession,
  issueAuthTokens,
  revokeRefreshSessions,
} from "../lib/tokens.js"
import User from "../models/User.js"

const toSafeUser = userDoc => {
  const user = userDoc.toObject ? userDoc.toObject() : { ...userDoc }
  delete user.password
  delete user.refreshSessions
  user.savedPosts = (user.savedPosts || []).map(id => String(id))
  user.following = (user.following || []).map(id => String(id))
  user.role = user.role || "user"
  user.isActive = user.isActive !== false
  return user
}

const withFormattedFriends = async userDoc => {
  const safeUser = toSafeUser(userDoc)
  safeUser.friends = await formatFriendsList(userDoc.friends)
  safeUser.following = (userDoc.following || []).map(id => String(id))
  const counts = await relationshipCounts(userDoc)
  safeUser.friendCount = counts.friendCount
  safeUser.followerCount = counts.followerCount
  safeUser.followingCount = counts.followingCount
  return safeUser
}

function sanitizeRegisterName(raw) {
  if (typeof raw !== "string") return ""
  return raw.trim().slice(0, 50)
}

export const register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password } = req.body
    const trimmedFirst = sanitizeRegisterName(firstName)
    const trimmedLast = sanitizeRegisterName(lastName)

    if (!trimmedFirst || !trimmedLast || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" })
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({ error: PASSWORD_POLICY_MESSAGE })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const existing = await User.findOne({ email: normalizedEmail }).select("_id")
    if (existing) {
      // A13: avoid confirming which emails are registered
      return res.status(400).json({ error: "Unable to create account" })
    }

    const salt = await bcrypt.genSalt()
    const hashedPass = await bcrypt.hash(password, salt)

    const newUser = new User({
      firstName: trimmedFirst,
      lastName: trimmedLast,
      email: normalizedEmail,
      password: hashedPass,
      picturePath: "",
      // A11: never auto-promote on register - use seed/DB or password login allowlist
      role: "user",
      isActive: true,
      friends: [],
      following: [],
      savedPosts: [],
      location: "",
      occupation: "",
      viewedProfile: 0,
    })

    const savedUser = await newUser.save()
    const tokens = await issueAuthTokens(savedUser._id)
    await touchLastSeen(savedUser._id)
    const user = await withFormattedFriends(savedUser)

    res.status(201).json({ user, ...tokens })
  } catch (e) {
    next(e)
  }
}

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: "Invalid credentials" })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const user = await User.findOne({ email: normalizedEmail }).select("+password")
    if (!user || !user.password) {
      return res.status(400).json({ error: "Invalid credentials" })
    }

    const passMatch = await bcrypt.compare(password, user.password)
    if (!passMatch) {
      return res.status(400).json({ error: "Invalid credentials" })
    }

    if (user.isActive === false) {
      return res.status(403).json({ error: "Account deactivated" })
    }

    // A11: allowlist promote only after password auth (proves account control)
    const nextRole = roleForEmail(user.email, user.role)
    if (nextRole !== user.role) {
      user.role = nextRole
      await user.save()
    }

    const tokens = await issueAuthTokens(user._id)
    await touchLastSeen(user._id)
    const safeUser = await withFormattedFriends(user)

    res.status(200).json({ user: safeUser, ...tokens })
  } catch (e) {
    next(e)
  }
}

/** Current user from Bearer access token. */
export const me = async (req, res, next) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: "Unauthenticated" })
    const user = await User.findById(userId)
    if (!user) return res.status(401).json({ error: "Unauthenticated" })
    if (user.isActive === false) return res.status(403).json({ error: "Account deactivated" })
    // Do not promote via /me alone (A11) - only login / seed.
    const safeUser = await withFormattedFriends(user)
    res.status(200).json({ user: safeUser })
  } catch (e) {
    next(e)
  }
}

/** Exchange a valid refresh token for a new access + refresh pair (rotating). */
export const refresh = async (req, res, next) => {
  try {
    const refreshToken =
      (typeof req.body?.refreshToken === "string" && req.body.refreshToken.trim()) ||
      (req.header("Authorization")?.startsWith("Bearer ")
        ? req.header("Authorization").slice(7).trim()
        : "")

    if (!refreshToken) {
      return res.status(401).json({ error: "Refresh token required" })
    }

    const consumed = await consumeRefreshSession(refreshToken)
    if (!consumed) {
      return res.status(401).json({ error: "Invalid or expired refresh token" })
    }

    const tokens = await issueAuthTokens(consumed.user._id)
    res.status(200).json(tokens)
  } catch (e) {
    next(e)
  }
}

/** Revoke the presented refresh session (or all sessions for the user). */
export const logout = async (req, res, next) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: "Unauthenticated" })

    const refreshToken =
      (typeof req.body?.refreshToken === "string" && req.body.refreshToken.trim()) || ""

    await revokeRefreshSessions(userId, refreshToken || null)
    res.status(200).json({ message: "Signed out" })
  } catch (e) {
    next(e)
  }
}
