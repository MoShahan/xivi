/**
 * Map OAuth `?oauthError=` query values to fixed, safe copy.
 * Backend should send short codes; unknown / free-text values fall back to a generic message (F9).
 */
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  provider_not_configured: "That sign-in option isn’t available right now.",
  unavailable: "Sign-in isn’t available right now.",
  cancelled: "Sign-in was cancelled.",
  invalid_response: "Sign-in failed. Please try again.",
  invalid_state: "Sign-in expired. Please try again.",
  provider_account: "Couldn’t read your account from the provider.",
  no_email: "Your provider account has no email, so we can’t create an account.",
  // Legacy code; backend now sends `failed` to avoid confirming email existence.
  account_exists: "Sign-in failed. Please try again.",
  failed: "Sign-in failed. Please try again.",
}

/** Resolve a query param to display copy, or null if empty. */
export function resolveOauthError(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const key = raw.trim()
  if (!key) return null
  return OAUTH_ERROR_MESSAGES[key] ?? OAUTH_ERROR_MESSAGES.failed
}
