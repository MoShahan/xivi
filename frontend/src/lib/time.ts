/** Calendar-style join date for profiles and discover rows (e.g. "Joined Jan 2024"). */
export function formatJoinedDate(iso: string | Date | undefined | null): string {
  if (!iso) return ""
  const date = iso instanceof Date ? iso : new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const monthYear = date.toLocaleString(undefined, { month: "short", year: "numeric" })
  return `Joined ${monthYear}`
}

/** Human-readable time for post cards (relative when recent, else short date). */
export function formatPostTime(iso: string | Date | undefined | null): string {
  if (!iso) return ""
  const date = iso instanceof Date ? iso : new Date(iso)
  if (Number.isNaN(date.getTime())) return ""

  const diffMs = Date.now() - date.getTime()
  const sec = Math.round(diffMs / 1000)
  const min = Math.round(sec / 60)
  const hr = Math.round(min / 60)
  const day = Math.round(hr / 24)

  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
  if (Math.abs(sec) < 60) return rtf.format(-sec, "second")
  if (Math.abs(min) < 60) return rtf.format(-min, "minute")
  if (Math.abs(hr) < 24) return rtf.format(-hr, "hour")
  if (Math.abs(day) < 7) return rtf.format(-day, "day")

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    hour: "numeric",
    minute: "2-digit",
  })
}

/** Compact relative time for comment rows (e.g. 45m, 3h, 2d). */
export function formatCompactTime(iso: string | Date | undefined | null): string {
  if (!iso) return ""
  const date = iso instanceof Date ? iso : new Date(iso)
  if (Number.isNaN(date.getTime())) return ""

  const diffMs = Math.max(0, Date.now() - date.getTime())
  const sec = Math.floor(diffMs / 1000)
  const min = Math.floor(sec / 60)
  const hr = Math.floor(min / 60)
  const day = Math.floor(hr / 24)

  if (sec < 60) return "now"
  if (min < 60) return `${min}m`
  if (hr < 24) return `${hr}h`
  if (day < 7) return `${day}d`

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  })
}

/** True when the API sent a real edit timestamp (not likes / comments). */
export function hasEditedStamp(editedAt?: string | Date | null): boolean {
  if (editedAt == null || editedAt === "") return false
  const date = editedAt instanceof Date ? editedAt : new Date(editedAt)
  return !Number.isNaN(date.getTime())
}

/** Append a muted “Edited” marker after a time label. */
export function withEditedLabel(timeLabel: string, editedAt?: string | Date | null): string {
  if (!hasEditedStamp(editedAt)) return timeLabel
  return timeLabel ? `${timeLabel} · Edited` : "Edited"
}
