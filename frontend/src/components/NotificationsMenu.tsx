"use client"

import { useCallback, useEffect, useState } from "react"
import { Notifications } from "@mui/icons-material"
import {
  Badge,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Menu,
  Typography,
  useTheme,
} from "@mui/material"
import { useRouter } from "next/navigation"

import NotificationActorAvatar from "@/components/NotificationActorAvatar"
import { notificationRowSx } from "@/components/sharedSx"
import { api } from "@/lib/api"
import { notificationCopy, notificationHref } from "@/lib/notifications"
import { sameUserId } from "@/types/models"
import type { AppNotification } from "@/types/notifications"

const NotificationsMenu = () => {
  const theme = useTheme()
  const router = useRouter()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [items, setItems] = useState<AppNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)

  const open = Boolean(anchorEl)

  const refreshUnread = useCallback(async () => {
    try {
      const { data } = await api.get<{ count: number }>("/notifications/unread-count")
      setUnread(data.count || 0)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    const boot = window.setTimeout(() => void refreshUnread(), 0)
    const id = window.setInterval(() => void refreshUnread(), 60_000)
    return () => {
      window.clearTimeout(boot)
      window.clearInterval(id)
    }
  }, [refreshUnread])

  const loadList = async () => {
    setLoading(true)
    try {
      const { data } = await api.get<{ notifications: AppNotification[] }>("/notifications?limit=8")
      setItems(data.notifications || [])
      await refreshUnread()
    } finally {
      setLoading(false)
    }
  }

  const handleOpen = async (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget)
    await loadList()
  }

  const handleClose = () => setAnchorEl(null)

  const handleMarkAll = async () => {
    await api.patch("/notifications/read-all")
    setItems(prev => prev.map(n => ({ ...n, read: true })))
    setUnread(0)
  }

  const handleSeeAll = () => {
    handleClose()
    router.push("/notifications")
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
    handleClose()
    const href = notificationHref(n)
    if (href) router.push(href)
  }

  return (
    <>
      <IconButton
        data-tour="notifications"
        onClick={handleOpen}
        aria-label="Notifications"
        aria-haspopup="true"
      >
        <Badge badgeContent={unread} color="primary" max={99}>
          <Notifications sx={{ fontSize: "25px" }} />
        </Badge>
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        slotProps={{
          paper: {
            sx: { width: 340, maxWidth: "90vw", maxHeight: 420 },
          },
        }}
      >
        <Box sx={{ px: 2, py: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Notifications
          </Typography>
          <Button size="small" onClick={handleMarkAll} disabled={!unread}>
            Mark all read
          </Button>
        </Box>
        <Divider />
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress size={28} />
          </Box>
        ) : !items.length ? (
          <Typography sx={{ px: 2, py: 2, color: theme.palette.neutral.medium }}>
            No notifications yet.
          </Typography>
        ) : (
          <List dense disablePadding>
            {items.map(n => {
              const actorName =
                `${n.actor?.firstName || ""} ${n.actor?.lastName || ""}`.trim() || "Someone"
              return (
                <ListItemButton
                  key={n._id}
                  onClick={() => void handleClickItem(n)}
                  sx={notificationRowSx(n.read, "menu")}
                >
                  <ListItemAvatar sx={{ minWidth: 52, mt: 0.25, overflow: "visible" }}>
                    <NotificationActorAvatar
                      image={n.actor?.picturePath || ""}
                      name={actorName}
                      type={n.type}
                      size="40px"
                      bgColor={n.actor?.avatarColor}
                    />
                  </ListItemAvatar>
                  <ListItemText
                    primary={notificationCopy(n)}
                    secondary={n.createdAt ? new Date(n.createdAt).toLocaleString() : undefined}
                    slotProps={{
                      primary: { sx: { fontSize: "0.9rem", fontWeight: n.read ? 400 : 600 } },
                      secondary: { sx: { fontSize: "0.75rem" } },
                    }}
                  />
                </ListItemButton>
              )
            })}
          </List>
        )}
        <Divider />
        <Box sx={{ px: 1, py: 0.5 }}>
          <Button fullWidth size="small" onClick={handleSeeAll}>
            See all notifications
          </Button>
        </Box>
      </Menu>
    </>
  )
}

export default NotificationsMenu
