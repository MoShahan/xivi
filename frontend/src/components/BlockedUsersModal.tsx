"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import CloseIcon from "@mui/icons-material/Close"
import {
  alpha,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material"

import { api } from "@/lib/api"
import { blockReasonLabel } from "@/lib/blockUser"
import { getErrorMessage } from "@/lib/errors"
import { useToast } from "@/providers/ToastProvider"
import type { BlockedUser, PaginatedBlocks } from "@/types/models"
import { friendIdOf } from "@/types/models"

import EmptyState from "./EmptyState"
import Friend from "./Friend"
import { PeopleListSkeleton, PeopleRowSkeleton } from "./skeletons"

const PAGE_LIMIT = 20

type BlockedUsersModalProps = {
  open: boolean
  onClose: () => void
  onChanged?: () => void
}

const BlockedUsersModal = ({ open, onClose, onChanged }: BlockedUsersModalProps) => {
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"))
  const dark = theme.palette.neutral.dark
  const isDark = theme.palette.mode === "dark"
  const { success, error: toastError } = useToast()

  const [people, setPeople] = useState<BlockedUser[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [listVersion, setListVersion] = useState(0)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [unblocking, setUnblocking] = useState(false)

  const scrollRootRef = useRef<HTMLDivElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const loadingMoreRef = useRef(false)

  const fetchKey = open ? `blocks:${listVersion}` : ""
  const [appliedFetchKey, setAppliedFetchKey] = useState(fetchKey)
  if (fetchKey && appliedFetchKey !== fetchKey) {
    setAppliedFetchKey(fetchKey)
    setPeople([])
    setNextCursor(null)
    setHasMore(false)
    setError(undefined)
    setLoading(true)
  }

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      try {
        const { data } = await api.get<PaginatedBlocks>("/users/me/blocks", {
          params: { limit: PAGE_LIMIT },
        })
        if (cancelled) return
        setPeople(Array.isArray(data.users) ? data.users : [])
        setNextCursor(data.nextCursor ?? null)
        setHasMore(Boolean(data.hasMore))
      } catch (err: unknown) {
        if (cancelled) return
        setError(getErrorMessage(err, "Failed to load blocked people"))
        setPeople([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, listVersion])

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || loadingMoreRef.current) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    try {
      const { data } = await api.get<PaginatedBlocks>("/users/me/blocks", {
        params: { limit: PAGE_LIMIT, cursor: nextCursor },
      })
      const next = Array.isArray(data.users) ? data.users : []
      setPeople(prev => {
        const seen = new Set(prev.map(p => String(p._id)))
        return [...prev, ...next.filter(p => !seen.has(String(p._id)))]
      })
      setNextCursor(data.nextCursor ?? null)
      setHasMore(Boolean(data.hasMore))
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load more"))
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [hasMore, nextCursor])

  useEffect(() => {
    if (!open || !hasMore || loading) return
    const root = scrollRootRef.current
    const sentinel = sentinelRef.current
    if (!root || !sentinel) return

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          void loadMore()
        }
      },
      { root, rootMargin: "120px", threshold: 0 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [open, hasMore, loading, people.length, loadMore])

  const confirmTarget = people.find(p => String(p._id) === confirmId)
  const confirmName = confirmTarget ? `${confirmTarget.firstName} ${confirmTarget.lastName}`.trim() : "this person"

  const handleUnblock = async () => {
    if (!confirmId || unblocking) return
    setUnblocking(true)
    try {
      await api.delete(`/users/${confirmId}/block`)
      setPeople(prev => prev.filter(p => String(p._id) !== confirmId))
      setConfirmId(null)
      success(`${confirmName} is unblocked`)
      onChanged?.()
      setListVersion(v => v + 1)
    } catch (err: unknown) {
      toastError(getErrorMessage(err, "Couldn’t unblock this person"))
    } finally {
      setUnblocking(false)
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        fullWidth
        fullScreen={fullScreen}
        maxWidth="xs"
        aria-labelledby="blocked-users-dialog-title"
        slotProps={{
          paper: {
            sx: {
              borderRadius: fullScreen ? 0 : 1,
              overflow: "hidden",
              backgroundImage: "none",
              border: fullScreen ? "none" : `1px solid ${theme.palette.divider}`,
              boxShadow: isDark
                ? `0 18px 48px ${alpha(theme.palette.common.black, 0.45)}`
                : `0 18px 48px ${alpha(theme.palette.common.black, 0.12)}`,
            },
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 2,
            pt: 1.5,
            pb: 1.25,
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography
            id="blocked-users-dialog-title"
            component="h2"
            sx={{ flex: 1, fontWeight: 700, fontSize: "1.05rem", color: dark }}
          >
            Blocked
          </Typography>
          <IconButton
            onClick={onClose}
            aria-label="Close"
            size="small"
            sx={{
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
              color: dark,
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <DialogContent
          ref={scrollRootRef}
          sx={{
            px: 1.5,
            py: 1.5,
            minHeight: fullScreen ? undefined : 200,
            height: fullScreen ? "100%" : "min(62dvh, 440px)",
            overflowY: "auto",
          }}
        >
          {loading ? (
            <PeopleListSkeleton count={6} />
          ) : error && people.length === 0 ? (
            <Typography sx={{ color: "error.main", textAlign: "center", py: 4 }} role="alert">
              {error}
            </Typography>
          ) : people.length === 0 ? (
            <EmptyState
              title="No blocked people"
              description="When you block someone, they’ll show up here so you can unblock them later."
            />
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.35 }}>
              {people.map(person => {
                const id = friendIdOf(person)
                return (
                  <Friend
                    key={id}
                    id={id}
                    name={`${person.firstName} ${person.lastName}`}
                    subtitle={blockReasonLabel(person.reason, person.customReason)}
                    url={person.picturePath ?? person.url ?? ""}
                    avatarColor={person.avatarColor}
                    avatarSize="40px"
                    showFriendButton={false}
                    listHover
                    onBeforeNavigate={onClose}
                    endAction={
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setConfirmId(id)}
                        sx={{ textTransform: "none", fontWeight: 700, flexShrink: 0 }}
                      >
                        Unblock
                      </Button>
                    }
                  />
                )
              })}
              <Box ref={sentinelRef} sx={{ height: 1 }} aria-hidden />
              {loadingMore ? (
                <Box role="status" aria-label="Loading more blocked people">
                  <PeopleRowSkeleton />
                  <PeopleRowSkeleton />
                </Box>
              ) : null}
              {error ? (
                <Typography sx={{ color: "error.main", fontSize: "0.8125rem", mt: 1 }} role="alert">
                  {error}
                </Typography>
              ) : null}
            </Box>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(confirmId)}
        onClose={() => (unblocking ? undefined : setConfirmId(null))}
        aria-labelledby="unblock-confirm-title"
      >
        <DialogTitle id="unblock-confirm-title">Unblock {confirmName}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You’ll be able to see each other’s posts, comments, and profiles again. You will not automatically become
            friends or follow each other.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmId(null)} disabled={unblocking} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            color="primary"
            variant="contained"
            onClick={() => void handleUnblock()}
            disabled={unblocking}
            autoFocus
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            {unblocking ? "Unblocking…" : "Unblock"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default BlockedUsersModal
