import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { allowsClientImageMime } from "../middleware/upload.js"

describe("allowsClientImageMime", () => {
  it("accepts known image types", () => {
    assert.equal(allowsClientImageMime("image/jpeg"), true)
    assert.equal(allowsClientImageMime("image/jpg"), true)
    assert.equal(allowsClientImageMime("image/png"), true)
  })

  it("accepts empty or generic MIME from phone cameras", () => {
    assert.equal(allowsClientImageMime(""), true)
    assert.equal(allowsClientImageMime(undefined), true)
    assert.equal(allowsClientImageMime("application/octet-stream"), true)
  })

  it("rejects HEIC and non-images", () => {
    assert.equal(allowsClientImageMime("image/heic"), false)
    assert.equal(allowsClientImageMime("application/pdf"), false)
  })
})
