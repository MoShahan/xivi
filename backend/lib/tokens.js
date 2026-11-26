import crypto from "crypto"

import jwt from "jsonwebtoken"

import User from "../models/User.js"

const DEFAULT_ACCESS_TOKEN_EXPIRES = "15m"
const DEFAULT_REFRESH_TOKEN_EXPIRES = "7d"
const MAX_REFRESH_SESSIONS = 10
/** Pin HMAC algorithm so verify rejects unexpected algs. */
const JWT_ALGORITHM = "HS256"

export function getAccessTokenExpires() {
  return process.env.ACCESS_TOKEN_EXPIRES?.trim() || DEFAULT_ACCESS_TOKEN_EXPIRES
}

export function getRefreshTokenExpires() {
  return process.env.REFRESH_TOKEN_EXPIRES?.trim() || DEFAULT_REFRESH_TOKEN_EXPIRES
}

function requireAccessSecret() {
  const secret = process.env.ACCESS_TOKEN_SECRET
  if (!secret) {
    throw new Error("ACCESS_TOKEN_SECRET is not configured")
  }
  return secret
}

function requireRefreshSecret() {
  const dedicated = process.env.REFRESH_TOKEN_SECRET?.trim()
  if (dedicated) return dedicated

  if (process.env.NODE_ENV === "production") {
    throw new Error("REFRESH_TOKEN_SECRET is required in production")
  }

  const fallback = process.env.ACCESS_TOKEN_SECRET
  if (!fallback) {
    throw new Error("REFRESH_TOKEN_SECRET is not configured")
  }
  return fallback
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex")
}

export function signAccessToken(userId) {
  return jwt.sign({ id: String(userId), typ: "access" }, requireAccessSecret(), {
    algorithm: JWT_ALGORITHM,
    expiresIn: getAccessTokenExpires(),
  })
}

/** Sign a refresh JWT (includes `jti`). Does not touch the DB - use `issueAuthTokens` in app code. */
export function signRefreshToken(userId, jti = crypto.randomUUID()) {
  return jwt.sign({ id: String(userId), typ: "refresh", jti }, requireRefreshSecret(), {
    algorithm: JWT_ALGORITHM,
    expiresIn: getRefreshTokenExpires(),
  })
}

export function verifyAccessTokenString(token) {
  const payload = jwt.verify(token, requireAccessSecret(), { algorithms: [JWT_ALGORITHM] })
  if (!payload?.id || payload.typ === "refresh") {
    throw new Error("Invalid access token")
  }
  return payload
}

export function verifyRefreshTokenString(token) {
  const payload = jwt.verify(token, requireRefreshSecret(), { algorithms: [JWT_ALGORITHM] })
  if (!payload?.id || payload.typ !== "refresh" || !payload.jti) {
    throw new Error("Invalid refresh token")
  }
  return payload
}

/**
 * Issue access + refresh tokens and store a hashed refresh session on the user (A4).
 * Keeps the last MAX_REFRESH_SESSIONS sessions; drops expired ones.
 */
export async function issueAuthTokens(userId) {
  const jti = crypto.randomUUID()
  const accessToken = signAccessToken(userId)
  const refreshToken = signRefreshToken(userId, jti)

  const decoded = jwt.decode(refreshToken)
  const expiresAt = new Date((decoded?.exp || 0) * 1000)
  const tokenHash = hashToken(refreshToken)
  const now = new Date()

  await User.updateOne(
    { _id: userId },
    {
      $pull: { refreshSessions: { expiresAt: { $lte: now } } },
    }
  )
  await User.updateOne(
    { _id: userId },
    {
      $push: {
        refreshSessions: {
          $each: [{ jti, tokenHash, expiresAt }],
          $slice: -MAX_REFRESH_SESSIONS,
        },
      },
    }
  )

  return { accessToken, refreshToken, jti }
}

/** Validate refresh JWT against stored session hash. Returns payload or null. */
export async function consumeRefreshSession(refreshToken) {
  let payload
  try {
    payload = verifyRefreshTokenString(refreshToken)
  } catch {
    return null
  }

  const user = await User.findById(payload.id).select("+refreshSessions")
  if (!user || user.isActive === false) return null

  const tokenHash = hashToken(refreshToken)
  const sessions = user.refreshSessions || []
  const match = sessions.find(
    s => s.jti === payload.jti && s.tokenHash === tokenHash && s.expiresAt > new Date()
  )
  if (!match) return null

  // Rotate: drop this session (caller issues a new one).
  user.refreshSessions = sessions.filter(s => s.jti !== payload.jti)
  await user.save()

  return { payload, user }
}

/** Revoke one refresh session (logout) or all if no token / jti. */
export async function revokeRefreshSessions(userId, refreshToken) {
  if (!userId) return

  if (refreshToken) {
    try {
      const payload = verifyRefreshTokenString(refreshToken)
      if (String(payload.id) === String(userId) && payload.jti) {
        await User.updateOne({ _id: userId }, { $pull: { refreshSessions: { jti: payload.jti } } })
        return
      }
    } catch {
      // fall through to clear all
    }
  }

  await User.updateOne({ _id: userId }, { $set: { refreshSessions: [] } })
}
