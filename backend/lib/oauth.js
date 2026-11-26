import crypto from "crypto"

import jwt from "jsonwebtoken"

const STATE_TTL_SEC = 600

const PROVIDERS = {
  google: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "openid email profile",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
  },
  github: {
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scope: "read:user user:email",
    clientIdEnv: "GITHUB_CLIENT_ID",
    clientSecretEnv: "GITHUB_CLIENT_SECRET",
  },
  discord: {
    authUrl: "https://discord.com/api/oauth2/authorize",
    tokenUrl: "https://discord.com/api/oauth2/token",
    scope: "identify email",
    clientIdEnv: "DISCORD_CLIENT_ID",
    clientSecretEnv: "DISCORD_CLIENT_SECRET",
  },
}

export function listConfiguredOauthProviders() {
  return Object.keys(PROVIDERS).filter(p => isProviderConfigured(p))
}

export function isProviderConfigured(provider) {
  const cfg = PROVIDERS[provider]
  if (!cfg) return false
  return Boolean(process.env[cfg.clientIdEnv]?.trim() && process.env[cfg.clientSecretEnv]?.trim())
}

export function getProviderConfig(provider) {
  const cfg = PROVIDERS[provider]
  if (!cfg) return null
  if (!isProviderConfigured(provider)) return null
  return {
    ...cfg,
    clientId: process.env[cfg.clientIdEnv].trim(),
    clientSecret: process.env[cfg.clientSecretEnv].trim(),
  }
}

export function oauthCallbackUrl(provider) {
  const base = (process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`).replace(
    /\/+$/,
    ""
  )
  return `${base}/auth/${provider}/callback`
}

export function frontendOrigin() {
  return (process.env.FRONTEND_URL || "http://localhost:3000").split(",")[0].trim().replace(/\/+$/, "")
}

export function signOauthState(provider) {
  const secret = process.env.ACCESS_TOKEN_SECRET
  return jwt.sign({ provider, nonce: crypto.randomBytes(8).toString("hex") }, secret, {
    algorithm: "HS256",
    expiresIn: STATE_TTL_SEC,
  })
}

export function verifyOauthState(state, expectedProvider) {
  const secret = process.env.ACCESS_TOKEN_SECRET
  const payload = jwt.verify(state, secret, { algorithms: ["HS256"] })
  if (payload.provider !== expectedProvider) {
    throw new Error("OAuth state provider mismatch")
  }
  return payload
}

export function buildAuthorizeUrl(provider) {
  const cfg = getProviderConfig(provider)
  if (!cfg) return null
  const state = signOauthState(provider)
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: oauthCallbackUrl(provider),
    response_type: "code",
    scope: cfg.scope,
    state,
  })
  if (provider === "google") {
    params.set("access_type", "online")
    params.set("prompt", "select_account")
  }
  return { url: `${cfg.authUrl}?${params}`, state }
}

async function exchangeCode(provider, code) {
  const cfg = getProviderConfig(provider)
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code,
    redirect_uri: oauthCallbackUrl(provider),
    grant_type: "authorization_code",
  })

  const headers = { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }
  const res = await fetch(cfg.tokenUrl, { method: "POST", headers, body })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Token exchange failed")
  }
  return data.access_token
}

/**
 * @returns {Promise<{ providerId: string, email: string|null, firstName: string, lastName: string, picturePath: string }>}
 */
export async function fetchOauthProfile(provider, code) {
  const accessToken = await exchangeCode(provider, code)

  if (provider === "google") {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data = await res.json()
    if (!res.ok) throw new Error("Failed to load Google profile")
    const name = (data.name || "").trim()
    const parts = name.split(/\s+/)
    return {
      providerId: String(data.sub),
      email: data.email || null,
      firstName: parts[0] || "User",
      lastName: parts.slice(1).join(" ") || "Google",
      picturePath: data.picture || "",
    }
  }

  if (provider === "github") {
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "Xivi",
      },
    })
    const user = await userRes.json()
    if (!userRes.ok) throw new Error("Failed to load GitHub profile")

    let email = user.email || null
    if (!email) {
      const emailRes = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "Xivi",
        },
      })
      if (emailRes.ok) {
        const emails = await emailRes.json()
        const primary = emails.find(e => e.primary && e.verified) || emails.find(e => e.verified)
        email = primary?.email || null
      }
    }

    const name = (user.name || user.login || "User").trim()
    const parts = name.split(/\s+/)
    return {
      providerId: String(user.id),
      email,
      firstName: parts[0] || user.login || "User",
      lastName: parts.slice(1).join(" ") || "GitHub",
      picturePath: user.avatar_url || "",
    }
  }

  if (provider === "discord") {
    const res = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data = await res.json()
    if (!res.ok) throw new Error("Failed to load Discord profile")
    const username = data.global_name || data.username || "User"
    const parts = String(username).trim().split(/\s+/)
    const avatar = data.avatar
      ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png`
      : ""
    return {
      providerId: String(data.id),
      email: data.email || null,
      firstName: parts[0] || "User",
      lastName: parts.slice(1).join(" ") || "Discord",
      picturePath: avatar,
    }
  }

  throw new Error("Unknown provider")
}

export { PROVIDERS }
