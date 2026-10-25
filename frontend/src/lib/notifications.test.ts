import { describe, expect, it } from "vitest"

import { notificationTypeKind, notificationTypeLabel } from "./notifications"

describe("notificationTypeKind", () => {
  it("maps likes to the heart badge", () => {
    expect(notificationTypeKind("post_like")).toBe("like")
    expect(notificationTypeKind("comment_like")).toBe("like")
  })

  it("maps comments and friend events", () => {
    expect(notificationTypeKind("comment")).toBe("comment")
    expect(notificationTypeKind("friend_request")).toBe("friend_request")
    expect(notificationTypeKind("friend_accept")).toBe("friend")
    expect(notificationTypeKind("friend")).toBe("friend")
  })
})

describe("notificationTypeLabel", () => {
  it("returns a short glance label for each type", () => {
    expect(notificationTypeLabel("post_like")).toBe("Post like")
    expect(notificationTypeLabel("comment")).toBe("Comment")
    expect(notificationTypeLabel("friend_request")).toBe("Friend request")
    expect(notificationTypeLabel("friend_accept")).toBe("Friend")
  })
})
