"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { Box, Button, Typography, useTheme } from "@mui/material"
import { useRouter } from "next/navigation"

import { api } from "@/lib/api"
import { getErrorMessage } from "@/lib/errors"
import {
  liveFeedChipLabel,
  mergePendingPosts,
  newestCreatedAt,
  shouldMergePolledPost,
  splitLiveFeedPage,
  startLiveFeedPoll,
} from "@/lib/liveFeed"
import { useToast } from "@/providers/ToastProvider"
import { appendPosts, prependPosts, setPost, setPosts } from "@/state"
import { store } from "@/state/store"
import type { PaginatedPosts, Post } from "@/types/models"

import { useAppDispatch, useAppSelector } from "../app/hooks"

import EmptyState from "./EmptyState"
import PostWidget from "./PostWidget"
import { PostCardSkeleton, PostsFeedSkeleton } from "./skeletons"

/** Which post list to load. */
export type PostsListKind = "feed" | "friends" | "authored" | "saved" | "liked" | "commented"

type PostsWidgetProps = {
  list?: PostsListKind
  /** Required for `authored` (and legacy `isProfile`). */
  userId?: string
  /** @deprecated Prefer `list="authored"`. */
  isProfile?: boolean
  /** Switch home feed to Everyone (Following empty-state CTA). */
  onBrowseEveryone?: () => void
}

const EMPTY_COPY: Record<PostsListKind, { title: string; description: string }> = {
  feed: {
    title: "Nothing here yet",
    description: "When people post, their updates will show up in Everyone.",
  },
  friends: {
    title: "Nothing from people you follow yet",
    description:
      "Find people from the menu or People page, send friend requests or follow them, then check back here - or browse Everyone for the wider feed.",
  },
  authored: {
    title: "No posts yet",
    description: "Share something from Home - it will appear here on this profile.",
  },
  saved: {
    title: "No saved posts",
    description: "Bookmark posts you want to revisit and they’ll collect here.",
  },
  liked: {
    title: "No liked posts",
    description: "Posts you like will show up in this list.",
  },
  commented: {
    title: "No commented posts",
    description: "Posts you’ve commented on will appear here.",
  },
}

const PAGE_LIMIT = 10

function resolveList(list: PostsListKind | undefined, isProfile: boolean): PostsListKind {
  if (list) return list
  return isProfile ? "authored" : "feed"
}

function usesCursorPagination(_kind: PostsListKind): boolean {
  return true
}

function listSupportsLiveUpdates(kind: PostsListKind): boolean {
  return kind === "feed" || kind === "friends" || kind === "authored"
}

function pathForList(
  kind: PostsListKind,
  userId: string,
  opts?: { cursor?: string | null; since?: string | null }
): string {
  const params = new URLSearchParams({ limit: String(PAGE_LIMIT) })
  if (opts?.since) params.set("since", opts.since)
  else if (opts?.cursor) params.set("cursor", opts.cursor)

  switch (kind) {
    case "feed":
      params.set("scope", "all")
      return `/posts?${params}`
    case "friends":
      params.set("scope", "friends")
      return `/posts?${params}`
    case "authored":
      return `/posts/${userId}/posts?${params}`
    case "saved":
      return `/posts/saved?${params}`
    case "liked":
      return `/posts/liked?${params}`
    case "commented":
      return `/posts/commented?${params}`
  }
}

const PostsWidget = ({ list, userId = "", isProfile = false, onBrowseEveryone }: PostsWidgetProps) => {
  const dispatch = useAppDispatch()
  const router = useRouter()
  const posts = useAppSelector(state => state.posts)
  const theme = useTheme()
  const { error: toastError } = useToast()
  const kind = resolveList(list, isProfile)
  const paginated = usesCursorPagination(kind)

  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const loadingMoreRef = useRef(false)

  const [pendingNew, setPendingNew] = useState<Post[]>([])
  const [pendingHasMore, setPendingHasMore] = useState(false)

  const loadKey = kind === "authored" ? `authored:${userId}` : kind
  const liveEnabled = listSupportsLiveUpdates(kind)

  useEffect(() => {
    if (kind === "authored" && !userId) return

    let cancelled = false
    void (async () => {
      try {
        setLoading(true)
        setLoadError(null)
        setLoadMoreError(null)
        setNextCursor(null)
        setHasMore(false)
        setPendingNew([])
        setPendingHasMore(false)
        const path = pathForList(kind, userId)
        const { data } = await api.get<PaginatedPosts>(path)
        if (cancelled) return
        dispatch(setPosts({ posts: data.posts || [] }))
        setNextCursor(data.nextCursor)
        setHasMore(Boolean(data.hasMore))
        setLoadedFor(loadKey)
      } catch {
        if (!cancelled) {
          setLoadError("Couldn’t load posts. Try refreshing the page.")
          dispatch(setPosts({ posts: [] }))
          setLoadedFor(loadKey)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [kind, userId, loadKey, dispatch, paginated])

  const loadMore = useCallback(async () => {
    if (!paginated || !hasMore || !nextCursor || loadingMoreRef.current) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    setLoadMoreError(null)
    try {
      const path = pathForList(kind, userId, { cursor: nextCursor })
      const { data } = await api.get<PaginatedPosts>(path)
      dispatch(appendPosts({ posts: data.posts || [] }))
      setNextCursor(data.nextCursor)
      setHasMore(Boolean(data.hasMore))
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Couldn’t load more posts")
      setLoadMoreError(msg)
      toastError(msg)
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [
    paginated,
    hasMore,
    nextCursor,
    kind,
    userId,
    dispatch,
    toastError,
    setLoadingMore,
    setLoadMoreError,
    setNextCursor,
    setHasMore,
  ])

  useEffect(() => {
    // Pause auto-fetch while an error is showing so we don't spam retries.
    if (!paginated || !hasMore || loadMoreError) return
    const el = sentinelRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          void loadMore()
        }
      },
      { rootMargin: "240px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [paginated, hasMore, loadMore, loadMoreError, loadedFor, posts.length])

  useEffect(() => {
    if (!liveEnabled || loading || loadedFor !== loadKey || loadError) return
    if (kind === "authored" && !userId) return

    let cancelled = false
    const tick = async () => {
      try {
        const current = store.getState().posts
        const since = newestCreatedAt(current)
        const currentIds = current.map(post => String(post._id))

        if (since) {
          const { data } = await api.get<PaginatedPosts>(pathForList(kind, userId, { since }))
          if (cancelled) return
          const { pendingNew: incoming } = splitLiveFeedPage(data.posts || [], currentIds)
          setPendingNew(prev => mergePendingPosts(prev, incoming))
          setPendingHasMore(Boolean(data.hasMore))
        }

        const { data: page } = await api.get<PaginatedPosts>(pathForList(kind, userId))
        if (cancelled) return
        const latest = store.getState().posts
        for (const post of page.posts || []) {
          const local = latest.find(item => String(item._id) === String(post._id))
          if (!shouldMergePolledPost(local)) continue
          dispatch(setPost({ post }))
        }

        if (!since) {
          const { pendingNew: incoming } = splitLiveFeedPage(
            page.posts || [],
            latest.map(post => String(post._id))
          )
          setPendingNew(prev => mergePendingPosts(prev, incoming))
          setPendingHasMore(Boolean(page.hasMore))
        }
      } catch {
        // Keep the last good snapshot; live polls should not toast.
      }
    }

    const stop = startLiveFeedPoll(() => {
      void tick()
    })
    return () => {
      cancelled = true
      stop()
    }
  }, [liveEnabled, loading, loadedFor, loadKey, loadError, kind, userId, dispatch])

  const visiblePending = pendingNew.filter(post => !posts.some(existing => String(existing._id) === String(post._id)))

  const showNewPosts = () => {
    if (!visiblePending.length) return
    dispatch(prependPosts({ posts: visiblePending }))
    setPendingNew([])
    setPendingHasMore(false)
  }

  const newPostsChip =
    visiblePending.length > 0 ? (
      <Box sx={{ display: "flex", justifyContent: "center" }} aria-live="polite">
        <Button
          size="small"
          variant="outlined"
          onClick={showNewPosts}
          sx={{
            textTransform: "none",
            fontWeight: 600,
            position: "sticky",
            top: 8,
            zIndex: 2,
            bgcolor: "background.paper",
          }}
        >
          {liveFeedChipLabel(visiblePending.length, pendingHasMore)}
        </Button>
      </Box>
    ) : null

  if (loading || loadedFor !== loadKey) {
    return <PostsFeedSkeleton count={3} />
  }

  if (loadError) {
    return <EmptyState title="Something went wrong" description={loadError} />
  }

  if (!posts.length) {
    const copy = EMPTY_COPY[kind]
    const cta =
      kind === "friends"
        ? {
            actionLabel: "Browse Everyone",
            onAction: () => {
              if (onBrowseEveryone) onBrowseEveryone()
              else router.push("/home?feed=everyone")
            },
          }
        : kind === "authored"
          ? { actionLabel: "Go to Home", onAction: () => router.push("/home") }
          : kind === "feed"
            ? undefined
            : { actionLabel: "Browse feed", onAction: () => router.push("/home") }
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {newPostsChip}
        <EmptyState
          title={copy.title}
          description={copy.description}
          actionLabel={cta?.actionLabel}
          onAction={cta?.onAction}
        />
      </Box>
    )
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {newPostsChip}
      {posts.map((post, index) => (
        <Box
          key={post._id}
          sx={{
            "@keyframes postEnter": {
              from: { opacity: 0, transform: "translateY(8px)" },
              to: { opacity: 1, transform: "translateY(0)" },
            },
            animation: "postEnter 0.35s ease both",
            animationDelay: `${Math.min(index, 8) * 40}ms`,
          }}
        >
          <PostWidget post={post} />
        </Box>
      ))}
      {paginated && hasMore && !loadMoreError ? (
        <Box ref={sentinelRef} role="status" aria-live="polite">
          {loadingMore ? <PostCardSkeleton /> : <Box sx={{ height: 1 }} aria-hidden />}
        </Box>
      ) : null}
      {loadMoreError ? (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1,
            py: 1.5,
          }}
        >
          <Typography sx={{ color: "error.main", fontSize: "0.875rem", textAlign: "center" }} role="alert">
            {loadMoreError}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            disabled={loadingMore}
            onClick={() => void loadMore()}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {loadingMore ? "Loading…" : "Try again"}
          </Button>
        </Box>
      ) : null}
      {paginated && !hasMore && !loadMoreError && posts.length > 0 ? (
        <Typography sx={{ color: theme.palette.neutral.medium, textAlign: "center", py: 1 }}>
          You’re all caught up.
        </Typography>
      ) : null}
    </Box>
  )
}

export default PostsWidget
