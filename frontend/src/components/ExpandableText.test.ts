import { describe, expect, it } from "vitest"

import { truncateText } from "./ExpandableText"

describe("truncateText", () => {
  it("keeps internal newlines when the post is short", () => {
    const text = "hello\nworld"
    expect(truncateText(text, 40, 280)).toEqual({ preview: text, needsExpand: false })
  })

  it("does not collapse newlines when cutting by word count", () => {
    const line = "one two three four five"
    const text = `${line}\n${line}\n${line}`
    const { preview, needsExpand } = truncateText(text, 8, 280)
    expect(needsExpand).toBe(true)
    expect(preview).toContain("\n")
    expect(preview.startsWith("one two three four five\none two three")).toBe(true)
  })
})
