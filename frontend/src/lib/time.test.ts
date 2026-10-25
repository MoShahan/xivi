import { describe, expect, it } from "vitest"

import { formatCompactTime, withEditedLabel } from "./time"

describe("formatCompactTime", () => {
  it("returns empty string for missing dates", () => {
    expect(formatCompactTime(undefined)).toBe("")
    expect(formatCompactTime("not-a-date")).toBe("")
  })

  it("uses compact units for recent times", () => {
    const now = Date.now()
    expect(formatCompactTime(new Date(now - 10_000))).toBe("now")
    expect(formatCompactTime(new Date(now - 45 * 60_000))).toBe("45m")
    expect(formatCompactTime(new Date(now - 3 * 60 * 60_000))).toBe("3h")
    expect(formatCompactTime(new Date(now - 2 * 24 * 60 * 60_000))).toBe("2d")
  })
})

describe("withEditedLabel", () => {
  it("leaves the time alone when the post was not edited", () => {
    expect(withEditedLabel("3h", null)).toBe("3h")
    expect(withEditedLabel("3h", undefined)).toBe("3h")
  })

  it("appends Edited after a valid edit time", () => {
    expect(withEditedLabel("3h", "2026-10-25T10:00:00.000Z")).toBe("3h · Edited")
    expect(withEditedLabel("", "2026-10-25T10:00:00.000Z")).toBe("Edited")
  })
})
