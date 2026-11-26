import { describe, expect, it } from "vitest"

import { linkifyText, toSafeHttpHref } from "./linkify"

describe("toSafeHttpHref", () => {
  it("accepts https URLs", () => {
    expect(toSafeHttpHref("https://example.com/path")).toBe("https://example.com/path")
  })

  it("normalizes www. to https", () => {
    expect(toSafeHttpHref("www.example.com")).toBe("https://www.example.com/")
  })

  it("rejects non-http schemes", () => {
    expect(toSafeHttpHref("javascript:alert(1)")).toBeNull()
    expect(toSafeHttpHref("data:text/html,hi")).toBeNull()
    expect(toSafeHttpHref("file:///etc/passwd")).toBeNull()
  })
})

describe("linkifyText", () => {
  it("returns a single text part when there are no URLs", () => {
    expect(linkifyText("hello world")).toEqual([{ type: "text", value: "hello world" }])
  })

  it("linkifies a single https URL", () => {
    expect(linkifyText("see https://example.com now")).toEqual([
      { type: "text", value: "see " },
      { type: "link", value: "https://example.com", href: "https://example.com/" },
      { type: "text", value: " now" },
    ])
  })

  it("linkifies multiple URLs", () => {
    const parts = linkifyText("a https://a.com b https://b.com/c")
    expect(parts.filter(p => p.type === "link")).toEqual([
      { type: "link", value: "https://a.com", href: "https://a.com/" },
      { type: "link", value: "https://b.com/c", href: "https://b.com/c" },
    ])
  })

  it("maps www. to an https href", () => {
    expect(linkifyText("go www.example.com")).toEqual([
      { type: "text", value: "go " },
      { type: "link", value: "www.example.com", href: "https://www.example.com/" },
    ])
  })

  it("keeps trailing punctuation outside the href", () => {
    expect(linkifyText("Visit https://example.com.")).toEqual([
      { type: "text", value: "Visit " },
      { type: "link", value: "https://example.com", href: "https://example.com/" },
      { type: "text", value: "." },
    ])
  })

  it("does not turn javascript: into a link", () => {
    expect(linkifyText("bad javascript:alert(1) ok")).toEqual([
      { type: "text", value: "bad javascript:alert(1) ok" },
    ])
  })

  it("preserves newlines around links", () => {
    expect(linkifyText("line1\nhttps://example.com\nline3")).toEqual([
      { type: "text", value: "line1\n" },
      { type: "link", value: "https://example.com", href: "https://example.com/" },
      { type: "text", value: "\nline3" },
    ])
  })

  it("returns empty array for empty input", () => {
    expect(linkifyText("")).toEqual([])
  })
})
