import { describe, expect, it } from "vitest"

import {
  getActiveMentionQuery,
  pruneMentionedUserIds,
  splitRichText,
  textContainsMention,
} from "./mentions"

describe("getActiveMentionQuery", () => {
  it("detects an @ query at the cursor", () => {
    expect(getActiveMentionQuery("hi @Ad", 6)).toEqual({ start: 3, query: "Ad" })
  })

  it("allows spaces while composing a full name", () => {
    expect(getActiveMentionQuery("hi @Ada Lov", 11)).toEqual({ start: 3, query: "Ada Lov" })
  })

  it("ignores emails and mid-word ats", () => {
    expect(getActiveMentionQuery("a@b.com", 7)).toBeNull()
    expect(getActiveMentionQuery("hello@", 6)).toBeNull()
    expect(getActiveMentionQuery("hello @", 7)).toEqual({ start: 6, query: "" })
  })
})

describe("textContainsMention", () => {
  it("matches a bounded @First Last token", () => {
    expect(textContainsMention("Hey @Ada Lovelace!", "Ada Lovelace")).toBe(true)
    expect(textContainsMention("Hey @Ada LovelaceX", "Ada Lovelace")).toBe(false)
  })
})

describe("pruneMentionedUserIds", () => {
  it("drops ids whose display no longer appears", () => {
    expect(
      pruneMentionedUserIds("plain text", ["u1"], [{ userId: "u1", display: "Ada Lovelace" }])
    ).toEqual([])
    expect(
      pruneMentionedUserIds("hi @Ada Lovelace", ["u1"], [{ userId: "u1", display: "Ada Lovelace" }])
    ).toEqual(["u1"])
  })
})

describe("splitRichText", () => {
  it("linkifies mentions and urls together", () => {
    const parts = splitRichText("see @Ada Lovelace and https://example.com", [
      { userId: "u1", display: "Ada Lovelace" },
    ])
    expect(parts).toEqual([
      { type: "text", value: "see " },
      { type: "mention", value: "@Ada Lovelace", userId: "u1" },
      { type: "text", value: " and " },
      { type: "link", value: "https://example.com", href: "https://example.com/" },
    ])
  })

  it("prefers longer display names when overlapping", () => {
    const parts = splitRichText("hi @Anna", [
      { userId: "short", display: "Ann" },
      { userId: "long", display: "Anna" },
    ])
    expect(parts).toContainEqual({ type: "mention", value: "@Anna", userId: "long" })
  })
})
