/** Chat presence subtitle: Online, or a last-seen phrase. */
export function formatLastSeen(
  online: boolean,
  lastSeenAt?: string | Date | null,
  nowMs: number = Date.now()
): string {
  if (online) return "Online"
  if (lastSeenAt == null || lastSeenAt === "") return ""
  const date = lastSeenAt instanceof Date ? lastSeenAt : new Date(lastSeenAt)
  if (Number.isNaN(date.getTime())) return ""

  const diff = Math.max(0, nowMs - date.getTime())
  const sec = Math.floor(diff / 1000)
  const min = Math.floor(sec / 60)

  if (sec < 45) return "Last seen just now"
  if (min < 60) return `Last seen ${min}m ago`

  const now = new Date(nowMs)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfThatDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const dayDiff = Math.round((startOfToday - startOfThatDay) / 86_400_000)
  const time = date.toLocaleString(undefined, { hour: "numeric", minute: "2-digit" })

  if (dayDiff === 0) return `Last seen today at ${time}`
  if (dayDiff === 1) return `Last seen yesterday at ${time}`
  if (dayDiff < 7) {
    const weekday = date.toLocaleString(undefined, { weekday: "short" })
    return `Last seen ${weekday} at ${time}`
  }

  const when = date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  })
  return `Last seen ${when}`
}

export function displayName(user: { firstName?: string; lastName?: string } | null | undefined): string {
  if (!user) return "Someone"
  return `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Someone"
}
