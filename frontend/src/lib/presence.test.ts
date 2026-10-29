import { describe, expect, it } from "vitest"

import { displayName, formatLastSeen } from "./presence"

describe("formatLastSeen", () => {
  const now = Date.parse("2026-10-30T15:00:00.000Z")

  it("returns Online when the user is connected", () => {
    expect(formatLastSeen(true, "2026-10-01T00:00:00.000Z", now)).toBe("Online")
  })

  it("returns empty string when there is no last-seen time", () => {
    expect(formatLastSeen(false, null, now)).toBe("")
    expect(formatLastSeen(false, "not-a-date", now)).toBe("")
  })

  it("uses relative copy for recent activity", () => {
    expect(formatLastSeen(false, new Date(now - 10_000), now)).toBe("Last seen just now")
    expect(formatLastSeen(false, new Date(now - 12 * 60_000), now)).toBe("Last seen 12m ago")
  })
})

describe("displayName", () => {
  it("joins first and last, with a fallback", () => {
    expect(displayName({ firstName: "Ada", lastName: "Lovelace" })).toBe("Ada Lovelace")
    expect(displayName(null)).toBe("Someone")
  })
})
