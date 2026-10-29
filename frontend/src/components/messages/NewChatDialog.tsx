"use client"

import { useEffect, useState } from "react"
import { Close, Search } from "@mui/icons-material"
import {
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material"

import UserImage from "@/components/UserImage"
import { api } from "@/lib/api"
import { getErrorMessage } from "@/lib/errors"
import { openConversation } from "@/lib/messages"
import { displayName } from "@/lib/presence"
import type { Conversation } from "@/types/messages"
import type { DiscoverUser } from "@/types/models"

type NewChatDialogProps = {
  open: boolean
  onClose: () => void
  onOpened: (conversation: Conversation) => void
}

const NewChatDialog = ({ open, onClose, onOpened }: NewChatDialogProps) => {
  const [query, setQuery] = useState("")
  const [users, setUsers] = useState<DiscoverUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setQuery("")
      setUsers([])
      setError("")
      return
    }
    const t = window.setTimeout(() => {
      void (async () => {
        setLoading(true)
        setError("")
        try {
          const { data } = await api.get<{ users: DiscoverUser[] }>("/users/discover", {
            params: { limit: 12, ...(query.trim() ? { q: query.trim() } : {}) },
          })
          setUsers(data.users || [])
        } catch (err: unknown) {
          setError(getErrorMessage(err, "Could not search people"))
          setUsers([])
        } finally {
          setLoading(false)
        }
      })()
    }, 250)
    return () => window.clearTimeout(t)
  }, [open, query])

  const pick = async (userId: string) => {
    if (busyId) return
    setBusyId(userId)
    try {
      const conversation = await openConversation(userId)
      onOpened(conversation)
      onClose()
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not start conversation"))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: 1 }}>
        New chat
        <IconButton onClick={onClose} aria-label="Close">
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        <TextField
          autoFocus
          fullWidth
          size="small"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search people"
          autoComplete="off"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
          sx={{ mb: 1.5 }}
        />
        {error ? (
          <Typography color="error" sx={{ fontSize: "0.85rem", mb: 1 }}>
            {error}
          </Typography>
        ) : null}
        {loading ? (
          <CircularProgress size={22} sx={{ display: "block", mx: "auto", my: 2 }} />
        ) : (
          <List disablePadding>
            {users.length === 0 ? (
              <Typography sx={{ color: "text.secondary", fontSize: "0.9rem", py: 2, textAlign: "center" }}>
                No people found
              </Typography>
            ) : (
              users.map(user => {
                const name = displayName(user)
                return (
                  <ListItemButton
                    key={user._id}
                    onClick={() => void pick(user._id)}
                    disabled={busyId === user._id}
                    sx={{ borderRadius: 2, mb: 0.25 }}
                  >
                    <ListItemAvatar sx={{ minWidth: 48 }}>
                      <UserImage
                        image={user.picturePath || ""}
                        name={name}
                        size="40px"
                        bgColor={user.avatarColor}
                      />
                    </ListItemAvatar>
                    <ListItemText
                      primary={name}
                      secondary={user.occupation || user.location || undefined}
                      slotProps={{
                        primary: { noWrap: true, sx: { fontWeight: 600, fontSize: "0.9rem" } },
                        secondary: { noWrap: true, sx: { fontSize: "0.75rem" } },
                      }}
                    />
                  </ListItemButton>
                )
              })
            )}
          </List>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default NewChatDialog
