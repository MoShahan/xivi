import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { CUSTOM_REASON_MAX, parseBlockReason } from "./blocks.js"

describe("parseBlockReason", () => {
  it("accepts a preset and clears custom text", () => {
    assert.deepEqual(parseBlockReason({ reason: "harassment", customReason: "ignored" }), {
      reason: "harassment",
      customReason: "",
    })
    assert.equal(parseBlockReason({ reason: "spam" }).reason, "spam")
    assert.equal(parseBlockReason({ reason: "dont_want" }).reason, "dont_want")
    assert.equal(parseBlockReason({ reason: "hate_speech" }).reason, "hate_speech")
    assert.equal(parseBlockReason({ reason: "impersonation" }).reason, "impersonation")
    assert.equal(parseBlockReason({ reason: "fake_account" }).reason, "fake_account")
    assert.equal(parseBlockReason({ reason: "bullying" }).reason, "bullying")
    assert.equal(parseBlockReason({ reason: "offensive" }).reason, "offensive")
  })

  it("requires a non-empty custom reason for other", () => {
    assert.throws(
      () => parseBlockReason({ reason: "other" }),
      err => {
        assert.equal(err.status, 400)
        assert.equal(err.expose, true)
        return true
      }
    )
    assert.throws(
      () => parseBlockReason({ reason: "other", customReason: "   " }),
      err => {
        assert.equal(err.status, 400)
        return true
      }
    )
    assert.deepEqual(parseBlockReason({ reason: "other", customReason: "  too many DMs  " }), {
      reason: "other",
      customReason: "too many DMs",
    })
  })

  it("rejects unknown reasons and overlong custom text", () => {
    assert.throws(
      () => parseBlockReason({ reason: "nope" }),
      err => {
        assert.equal(err.status, 400)
        return true
      }
    )
    assert.throws(
      () => parseBlockReason({ reason: "other", customReason: "x".repeat(CUSTOM_REASON_MAX + 1) }),
      err => {
        assert.equal(err.status, 400)
        return true
      }
    )
  })
})
