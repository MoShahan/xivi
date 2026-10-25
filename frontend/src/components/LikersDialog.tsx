"use client"

import React, { useEffect, useState } from "react"
import { FavoriteOutlined } from "@mui/icons-material"
import CloseIcon from "@mui/icons-material/Close"
import {
  alpha,
  Box,
  Button,
  Dialog,
  DialogContent,
  IconButton,
  ListItemButton,
  Typography,
  useTheme,
} from "@mui/material"
import { useRouter } from "next/navigation"

import { useAppSelector } from "@/app/hooks"
import { api } from "@/lib/api"
import { getErrorMessage } from "@/lib/errors"
import { sameUserId } from "@/types/models"

import { PeopleListSkeleton } from "./skeletons"
import UserImage from "./UserImage"

export type Liker = {
  _id: string
  firstName: string
  lastName: string
  picturePath?: string
  avatarColor?: string
}

type LikersPageResponse = {
  likers: Liker[]
  page: number
  limit: number
  total: number
  hasMore: boolean
}

type LikersDialogProps = {
  open: boolean
  onClose: () => void
  /** Authenticated GET path returning a paginated `{ likers, page, limit, total, hasMore }`. */
  fetchPath: string | null
  title?: string
  /** Page size for each request (default 20). */
  pageSize?: number
}

type LikersListProps = {
  fetchPath: string
  pageSize: number
  onSelectUser: (userId: string) => void
}

const LikersList = ({ fetchPath, pageSize, onSelectUser }: LikersListProps) => {
  const theme = useTheme()
  const primary = theme.palette.primary.main
  const dark = theme.palette.neutral.dark
  const medium = theme.palette.neutral.medium
  const isDark = theme.palette.mode === "dark"

  const [likers, setLikers] = useState<Liker[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | undefined>()

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const { data } = await api.get<LikersPageResponse>(fetchPath, {
          params: { page: 1, limit: pageSize },
        })
        if (cancelled) return
        const nextLikers = Array.isArray(data.likers) ? data.likers : []
        setLikers(nextLikers)
        setPage(data.page ?? 1)
        setHasMore(Boolean(data.hasMore))
        setTotal(typeof data.total === "number" ? data.total : nextLikers.length)
        setError(undefined)
      } catch (err: unknown) {
        if (cancelled) return
        setError(getErrorMessage(err, "Failed to load likes"))
        setLikers([])
        setHasMore(false)
        setTotal(0)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [fetchPath, pageSize])

  const loadMore = async () => {
    try {
      setLoadingMore(true)
      setError(undefined)
      const nextPage = page + 1
      const { data } = await api.get<LikersPageResponse>(fetchPath, {
        params: { page: nextPage, limit: pageSize },
      })
      const nextLikers = Array.isArray(data.likers) ? data.likers : []
      setLikers(prev => [...prev, ...nextLikers])
      setPage(data.page ?? nextPage)
      setHasMore(Boolean(data.hasMore))
      if (typeof data.total === "number") setTotal(data.total)
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load more likes"))
    } finally {
      setLoadingMore(false)
    }
  }

  if (loading) {
    return <PeopleListSkeleton count={5} />
  }

  if (error && likers.length === 0) {
    return (
      <Box
        sx={{
          textAlign: "center",
          py: 4,
          px: 2,
          borderRadius: 2.5,
          border: `1px dashed ${theme.palette.divider}`,
          bgcolor: isDark ? alpha(theme.palette.common.white, 0.03) : alpha(theme.palette.common.black, 0.02),
        }}
        role="alert"
      >
        <Typography sx={{ color: "error.main", fontWeight: 600, mb: 0.5 }}>Couldn’t load likes</Typography>
        <Typography sx={{ color: medium, fontSize: "0.8125rem" }}>{error}</Typography>
      </Box>
    )
  }

  if (likers.length === 0) {
    return (
      <Box
        role="status"
        sx={{
          textAlign: "center",
          py: 4,
          px: 2,
          borderRadius: 2.5,
          border: `1px dashed ${theme.palette.divider}`,
          bgcolor: isDark ? alpha(theme.palette.common.white, 0.03) : alpha(theme.palette.common.black, 0.02),
        }}
      >
        <Box
          sx={{
            width: 48,
            height: 48,
            mx: "auto",
            mb: 1.25,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: alpha(primary, isDark ? 0.16 : 0.1),
            color: primary,
          }}
        >
          <FavoriteOutlined sx={{ fontSize: "1.35rem" }} />
        </Box>
        <Typography sx={{ color: dark, fontWeight: 600, mb: 0.35 }}>No likes yet</Typography>
        <Typography sx={{ color: medium, fontSize: "0.8125rem", lineHeight: 1.5 }}>
          When people like this, they’ll show up here.
        </Typography>
      </Box>
    )
  }

  return (
    <>
      {total > 0 && (
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.65,
            mb: 1.5,
            px: 1.1,
            py: 0.45,
            borderRadius: 2,
            bgcolor: alpha(primary, isDark ? 0.14 : 0.09),
            color: primary,
          }}
        >
          <FavoriteOutlined sx={{ fontSize: "0.9rem" }} />
          <Typography sx={{ fontWeight: 700, fontSize: "0.75rem", letterSpacing: "0.02em" }}>
            {total} {total === 1 ? "like" : "likes"}
          </Typography>
        </Box>
      )}

      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        {likers.map(liker => {
          const name = [liker.firstName, liker.lastName].filter(Boolean).join(" ").trim() || "User"
          return (
            <ListItemButton
              key={liker._id}
              aria-label={name}
              onClick={() => onSelectUser(liker._id)}
              sx={{ gap: 1.25, borderRadius: 1, px: 1.1, py: 0.85 }}
            >
              <Box
                sx={{
                  position: "relative",
                  flexShrink: 0,
                  borderRadius: "50%",
                  boxShadow: `0 0 0 2px ${alpha(primary, 0.18)}`,
                }}
              >
                <UserImage
                  image={liker.picturePath || ""}
                  name={name}
                  size="42px"
                  bgColor={liker.avatarColor}
                />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  noWrap
                  title={name}
                  sx={{
                    color: dark,
                    fontWeight: 600,
                    fontSize: "0.9375rem",
                    lineHeight: 1.35,
                  }}
                >
                  {name}
                </Typography>
              </Box>
            </ListItemButton>
          )
        })}
      </Box>

      {error && (
        <Typography sx={{ color: "error.main", mt: 1.25, fontSize: "0.8125rem" }} role="alert">
          {error}
        </Typography>
      )}

      {hasMore && (
        <Box sx={{ display: "flex", justifyContent: "center", pt: 1.75 }}>
          <Button
            onClick={() => void loadMore()}
            disabled={loadingMore}
            size="small"
            variant="outlined"
            sx={{
              textTransform: "none",
              fontWeight: 600,
              borderRadius: 2,
              px: 2,
              borderColor: theme.palette.divider,
              color: dark,
              "&:hover": {
                borderColor: alpha(primary, 0.45),
                bgcolor: alpha(primary, 0.06),
                color: primary,
              },
            }}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </Box>
      )}
    </>
  )
}

const LikersDialog = ({
  open,
  onClose,
  fetchPath,
  title = "Liked by",
  pageSize = 20,
}: LikersDialogProps) => {
  const theme = useTheme()
  const router = useRouter()
  const currentUserId = useAppSelector(state => state.user?._id)
  const primary = theme.palette.primary.main
  const dark = theme.palette.neutral.dark
  const isDark = theme.palette.mode === "dark"

  const goToProfile = (userId: string) => {
    onClose()
    if (sameUserId(currentUserId, userId)) {
      router.push("/profile")
    } else {
      router.push(`/profile/${userId}`)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      aria-labelledby="likers-dialog-title"
      slotProps={{
        paper: {
          sx: {
            borderRadius: 1,
            overflow: "hidden",
            backgroundImage: "none",
            border: `1px solid ${theme.palette.divider}`,
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
          gap: 1.25,
          px: 2.25,
          py: 1.6,
          borderBottom: `1px solid ${theme.palette.divider}`,
          bgcolor: isDark ? alpha(theme.palette.common.white, 0.03) : alpha(theme.palette.common.black, 0.015),
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: alpha(primary, isDark ? 0.18 : 0.12),
            color: primary,
            flexShrink: 0,
          }}
        >
          <FavoriteOutlined sx={{ fontSize: "1.1rem" }} />
        </Box>
        <Typography
          id="likers-dialog-title"
          component="h2"
          sx={{ flex: 1, fontWeight: 700, fontSize: "1.05rem", color: dark, letterSpacing: "-0.01em" }}
        >
          {title}
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
        sx={{
          minHeight: 160,
          maxHeight: "min(62dvh, 420px)",
          px: 1.75,
          py: 1.75,
        }}
      >
        {open && fetchPath ? (
          <LikersList
            key={fetchPath}
            fetchPath={fetchPath}
            pageSize={pageSize}
            onSelectUser={goToProfile}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

export default LikersDialog
