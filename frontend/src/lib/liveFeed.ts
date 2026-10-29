/** How often Home / profile / post pages refetch for live updates. */
export const LIVE_FEED_POLL_MS = 60_000

export const OPTIMISTIC_COMMENT_PREFIX = "temp-"

type IdPost = { _id: string; createdAt?: string }
type CommentLike = { _id?: string }

/** Newest `createdAt` in the list, or null if none are valid dates. */
export function newestCreatedAt(posts: { createdAt?: string }[]): string | null {
  let newest: string | null = null
  let newestMs = Number.NEGATIVE_INFINITY
  for (const post of posts) {
    if (!post.createdAt) continue
    const ms = Date.parse(post.createdAt)
    if (!Number.isNaN(ms) && ms > newestMs) {
      newestMs = ms
      newest = post.createdAt
    }
  }
  return newest
}

export function hasOptimisticComments(post: { comments?: CommentLike[] } | null | undefined): boolean {
  return (post?.comments ?? []).some(comment => String(comment._id ?? "").startsWith(OPTIMISTIC_COMMENT_PREFIX))
}

export function shouldMergePolledPost(local: { comments?: CommentLike[] } | undefined): boolean {
  if (!local) return false
  return !hasOptimisticComments(local)
}

/**
 * Split a polled page into posts the client already has vs posts that should
 * wait behind the "new posts" chip.
 */
export function splitLiveFeedPage<T extends IdPost>(
  polled: T[],
  existingIds: Iterable<string>
): { pendingNew: T[]; existing: T[] } {
  const seen = new Set([...existingIds].map(String))
  const pendingNew: T[] = []
  const existing: T[] = []
  for (const post of polled) {
    if (seen.has(String(post._id))) existing.push(post)
    else pendingNew.push(post)
  }
  return { pendingNew, existing }
}

/** Dedupe by id, keep incoming snapshots, newest first. */
export function mergePendingPosts<T extends IdPost>(pending: T[], incoming: T[]): T[] {
  const byId = new Map(pending.map(post => [String(post._id), post]))
  for (const post of incoming) {
    byId.set(String(post._id), post)
  }
  return [...byId.values()].sort((a, b) => {
    const aMs = Date.parse(a.createdAt ?? "")
    const bMs = Date.parse(b.createdAt ?? "")
    const aOk = !Number.isNaN(aMs)
    const bOk = !Number.isNaN(bMs)
    if (aOk && bOk) return bMs - aMs
    if (bOk) return 1
    if (aOk) return -1
    return 0
  })
}

/** Insert new posts immediately when the viewer is at the top (or the list is empty). */
export function shouldAutoRevealNewPosts(atTop: boolean, loadedPostCount: number): boolean {
  return atTop || loadedPostCount === 0
}

export function liveFeedChipLabel(count: number, hasMore: boolean): string {
  if (hasMore || count > 1) {
    if (hasMore) return "New posts"
    return `${count} new posts`
  }
  if (count === 1) return "1 new post"
  return "New posts"
}

/** Scroll the window (and `#main-content` if it scrolls) to the top of the feed. */
export function scrollFeedToTop(): void {
  if (typeof window === "undefined") return
  window.scrollTo({ top: 0, behavior: "smooth" })
  const main = typeof document !== "undefined" ? document.getElementById("main-content") : null
  if (main && main.scrollTop > 0) {
    main.scrollTo({ top: 0, behavior: "smooth" })
  }
}

/**
 * Call `onTick` every `intervalMs` while the document is visible.
 * Pauses when the tab is hidden; ticks once when it becomes visible again.
 */
export function startLiveFeedPoll(onTick: () => void, intervalMs: number = LIVE_FEED_POLL_MS): () => void {
  if (typeof window === "undefined") return () => {}

  const run = () => {
    if (typeof document !== "undefined" && document.hidden) return
    onTick()
  }

  const id = window.setInterval(run, intervalMs)
  const onVisibility = () => {
    if (!document.hidden) onTick()
  }
  document.addEventListener("visibilitychange", onVisibility)

  return () => {
    window.clearInterval(id)
    document.removeEventListener("visibilitychange", onVisibility)
  }
}
