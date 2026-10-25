import { describe, expect, it } from "vitest"

import { MAX_IMAGE_BYTES, validateImageFile } from "./imageUpload"

function file(name: string, type: string, size = 32): File {
  return new File([new Uint8Array(size)], name, { type })
}

describe("validateImageFile", () => {
  it("accepts common web image types", () => {
    expect(validateImageFile(file("a.jpg", "image/jpeg"))).toBeNull()
    expect(validateImageFile(file("a.jpg", "image/jpg"))).toBeNull()
    expect(validateImageFile(file("a.png", "image/png"))).toBeNull()
  })

  it("accepts camera files with an empty MIME when the extension is usable or missing", () => {
    expect(validateImageFile(file("IMG_0001.jpg", ""))).toBeNull()
    expect(validateImageFile(file("photo", ""))).toBeNull()
  })

  it("rejects HEIC and unknown types with a library/JPEG hint", () => {
    const heic = validateImageFile(file("IMG_0001.HEIC", "image/heic"))
    expect(heic).toMatch(/photo library/i)
    expect(heic).toMatch(/HEIC/i)
    expect(validateImageFile(file("notes.pdf", "application/pdf"))).toMatch(/JPEG/)
    expect(validateImageFile(file("notes.pdf", ""))).toMatch(/JPEG/)
  })

  it("rejects oversized files", () => {
    expect(validateImageFile(file("huge.jpg", "image/jpeg", MAX_IMAGE_BYTES + 1))).toMatch(
      /5 MB/
    )
  })
})
