"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Check,
  HourglassEmpty,
  MailOutlined,
  PersonAddOutlined,
  PersonRemoveOutlined,
  RssFeed,
} from "@mui/icons-material"
import { alpha, Box, Button, CircularProgress, IconButton, Tooltip, useTheme } from "@mui/material"
import { useRouter } from "next/navigation"

import { useAppDispatch, useAppSelector } from "@/app/hooks"
import { api } from "@/lib/api"
import { getErrorMessage } from "@/lib/errors"
import { openConversation } from "@/lib/messages"
import { useFeatureFlags } from "@/providers/FeatureFlagsProvider"
import { useToast } from "@/providers/ToastProvider"
import { setFollowing, setFriends } from "@/state"
import { colorTokens } from "@/theme"
import type { Friend } from "@/types/models"
import type { UserRelationship } from "@/types/relationships"

type RelationshipActionsProps = {
  userId: string
  /** Prefill from list APIs (skips mount fetch). Still refreshed after mutations. */
  initial?: Partial<UserRelationship> | null
  onCover?: boolean
  /** Compact single-row for list cards. */
  dense?: boolean
  /** Fired after a successful friend/follow mutation (e.g. refresh profile counts). */
  onChanged?: () => void
}

function relFromInitial(initial?: Partial<UserRelationship> | null): UserRelationship {
  return {
    isFriend: Boolean(initial?.isFriend),
    isFollowing: Boolean(initial?.isFollowing),
    outgoingRequestId: initial?.outgoingRequestId ?? null,
    incomingRequestId: initial?.incomingRequestId ?? null,
    isSelf: Boolean(initial?.isSelf),
    blockedByMe: Boolean(initial?.blockedByMe),
  }
}

const chipBase = {
  flexShrink: 0,
  textTransform: "none" as const,
  fontWeight: 600,
  fontSize: "0.75rem",
  lineHeight: 1.2,
  minHeight: 28,
  px: 1.1,
  py: 0.35,
  borderRadius: 2,
}

/** Icon-only hit target for dense list rows (Add people rail, etc.). */
const iconChipBase = {
  flexShrink: 0,
  width: 32,
  height: 32,
  borderRadius: 2,
}

const RelationshipActions = ({
  userId,
  initial = null,
  onCover = false,
  dense = false,
  onChanged,
}: RelationshipActionsProps) => {
  const theme = useTheme()
  const dispatch = useAppDispatch()
  const loggedInId = useAppSelector(state => state.user?._id)
  const { success, error: toastError } = useToast()
  const router = useRouter()
  const { enabled } = useFeatureFlags()
  const canFriend = enabled("friendRequests")
  const canFollow = enabled("follow")
  const brand = theme.palette.primary.main
  const dark = theme.palette.neutral.dark
  const coverInk = colorTokens.stone[800]

  const [relUserId, setRelUserId] = useState(userId)
  const [rel, setRel] = useState<UserRelationship>(() => relFromInitial(initial))
  const [loading, setLoading] = useState(() => initial == null)
  const [busy, setBusy] = useState(false)
  const canMessage = enabled("messaging") && !rel.blockedByMe

  if (relUserId !== userId) {
    setRelUserId(userId)
    setRel(relFromInitial(initial))
    setLoading(initial == null)
  }

  const coverSurface = onCover
    ? {
        bgcolor: alpha(theme.palette.common.white, theme.palette.mode === "dark" ? 0.92 : 0.94),
        border: `1px solid ${alpha(theme.palette.common.black, 0.08)}`,
        boxShadow: `0 1px 2px ${alpha(theme.palette.common.black, 0.18)}`,
        color: coverInk,
        "& .MuiButton-startIcon, & .MuiSvgIcon-root": { color: "inherit" },
        "&:hover": {
          bgcolor: theme.palette.common.white,
          borderColor: alpha(brand, 0.35),
          color: brand,
        },
      }
    : {
        border: `1px solid ${theme.palette.divider}`,
        color: dark,
        bgcolor: "transparent",
        "&:hover": {
          bgcolor: alpha(brand, theme.palette.mode === "dark" ? 0.1 : 0.06),
          borderColor: alpha(brand, 0.45),
          color: brand,
        },
      }

  const activeSurface = onCover
    ? {
        ...coverSurface,
        color: brand,
      }
    : {
        color: brand,
        bgcolor: alpha(brand, theme.palette.mode === "dark" ? 0.16 : 0.1),
        border: `1px solid ${alpha(brand, 0.35)}`,
        "&:hover": {
          bgcolor: alpha(brand, theme.palette.mode === "dark" ? 0.22 : 0.14),
          borderColor: alpha(brand, 0.45),
          color: brand,
        },
      }

  const refresh = useCallback(async () => {
    if (!userId || !loggedInId) return
    try {
      const { data } = await api.get<{ relationship: UserRelationship }>(`/users/${userId}/relationship`)
      setRel(data.relationship)
    } catch {
      // keep last known
    } finally {
      setLoading(false)
    }
  }, [userId, loggedInId])

  useEffect(() => {
    if (!userId || !loggedInId) return
    // Discover / friends / followers / following already embed `relationship`.
    if (initial != null) return

    let cancelled = false
    void (async () => {
      try {
        const { data } = await api.get<{ relationship: UserRelationship }>(`/users/${userId}/relationship`)
        if (!cancelled) setRel(data.relationship)
      } catch {
        // keep last known
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, loggedInId, initial])

  if (!loggedInId || String(loggedInId) === String(userId) || rel.isSelf) {
    return null
  }

  if (!canFriend && !canFollow && !canMessage) {
    return null
  }

  if (loading) {
    return (
      <Box sx={{ display: "inline-flex", p: 0.5 }}>
        <CircularProgress size={18} />
      </Box>
    )
  }

  const run = async (fn: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    try {
      await fn()
      onChanged?.()
    } catch (err: unknown) {
      toastError(getErrorMessage(err, "Could not update"))
    } finally {
      setBusy(false)
    }
  }

  const sendRequest = () =>
    run(async () => {
      const { data } = await api.post<{ message: string; request?: { _id: string } }>(
        `/users/${userId}/friend-requests`
      )
      success(data.message || "Friend request sent")
      await refresh()
    })

  const cancelRequest = () =>
    run(async () => {
      if (!rel.outgoingRequestId) return
      await api.delete(`/users/me/friend-requests/${rel.outgoingRequestId}`)
      success("Friend request cancelled")
      await refresh()
    })

  const acceptRequest = () =>
    run(async () => {
      if (!rel.incomingRequestId) return
      const { data } = await api.post<{ message: string; friends: Friend[] }>(
        `/users/me/friend-requests/${rel.incomingRequestId}/accept`
      )
      dispatch(setFriends({ friends: data.friends }))
      success(data.message || "Friend request accepted")
      await refresh()
    })

  const declineRequest = () =>
    run(async () => {
      if (!rel.incomingRequestId) return
      await api.post(`/users/me/friend-requests/${rel.incomingRequestId}/decline`)
      success("Friend request declined")
      await refresh()
    })

  const removeFriend = () =>
    run(async () => {
      const { data } = await api.delete<{ message: string; friends: Friend[] }>(`/users/me/friends/${userId}`)
      dispatch(setFriends({ friends: data.friends }))
      success(data.message || "Friend removed")
      await refresh()
    })

  const toggleFollow = () =>
    run(async () => {
      if (rel.isFollowing) {
        const { data } = await api.delete<{ following: string[]; message: string }>(`/users/${userId}/follow`)
        dispatch(setFollowing({ following: data.following }))
        success(data.message || "Unfollowed")
      } else {
        const { data } = await api.post<{ following: string[]; message: string }>(`/users/${userId}/follow`)
        dispatch(setFollowing({ following: data.following }))
        success(data.message || "Following")
      }
      await refresh()
    })

  const followLabel = rel.isFollowing ? "Unfollow" : "Follow"
  const followTip = rel.isFollowing ? "Unfollow" : "Follow to see their posts in your feed"
  const followIcon = rel.isFollowing ? <Check sx={{ fontSize: "1.1rem" }} /> : <RssFeed sx={{ fontSize: "1.1rem" }} />
  const followSurface = rel.isFollowing ? activeSurface : coverSurface

  const startMessage = () =>
    run(async () => {
      const conversation = await openConversation(userId)
      router.push(`/messages/${conversation._id}`)
    })

  const messageButton = canMessage ? (
    <Tooltip title="Message">
      <span>
        {dense ? (
          <IconButton
            size="small"
            disabled={busy}
            onClick={() => void startMessage()}
            aria-label="Message"
            sx={{ ...iconChipBase, ...coverSurface }}
          >
            <MailOutlined sx={{ fontSize: "1.1rem" }} />
          </IconButton>
        ) : (
          <Button
            size="small"
            disabled={busy}
            onClick={() => void startMessage()}
            aria-label="Message"
            startIcon={<MailOutlined sx={{ fontSize: "1rem !important" }} />}
            sx={{ ...chipBase, ...coverSurface }}
          >
            Message
          </Button>
        )}
      </span>
    </Tooltip>
  ) : null

  if (dense) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 0.35,
          flexShrink: 0,
        }}
      >
        {messageButton}
        {canFollow ? (
          <Tooltip title={followTip}>
            <span>
              <IconButton
                size="small"
                disabled={busy}
                onClick={() => void toggleFollow()}
                aria-label={followLabel}
                aria-pressed={rel.isFollowing}
                sx={{ ...iconChipBase, ...followSurface }}
              >
                {followIcon}
              </IconButton>
            </span>
          </Tooltip>
        ) : null}

        {canFriend ? (
          rel.isFriend ? (
            <Tooltip title="Remove friend">
              <span>
                <IconButton
                  size="small"
                  disabled={busy}
                  onClick={() => void removeFriend()}
                  aria-label="Remove friend"
                  sx={{ ...iconChipBase, ...activeSurface }}
                >
                  <PersonRemoveOutlined sx={{ fontSize: "1.1rem" }} />
                </IconButton>
              </span>
            </Tooltip>
          ) : rel.incomingRequestId ? (
            <>
              <Tooltip title="Accept friend request">
                <span>
                  <IconButton
                    size="small"
                    disabled={busy}
                    onClick={() => void acceptRequest()}
                    aria-label="Accept friend request"
                    sx={{ ...iconChipBase, ...activeSurface }}
                  >
                    <Check sx={{ fontSize: "1.1rem" }} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Decline friend request">
                <span>
                  <IconButton
                    size="small"
                    disabled={busy}
                    onClick={() => void declineRequest()}
                    aria-label="Decline friend request"
                    sx={{ ...iconChipBase, ...coverSurface }}
                  >
                    <PersonRemoveOutlined sx={{ fontSize: "1.1rem" }} />
                  </IconButton>
                </span>
              </Tooltip>
            </>
          ) : rel.outgoingRequestId ? (
            <Tooltip title="Cancel friend request">
              <span>
                <IconButton
                  size="small"
                  disabled={busy}
                  onClick={() => void cancelRequest()}
                  aria-label="Cancel friend request"
                  sx={{ ...iconChipBase, ...coverSurface }}
                >
                  <HourglassEmpty sx={{ fontSize: "1.1rem" }} />
                </IconButton>
              </span>
            </Tooltip>
          ) : (
            <Tooltip title="Send friend request">
              <span>
                <IconButton
                  size="small"
                  disabled={busy}
                  onClick={() => void sendRequest()}
                  aria-label="Send friend request"
                  sx={{ ...iconChipBase, ...coverSurface }}
                >
                  <PersonAddOutlined sx={{ fontSize: "1.1rem" }} />
                </IconButton>
              </span>
            </Tooltip>
          )
        ) : null}
      </Box>
    )
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 0.75,
      }}
    >
      {messageButton}
      {canFollow ? (
        <Tooltip title={followTip}>
          <span>
            <Button
              size="small"
              disabled={busy}
              onClick={() => void toggleFollow()}
              aria-label={followLabel}
              aria-pressed={rel.isFollowing}
              startIcon={
                rel.isFollowing ? (
                  <Check sx={{ fontSize: "1rem !important" }} />
                ) : (
                  <RssFeed sx={{ fontSize: "1rem !important" }} />
                )
              }
              sx={{ ...chipBase, ...followSurface }}
            >
              {rel.isFollowing ? "Following" : "Follow"}
            </Button>
          </span>
        </Tooltip>
      ) : null}

      {canFriend ? (
        rel.isFriend ? (
          <Tooltip title="Remove friend">
            <span>
              <Button
                size="small"
                disabled={busy}
                onClick={() => void removeFriend()}
                aria-label="Remove friend"
                startIcon={<PersonRemoveOutlined sx={{ fontSize: "1rem !important" }} />}
                sx={{ ...chipBase, ...activeSurface }}
              >
                Friends
              </Button>
            </span>
          </Tooltip>
        ) : rel.incomingRequestId ? (
          <>
            <Tooltip title="Accept friend request">
              <span>
                <Button
                  size="small"
                  disabled={busy}
                  onClick={() => void acceptRequest()}
                  aria-label="Accept friend request"
                  sx={{ ...chipBase, ...activeSurface }}
                >
                  Accept
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Decline friend request">
              <span>
                <Button
                  size="small"
                  disabled={busy}
                  onClick={() => void declineRequest()}
                  aria-label="Decline friend request"
                  sx={{ ...chipBase, ...coverSurface }}
                >
                  Decline
                </Button>
              </span>
            </Tooltip>
          </>
        ) : rel.outgoingRequestId ? (
          <Tooltip title="Cancel friend request">
            <span>
              <Button
                size="small"
                disabled={busy}
                onClick={() => void cancelRequest()}
                aria-label="Cancel friend request"
                startIcon={<HourglassEmpty sx={{ fontSize: "1rem !important" }} />}
                sx={{ ...chipBase, ...coverSurface }}
              >
                Requested
              </Button>
            </span>
          </Tooltip>
        ) : (
          <Tooltip title="Send friend request">
            <span>
              <Button
                size="small"
                disabled={busy}
                onClick={() => void sendRequest()}
                aria-label="Send friend request"
                startIcon={<PersonAddOutlined sx={{ fontSize: "1rem !important" }} />}
                sx={{ ...chipBase, ...coverSurface }}
              >
                Friend
              </Button>
            </span>
          </Tooltip>
        )
      ) : null}
    </Box>
  )
}

export default RelationshipActions
