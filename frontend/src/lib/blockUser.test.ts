import { describe, expect, it } from "vitest"

import { blockReasonLabel, blockUserSchema, CUSTOM_REASON_MAX } from "./blockUser"

describe("blockUserSchema", () => {
  it("accepts a preset reason without custom text", async () => {
    await expect(blockUserSchema.validate({ reason: "harassment", customReason: "" })).resolves.toMatchObject({
      reason: "harassment",
    })
    await expect(blockUserSchema.validate({ reason: "hate_speech", customReason: "" })).resolves.toMatchObject({
      reason: "hate_speech",
    })
    await expect(blockUserSchema.validate({ reason: "impersonation", customReason: "" })).resolves.toMatchObject({
      reason: "impersonation",
    })
  })

  it("requires a reason", async () => {
    await expect(blockUserSchema.validate({ reason: "", customReason: "" })).rejects.toBeTruthy()
  })

  it("requires custom text when reason is other", async () => {
    await expect(blockUserSchema.validate({ reason: "other", customReason: "   " })).rejects.toBeTruthy()
    await expect(blockUserSchema.validate({ reason: "other", customReason: "too many DMs" })).resolves.toMatchObject({
      reason: "other",
      customReason: "too many DMs",
    })
  })

  it("rejects overlong custom text", async () => {
    await expect(
      blockUserSchema.validate({
        reason: "other",
        customReason: "x".repeat(CUSTOM_REASON_MAX + 1),
      })
    ).rejects.toBeTruthy()
  })
})

describe("blockReasonLabel", () => {
  it("maps presets and falls back to custom text", () => {
    expect(blockReasonLabel("spam")).toBe("Spam")
    expect(blockReasonLabel("hate_speech")).toBe("Hate speech")
    expect(blockReasonLabel("impersonation")).toBe("Pretending to be someone else")
    expect(blockReasonLabel("fake_account")).toBe("Fake account")
    expect(blockReasonLabel("other", "too many DMs")).toBe("too many DMs")
    expect(blockReasonLabel("other", "")).toBe("Other")
  })
})
