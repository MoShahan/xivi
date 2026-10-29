import { describe, expect, it } from "vitest"

import { isMessageRead } from "./messages"

describe("isMessageRead", () => {
  it("is false without timestamps", () => {
    expect(isMessageRead(null, "2026-10-30T12:00:00.000Z")).toBe(false)
    expect(isMessageRead("2026-10-30T12:00:00.000Z", null)).toBe(false)
  })

  it("is true when the other person read at or after the message", () => {
    expect(isMessageRead("2026-10-30T12:00:00.000Z", "2026-10-30T12:00:00.000Z")).toBe(true)
    expect(isMessageRead("2026-10-30T12:00:00.000Z", "2026-10-30T12:01:00.000Z")).toBe(true)
    expect(isMessageRead("2026-10-30T12:01:00.000Z", "2026-10-30T12:00:00.000Z")).toBe(false)
  })
})
