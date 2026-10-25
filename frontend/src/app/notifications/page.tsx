"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Typography,
  useTheme,
} from "@mui/material"
import { useRouter } from "next/navigation"

import AppShell from "@/components/AppShell"
import NotificationActorAvatar from "@/components/NotificationActorAvatar"
import { notificationRowSx } from "@/components/sharedSx"
import { api } from "@/lib/api"
import { notificationCopy, notificationHref } from "@/lib/notifications"
import { sameUserId } from "@/types/models"
import type { AppNotification } from "@/types/notifications"

const PAGE_LIMIT = 20

type NotificationsPageResponse = {
  notifications: AppNotification[]
  nextCursor: string | null
  hasMore: boolean
}

const NotificationsPage = () => {
  const theme = useTheme()
  const router = useRouter()
  const [items, setItems] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [unread, setUnread] = useState(0)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const loadingMoreRef = useRef(false)

  const refreshUnread = useCallback(async () => {
    try {
      const { data } = await api.get<{ count: number }>("/notifications/unread-count")
      setUnread(data.count || 0)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        setLoading(true)
        const { data } = await api.get<NotificationsPageResponse>(
          `/notifications?limit=${PAGE_LIMIT}`
        )
        if (cancelled) return
        setItems(data.notifications || [])
        setNextCursor(data.nextCursor)
        setHasMore(Boolean(data.hasMore))
        await refreshUnread()
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshUnread])

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || loadingMoreRef.current) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_LIMIT),
        cursor: nextCursor,
      })
      const { data } = await api.get<NotificationsPageResponse>(`/notifications?${params}`)
      setItems(prev => {
        const seen = new Set(prev.map(n => String(n._id)))
        const extras = (data.notifications || []).filter(n => !seen.has(String(n._id)))
        return [...prev, ...extras]
      })
      setNextCursor(data.nextCursor)
      setHasMore(Boolean(data.hasMore))
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [hasMore, nextCursor])

  useEffect(() => {
    if (!hasMore) return
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) void loadMore()
      },
      { rootMargin: "200px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loadMore, items.length])

  const handleMarkAll = async () => {
    await api.patch("/notifications/read-all")
    setItems(prev => prev.map(n => ({ ...n, read: true })))
    setUnread(0)
  }

  const handleClickItem = async (n: AppNotification) => {
    if (!n.read) {
      try {
        await api.patch(`/notifications/${n._id}/read`)
        setItems(prev => prev.map(x => (sameUserId(x._id, n._id) ? { ...x, read: true } : x)))
        setUnread(c => Math.max(0, c - 1))
      } catch {
        // ignore
      }
    }
    const href = notificationHref(n)
    if (href) router.push(href)
  }

  return (
    <AppShell narrow>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1.5,
            mb: 1.5,
            flexWrap: "wrap",
          }}
        >
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 600, color: theme.palette.neutral.dark }}>
              Notifications
            </Typography>
            {unread > 0 ? (
              <Typography variant="body2" sx={{ color: theme.palette.neutral.medium, mt: 0.35 }}>
                {unread} unread
              </Typography>
            ) : null}
          </Box>
          <Button size="small" variant="outlined" onClick={() => void handleMarkAll()} disabled={!unread}>
            Mark all read
          </Button>
        </Box>

        <Divider sx={{ mb: 1 }} />

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }} role="status">
            <CircularProgress />
          </Box>
        ) : !items.length ? (
          <Typography sx={{ color: theme.palette.neutral.medium, textAlign: "center", py: 4 }}>
            No notifications yet.
          </Typography>
        ) : (
          <List disablePadding>
            {items.map(n => {
              const actorName = `${n.actor?.firstName || ""} ${n.actor?.lastName || ""}`.trim() || "Someone"
              return (
                <ListItemButton
                  key={n._id}
                  onClick={() => void handleClickItem(n)}
                  sx={notificationRowSx(n.read, "page")}
                >
                  <ListItemAvatar sx={{ minWidth: 60, mt: 0.5, overflow: "visible" }}>
                    <NotificationActorAvatar
                      image={n.actor?.picturePath || ""}
                      name={actorName}
                      type={n.type}
                      size="48px"
                      bgColor={n.actor?.avatarColor}
                    />
                  </ListItemAvatar>
                  <ListItemText
                    primary={notificationCopy(n)}
                    secondary={n.createdAt ? new Date(n.createdAt).toLocaleString() : undefined}
                    slotProps={{
                      primary: { sx: { fontWeight: n.read ? 400 : 600 } },
                      secondary: { sx: { mt: 0.5 } },
                    }}
                  />
                </ListItemButton>
              )
            })}
            {hasMore ? (
              <Box
                ref={sentinelRef}
                sx={{ display: "flex", justifyContent: "center", py: 2 }}
                role="status"
              >
                {loadingMore ? <CircularProgress size={28} /> : null}
              </Box>
            ) : (
              <Typography
                sx={{ color: theme.palette.neutral.medium, textAlign: "center", py: 2 }}
              >
                You’re all caught up.
              </Typography>
            )}
          </List>
        )}
    </AppShell>
  )
}

export default NotificationsPage
