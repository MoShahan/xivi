import { afterEach, describe, expect, it, vi } from "vitest"

import {
  hasOptimisticComments,
  liveFeedChipLabel,
  mergePendingPosts,
  newestCreatedAt,
  scrollFeedToTop,
  shouldAutoRevealNewPosts,
  shouldMergePolledPost,
  splitLiveFeedPage,
  startLiveFeedPoll,
} from "./liveFeed"

describe("newestCreatedAt", () => {
  it("returns the latest valid createdAt", () => {
    expect(newestCreatedAt([])).toBeNull()
    expect(newestCreatedAt([{ createdAt: "not-a-date" }])).toBeNull()
    expect(
      newestCreatedAt([
        { createdAt: "2026-01-01T00:00:00.000Z" },
        { createdAt: "2026-01-03T00:00:00.000Z" },
        { createdAt: "2026-01-02T00:00:00.000Z" },
      ])
    ).toBe("2026-01-03T00:00:00.000Z")
  })
})

describe("hasOptimisticComments", () => {
  it("detects temp comment ids", () => {
    expect(hasOptimisticComments({ comments: [{ _id: "abc" }] })).toBe(false)
    expect(hasOptimisticComments({ comments: [{ _id: "temp-1" }] })).toBe(true)
    expect(hasOptimisticComments({ comments: [] })).toBe(false)
    expect(shouldMergePolledPost(undefined)).toBe(false)
    expect(shouldMergePolledPost({ comments: [{ _id: "temp-9" }] })).toBe(false)
    expect(shouldMergePolledPost({ comments: [{ _id: "c1" }] })).toBe(true)
  })
})

describe("splitLiveFeedPage", () => {
  it("separates new ids from posts already on the client", () => {
    const { pendingNew, existing } = splitLiveFeedPage(
      [
        { _id: "a", createdAt: "2026-01-02T00:00:00.000Z" },
        { _id: "b", createdAt: "2026-01-01T00:00:00.000Z" },
      ],
      ["b"]
    )
    expect(pendingNew.map(p => p._id)).toEqual(["a"])
    expect(existing.map(p => p._id)).toEqual(["b"])
  })
})

describe("mergePendingPosts", () => {
  it("dedupes by id and sorts newest first", () => {
    const merged = mergePendingPosts(
      [{ _id: "old", createdAt: "2026-01-01T00:00:00.000Z" }],
      [
        { _id: "old", createdAt: "2026-01-01T00:00:00.000Z" },
        { _id: "new", createdAt: "2026-01-03T00:00:00.000Z" },
        { _id: "mid", createdAt: "2026-01-02T00:00:00.000Z" },
      ]
    )
    expect(merged.map(p => p._id)).toEqual(["new", "mid", "old"])
  })
})

describe("shouldAutoRevealNewPosts", () => {
  it("auto-reveals at the top or when the list is empty", () => {
    expect(shouldAutoRevealNewPosts(true, 5)).toBe(true)
    expect(shouldAutoRevealNewPosts(false, 0)).toBe(true)
    expect(shouldAutoRevealNewPosts(false, 5)).toBe(false)
  })
})

describe("liveFeedChipLabel", () => {
  it("uses a generic label when more pages exist", () => {
    expect(liveFeedChipLabel(1, false)).toBe("1 new post")
    expect(liveFeedChipLabel(3, false)).toBe("3 new posts")
    expect(liveFeedChipLabel(10, true)).toBe("New posts")
  })
})

describe("scrollFeedToTop", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("is a no-op without window", () => {
    scrollFeedToTop()
  })

  it("scrolls the window to the top", () => {
    const scrollTo = vi.fn()
    vi.stubGlobal("window", { scrollTo })
    vi.stubGlobal("document", { getElementById: () => null })
    scrollFeedToTop()
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" })
  })
})

describe("startLiveFeedPoll", () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("is a no-op without window", () => {
    const onTick = vi.fn()
    const stop = startLiveFeedPoll(onTick, 1_000)
    stop()
    expect(onTick).not.toHaveBeenCalled()
  })

  it("ticks on the interval only while the tab is visible", () => {
    vi.useFakeTimers()
    const onTick = vi.fn()
    let hidden = false
    vi.stubGlobal("document", {
      get hidden() {
        return hidden
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    vi.stubGlobal("window", {
      setInterval: (handler: TimerHandler, timeout?: number) => globalThis.setInterval(handler, timeout),
      clearInterval: (id: ReturnType<typeof setInterval>) => globalThis.clearInterval(id),
    })

    const stop = startLiveFeedPoll(onTick, 1_000)
    expect(onTick).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1_000)
    expect(onTick).toHaveBeenCalledTimes(1)
    hidden = true
    vi.advanceTimersByTime(1_000)
    expect(onTick).toHaveBeenCalledTimes(1)
    stop()
  })
})
