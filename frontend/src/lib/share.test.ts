import { describe, expect, it } from "vitest"

import { buildShareText, buildShareUrls } from "./share"

describe("buildShareText", () => {
  it("keeps emoji in a short post", () => {
    expect(buildShareText("hello 😂 world")).toBe("hello 😂 world")
  })

  it("does not split an emoji when truncating a long post", () => {
    const text = `${"😀".repeat(130)} more words here`
    const out = buildShareText(text)
    expect(out.endsWith("…")).toBe(true)
    expect(() => encodeURIComponent(out)).not.toThrow()
    expect(out).toContain("😀")
    expect(out).not.toMatch(/\uFFFD/)
  })
})

describe("buildShareUrls", () => {
  it("percent-encodes emoji on the WhatsApp URL", () => {
    const urls = buildShareUrls("abc123", {
      text: "hello 😂",
      origin: "https://xivi.example",
    })
    expect(urls.whatsapp).toContain("api.whatsapp.com/send")
    expect(urls.whatsapp).toContain(encodeURIComponent("hello 😂"))
    expect(urls.whatsapp).not.toContain("\uFFFD")
  })
})
