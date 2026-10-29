import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { createdAtFilter, parseCursorPagination } from "./pagination.js"

describe("parseCursorPagination", () => {
  it("defaults limit and leaves dates unset", () => {
    const parsed = parseCursorPagination({})
    assert.equal(parsed.limit, 10)
    assert.equal(parsed.cursorDate, null)
    assert.equal(parsed.sinceDate, null)
  })

  it("parses since and cursor ISO dates", () => {
    const since = parseCursorPagination({ since: "2026-01-02T00:00:00.000Z" })
    assert.equal(since.sinceDate?.toISOString(), "2026-01-02T00:00:00.000Z")
    assert.equal(since.cursorDate, null)

    const cursor = parseCursorPagination({ cursor: "2026-01-01T00:00:00.000Z" })
    assert.equal(cursor.cursorDate?.toISOString(), "2026-01-01T00:00:00.000Z")
    assert.equal(cursor.sinceDate, null)
  })

  it("ignores invalid dates", () => {
    const parsed = parseCursorPagination({ since: "not-a-date", cursor: "nope" })
    assert.equal(parsed.sinceDate, null)
    assert.equal(parsed.cursorDate, null)
  })

  it("lets since win when both since and cursor are present", () => {
    const parsed = parseCursorPagination({
      since: "2026-01-02T00:00:00.000Z",
      cursor: "2026-01-01T00:00:00.000Z",
    })
    assert.equal(parsed.sinceDate?.toISOString(), "2026-01-02T00:00:00.000Z")
    assert.equal(parsed.cursorDate, null)
  })
})

describe("createdAtFilter", () => {
  it("prefers since over cursor", () => {
    const sinceDate = new Date("2026-01-02T00:00:00.000Z")
    const cursorDate = new Date("2026-01-01T00:00:00.000Z")
    assert.deepEqual(createdAtFilter({ sinceDate, cursorDate }), { createdAt: { $gt: sinceDate } })
    assert.deepEqual(createdAtFilter({ cursorDate }), { createdAt: { $lt: cursorDate } })
    assert.deepEqual(createdAtFilter({}), {})
  })
})
