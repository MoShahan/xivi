/** Match backend `middleware/upload.js` Multer limit. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export const MAX_IMAGE_LABEL = "5 MB"

/** Lets phones offer Camera or Photo Library; `validateImageFile` still restricts types. */
export const ACCEPT_IMAGE = "image/*"

const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"])

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"])

const REJECTED_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
])

const REJECTED_EXTENSIONS = new Set([".heic", ".heif"])

const UNSUPPORTED_IMAGE =
  "Use a JPEG, PNG, GIF, or WebP. On a phone, pick from the photo library or take a JPEG — HEIC is not supported."

function fileExtension(name: string): string {
  const i = name.lastIndexOf(".")
  if (i < 0) return ""
  return name.slice(i).toLowerCase()
}

/** Client-side image checks before multipart upload. Returns an error message or null. */
export function validateImageFile(file: File): string | null {
  if (file.size > MAX_IMAGE_BYTES) {
    return `Image must be ${MAX_IMAGE_LABEL} or smaller`
  }

  const type = (file.type || "").toLowerCase()
  const ext = fileExtension(file.name)

  if (REJECTED_TYPES.has(type) || REJECTED_EXTENSIONS.has(ext)) {
    return UNSUPPORTED_IMAGE
  }

  if (ALLOWED_TYPES.has(type)) return null

  // Camera apps often omit MIME; allow empty type when the extension is usable or missing.
  if (!type && (!ext || ALLOWED_EXTENSIONS.has(ext))) return null

  return UNSUPPORTED_IMAGE
}
