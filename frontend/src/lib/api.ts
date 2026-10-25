/**
 * Shared API client (axios) and URL helpers.
 *
 * Set `NEXT_PUBLIC_API_URL` in `frontend/.env.local` (see `.env.example`).
 * Falls back to http://localhost:5000 for local dev if unset.
 *
 * Bearer access JWT is attached via a request interceptor from the Redux store.
 * On 401, one refresh attempt is made with the refresh token before logout.
 */

import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios"

import { setLogout, setTokens } from "@/state"
import { store } from "@/state/store"

const DEFAULT_API_URL = "http://localhost:5000"

/** API origin with no trailing slash. */
export function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim() || DEFAULT_API_URL
  return raw.replace(/\/+$/, "")
}

/**
 * Build a full API URL from a path (for rare cases that need a string URL).
 * @example apiUrl("/posts") → "http://localhost:5000/posts"
 */
export function apiUrl(path: string = ""): string {
  const base = getApiBaseUrl()
  if (!path) return base
  const normalized = path.startsWith("/") ? path : `/${path}`
  return `${base}${normalized}`
}

/**
 * Resolve a media `src` for `<img>`.
 * Absolute ImageKit (or other CDN) URLs are returned as-is.
 * Legacy ImageKit folder `/mockbook/` is rewritten to `/xivi/` (D4).
 * Empty values stay empty.
 */
export function mediaUrl(src: string | undefined | null): string {
  if (!src) return ""
  const trimmed = src.trim()
  if (!trimmed) return ""
  // Dashboard folder rename: old post/avatar URLs may still say /mockbook/
  const normalized = trimmed.replace(/\/mockbook\//gi, "/xivi/")
  if (
    /^https?:\/\//i.test(normalized) ||
    normalized.startsWith("data:") ||
    normalized.startsWith("blob:")
  ) {
    return normalized
  }
  return normalized
}

/** @deprecated Prefer `mediaUrl` - uploads are absolute ImageKit URLs now. */
export const assetUrl = mediaUrl

/** Shared axios instance for all Express API calls. */
export const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    Accept: "application/json",
  },
})

api.interceptors.request.use(config => {
  const token = store.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

let isRefreshing = false
let refreshWaiters: Array<{
  resolve: (token: string) => void
  reject: (err: unknown) => void
}> = []

function flushRefreshWaiters(error: unknown, token: string | null) {
  refreshWaiters.forEach(({ resolve, reject }) => {
    if (error || !token) reject(error)
    else resolve(token)
  })
  refreshWaiters = []
}

function redirectToLogin() {
  if (typeof window === "undefined") return
  const path = window.location.pathname
  if (path === "/login" || path === "/register") return
  // Full navigation clears in-memory Redux on hard auth failure (refresh expired).
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- intentional hard redirect
  window.location.assign(`${window.location.origin}/login`)
}

function isAuthPublicRequest(config?: InternalAxiosRequestConfig) {
  const url = config?.url || ""
  return url.includes("/auth/login") || url.includes("/auth/register") || url.includes("/auth/refresh")
}

api.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined
    const status = error.response?.status

    if (status !== 401 || !original || original._retry || isAuthPublicRequest(original)) {
      return Promise.reject(error)
    }

    const refreshToken = store.getState().refreshToken
    if (!refreshToken) {
      store.dispatch(setLogout())
      redirectToLogin()
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        refreshWaiters.push({ resolve, reject })
      }).then(token => {
        original.headers.Authorization = `Bearer ${token}`
        return api(original)
      })
    }

    original._retry = true
    isRefreshing = true

    try {
      const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
        apiUrl("/auth/refresh"),
        { refreshToken },
        { headers: { Accept: "application/json" } }
      )
      store.dispatch(setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken }))
      flushRefreshWaiters(null, data.accessToken)
      original.headers.Authorization = `Bearer ${data.accessToken}`
      return api(original)
    } catch (refreshError) {
      flushRefreshWaiters(refreshError, null)
      store.dispatch(setLogout())
      redirectToLogin()
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  }
)
