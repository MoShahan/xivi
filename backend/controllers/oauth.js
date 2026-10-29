import crypto from "crypto"

import bcrypt from "bcrypt"

import {
  buildAuthorizeUrl,
  fetchOauthProfile,
  frontendOrigin,
  isProviderConfigured,
  listConfiguredOauthProviders,
  verifyOauthState,
} from "../lib/oauth.js"
import { touchLastSeen } from "../lib/realtime.js"
import { issueAuthTokens } from "../lib/tokens.js"
import User from "../models/User.js"

/** Redirect to FE login with a short oauthError code (FE maps to fixed copy). */
function redirectError(res, code) {
  const url = new URL("/login", frontendOrigin())
  url.searchParams.set("oauthError", code)
  return res.redirect(url.toString())
}

export const listOauthProviders = (req, res) => {
  res.status(200).json({ providers: listConfiguredOauthProviders() })
}

export const startOauth = (req, res) => {
  const { provider } = req.params
  if (!isProviderConfigured(provider)) {
    return redirectError(res, "provider_not_configured")
  }
  const built = buildAuthorizeUrl(provider)
  if (!built) return redirectError(res, "unavailable")
  return res.redirect(built.url)
}

export const oauthCallback = async (req, res, next) => {
  const { provider } = req.params
  try {
    if (!isProviderConfigured(provider)) {
      return redirectError(res, "provider_not_configured")
    }

    const { code, state, error } = req.query
    if (error) {
      return redirectError(res, "cancelled")
    }
    if (typeof code !== "string" || !code || typeof state !== "string" || !state) {
      return redirectError(res, "invalid_response")
    }

    try {
      verifyOauthState(state, provider)
    } catch {
      return redirectError(res, "invalid_state")
    }

    const profile = await fetchOauthProfile(provider, code)
    if (!profile.providerId) {
      return redirectError(res, "provider_account")
    }

    let user = await User.findOne({
      oauthProviders: { $elemMatch: { provider, providerId: profile.providerId } },
    })

    // A7: never silent-link by email alone (account takeover). Existing password
    // accounts must sign in first; future explicit-link flow can be added later.
    if (!user && profile.email) {
      const emailOwner = await User.findOne({ email: profile.email.toLowerCase() }).select("_id")
      if (emailOwner) {
        return redirectError(res, "account_exists")
      }
    }

    if (!user) {
      if (!profile.email) {
        return redirectError(res, "no_email")
      }
      const placeholderHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10)
      const email = profile.email.toLowerCase()
      user = await User.create({
        firstName: profile.firstName.slice(0, 50),
        lastName: profile.lastName.slice(0, 50),
        email,
        password: placeholderHash,
        picturePath: profile.picturePath || "",
        // A11: never auto-promote on OAuth register - seed/DB or password login allowlist
        role: "user",
        isActive: true,
        friends: [],
        following: [],
        savedPosts: [],
        location: "",
        occupation: "",
        viewedProfile: 0,
        oauthProviders: [{ provider, providerId: profile.providerId }],
      })
    }

    if (user.isActive === false) {
      return redirectError(res, "failed")
    }

    const tokens = await issueAuthTokens(user._id)
    await touchLastSeen(user._id)

    const handoff = new URL("/auth/callback", frontendOrigin())
    const fragment = new URLSearchParams({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    })
    return res.redirect(`${handoff.toString()}#${fragment.toString()}`)
  } catch (e) {
    console.error("oauthCallback:", e.message)
    return redirectError(res, "failed")
  }
}
