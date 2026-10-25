"use client"

import React, { useEffect, useMemo, useState } from "react"
import {
  CalendarMonthOutlined,
  Facebook,
  Instagram,
  LinkedIn,
  LocationOnOutlined,
  ManageAccountsOutlined,
  WorkOutlineOutlined,
  X,
} from "@mui/icons-material"
import {
  alpha,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Link,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material"
import { usePathname, useRouter } from "next/navigation"

import { useAppSelector } from "@/app/hooks"
import { api } from "@/lib/api"
import { getErrorMessage } from "@/lib/errors"
import {
  DEFAULT_AVATAR_COLOR,
  DEFAULT_COVER_COLOR,
  normalizeProfileColor,
} from "@/lib/profileColors"
import { SOCIAL_NETWORKS, type SocialNetwork, socialProfileUrl } from "@/lib/social"
import { formatJoinedDate } from "@/lib/time"
import { useFeatureFlags } from "@/providers/FeatureFlagsProvider"
import { useToast } from "@/providers/ToastProvider"
import type { PeopleListTab, User } from "@/types/models"
import { sameUserId } from "@/types/models"

import EditProfileDialog from "./EditProfileDialog"
import EmptyState from "./EmptyState"
import FlexBetween from "./FlexBetween"
import PeopleListModal from "./PeopleListModal"
import RelationshipActions from "./RelationshipActions"
import { ProfileWidgetSkeleton } from "./skeletons"
import UserImage from "./UserImage"
import WidgetWrapper from "./WidgetWrapper"

type UserWidgetProps = {
  userId: string
  url: string
  /** When set by the profile page, preferred over id comparison. */
  isOwnProfile?: boolean
}

const SOCIAL_ICONS: Record<SocialNetwork, React.ReactNode> = {
  facebook: <Facebook fontSize="small" />,
  x: <X fontSize="small" />,
  linkedin: <LinkedIn fontSize="small" />,
  instagram: <Instagram fontSize="small" />,
}

const UserWidget = ({ userId, url, isOwnProfile: isOwnProfileProp }: UserWidgetProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const loggedInUser = useAppSelector(state => state.user)
  const { success, error: toastError } = useToast()
  const theme = useTheme()
  const { palette } = theme
  const dark = palette.neutral.dark
  const medium = palette.neutral.medium
  const main = palette.neutral.main

  const [loadedUserId, setLoadedUserId] = useState(userId)
  const [fetched, setFetched] = useState<User | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)

  if (loadedUserId !== userId) {
    setLoadedUserId(userId)
    setFetched(null)
    setProfileLoading(Boolean(userId))
    setProfileError(null)
  }
  const [editOpen, setEditOpen] = useState(false)
  const [modBusy, setModBusy] = useState(false)
  const [peopleModalTab, setPeopleModalTab] = useState<PeopleListTab | null>(null)
  const { enabled } = useFeatureFlags()
  const canEditProfile = enabled("profileEdit")

  const loadProfile = (opts?: { silent?: boolean }) => {
    if (!userId) return
    void (async () => {
      try {
        if (!opts?.silent) {
          setProfileLoading(true)
          setProfileError(null)
        }
        const { data } = await api.get<User>(`/users/${userId}`)
        setFetched(data)
        setProfileError(null)
      } catch (err: unknown) {
        // Silent refresh keeps last known profile; full load surfaces the error.
        if (!opts?.silent) {
          setProfileError(getErrorMessage(err, "Couldn’t load this profile"))
        }
      } finally {
        if (!opts?.silent) setProfileLoading(false)
      }
    })()
  }

  const refreshProfile = () => {
    loadProfile({ silent: true })
  }

  const isOwnProfile = isOwnProfileProp ?? sameUserId(loggedInUser?._id, userId)
  const viewerIsAdmin = loggedInUser?.role === "admin"

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void (async () => {
      try {
        const { data } = await api.get<User>(`/users/${userId}`)
        if (!cancelled) {
          setFetched(data)
          setProfileError(null)
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setFetched(null)
          setProfileError(getErrorMessage(err, "Couldn’t load this profile"))
        }
      } finally {
        if (!cancelled) setProfileLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  const user = useMemo(() => {
    if (!fetched || !sameUserId(fetched._id, userId)) return null
    if (isOwnProfile && loggedInUser && sameUserId(loggedInUser._id, userId)) {
      return {
        ...fetched,
        firstName: loggedInUser.firstName,
        lastName: loggedInUser.lastName,
        location: loggedInUser.location,
        occupation: loggedInUser.occupation,
        picturePath: loggedInUser.picturePath,
        avatarColor: loggedInUser.avatarColor ?? fetched.avatarColor,
        coverColor: loggedInUser.coverColor ?? fetched.coverColor,
        facebook: loggedInUser.facebook,
        x: loggedInUser.x,
        linkedin: loggedInUser.linkedin,
        instagram: loggedInUser.instagram,
        friends: loggedInUser.friends ?? fetched.friends,
        following: loggedInUser.following ?? fetched.following,
        friendCount: fetched.friendCount ?? loggedInUser.friendCount,
        followerCount: fetched.followerCount ?? loggedInUser.followerCount,
        followingCount: fetched.followingCount ?? loggedInUser.followingCount,
        role: loggedInUser.role ?? fetched.role,
        isActive: loggedInUser.isActive ?? fetched.isActive,
        // Prefer API value so visit counts stay current after others view the profile.
        viewedProfile: fetched.viewedProfile ?? loggedInUser.viewedProfile,
      }
    }
    return fetched
  }, [fetched, userId, isOwnProfile, loggedInUser])

  // Already on this profile (own `/profile` or `/profile/:id`) - don't re-navigate.
  const alreadyOnThisProfile =
    Boolean(userId) &&
    (pathname === `/profile/${userId}` || (isOwnProfile && (pathname === "/profile" || pathname === `/profile/${userId}`)))

  const handleGoToProfile = () => {
    if (!userId || alreadyOnThisProfile) return
    if (isOwnProfile) {
      router.push("/profile")
    } else {
      router.push(`/profile/${userId}`)
    }
  }

  if (profileLoading && !user) {
    return <ProfileWidgetSkeleton />
  }

  if (profileError && !user) {
    return (
      <EmptyState
        title="Couldn’t load profile"
        description={profileError}
        actionLabel="Try again"
        onAction={() => loadProfile()}
      />
    )
  }

  if (!user) {
    return <ProfileWidgetSkeleton />
  }

  const displayUrl = url || user.picturePath || ""
  const friendCount =
    typeof user.friendCount === "number"
      ? user.friendCount
      : Array.isArray(user.friends)
        ? user.friends.length
        : 0
  const followerCount = typeof user.followerCount === "number" ? user.followerCount : 0
  const followingCount =
    typeof user.followingCount === "number"
      ? user.followingCount
      : Array.isArray(user.following)
        ? user.following.length
        : 0
  const avatarColor = normalizeProfileColor(user.avatarColor, DEFAULT_AVATAR_COLOR)
  const coverColor = normalizeProfileColor(user.coverColor, DEFAULT_COVER_COLOR)

  const statButtonSx = {
    cursor: "pointer",
    border: "none",
    background: "none",
    p: 0,
    m: 0,
    font: "inherit",
    color: "inherit",
    textAlign: "left" as const,
    borderRadius: 1,
    "&:hover": { color: palette.primary.main },
    "&:focus-visible": {
      outline: `2px solid ${palette.primary.main}`,
      outlineOffset: 2,
    },
  }

  const activeSocials = SOCIAL_NETWORKS.filter(({ key }) => Boolean((user[key] || "").trim())).map(
    ({ key, label }) => ({
      key,
      label,
      handle: (user[key] || "").trim(),
      href: socialProfileUrl(key, user[key]),
    })
  )

  const coverRadius = `${Number(theme.shape.borderRadius) * 1.25}px`

  return (
    <WidgetWrapper sx={{ p: 0, overflow: "visible" }}>
      <Box
        sx={{
          height: { xs: 96, sm: 112 },
          bgcolor: coverColor,
          position: "relative",
          borderTopLeftRadius: coverRadius,
          borderTopRightRadius: coverRadius,
          backgroundImage: theme =>
            `linear-gradient(180deg, ${alpha(theme.palette.common.black, 0)} 40%, ${alpha(theme.palette.common.black, 0.12)} 100%)`,
        }}
      >
        {isOwnProfile ? null : (
          <Box sx={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}>
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.75 }}>
              <RelationshipActions userId={userId} onCover onChanged={refreshProfile} />
              {viewerIsAdmin && user.role !== "admin" ? (
                <Button
                  size="small"
                  color={user.isActive === false ? "primary" : "error"}
                  variant="contained"
                  disabled={modBusy}
                  onClick={() => {
                    void (async () => {
                      setModBusy(true)
                      try {
                        if (user.isActive === false) {
                          const { data } = await api.post<{ message: string; user: User }>(
                            `/users/${userId}/reactivate`
                          )
                          setFetched(prev => (prev ? { ...prev, ...data.user } : data.user))
                          success(data.message || "User reactivated")
                        } else {
                          if (
                            !window.confirm(
                              `Deactivate ${user.firstName} ${user.lastName}? They will not be able to log in.`
                            )
                          ) {
                            return
                          }
                          const { data } = await api.post<{ message: string; user: User }>(
                            `/users/${userId}/deactivate`
                          )
                          setFetched(prev => (prev ? { ...prev, ...data.user } : data.user))
                          success(data.message || "User deactivated")
                        }
                      } catch (err: unknown) {
                        toastError(getErrorMessage(err, "Could not update user status"))
                      } finally {
                        setModBusy(false)
                      }
                    })()
                  }}
                  sx={{
                    textTransform: "none",
                    fontWeight: 600,
                    fontSize: "0.75rem",
                    bgcolor: theme => alpha(theme.palette.common.white, 0.94),
                    color: user.isActive === false ? "primary.main" : "error.main",
                    "&:hover": { bgcolor: "common.white" },
                  }}
                >
                  {user.isActive === false ? "Reactivate" : "Deactivate"}
                </Button>
              ) : null}
            </Box>
          </Box>
        )}
      </Box>

      <Box sx={{ px: "1.15rem", pb: "1.15rem", pt: 0, position: "relative", zIndex: 1 }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 0.35,
            pb: "0.95rem",
            mt: "-2.35rem",
          }}
        >
          <Box
            onClick={handleGoToProfile}
            onKeyDown={e => {
              if (alreadyOnThisProfile) return
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                handleGoToProfile()
              }
            }}
            role={alreadyOnThisProfile ? undefined : "link"}
            tabIndex={alreadyOnThisProfile ? undefined : 0}
            sx={{
              cursor: alreadyOnThisProfile ? "default" : "pointer",
              borderRadius: "50%",
              border: theme => `3px solid ${theme.palette.background.paper}`,
              boxShadow: theme => `0 0 0 1px ${theme.palette.divider}`,
              position: "relative",
              zIndex: 1,
              flexShrink: 0,
              "&:focus-visible": {
                outline: `2px solid ${palette.primary.main}`,
                outlineOffset: 2,
              },
            }}
          >
            <UserImage
              image={displayUrl}
              name={`${user.firstName} ${user.lastName}`}
              size="64px"
              bgColor={avatarColor}
            />
          </Box>
          <Box sx={{ minWidth: 0, width: "100%", pt: "0.35rem" }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 0.75,
                minWidth: 0,
              }}
            >
              <Typography
                variant="h4"
                onClick={handleGoToProfile}
                noWrap
                title={`${user.firstName} ${user.lastName}`}
                sx={{
                  color: dark,
                  fontWeight: 700,
                  lineHeight: 1.25,
                  fontSize: "1.2rem",
                  minWidth: 0,
                  cursor: alreadyOnThisProfile ? "default" : "pointer",
                  ...(!alreadyOnThisProfile && {
                    "&:hover": {
                      color: palette.primary.main,
                    },
                  }),
                }}
              >
                {user.firstName} {user.lastName}
              </Typography>
              {user.role === "admin" ? (
                <Chip
                  label="Admin"
                  size="small"
                  color="primary"
                  variant="outlined"
                  aria-label="Admin role"
                  sx={{
                    height: 22,
                    fontWeight: 700,
                    fontSize: "0.7rem",
                    letterSpacing: "0.02em",
                    borderWidth: 1.5,
                  }}
                />
              ) : null}
            </Box>
            {isOwnProfile && canEditProfile ? (
              <Button
                size="small"
                variant="outlined"
                startIcon={<ManageAccountsOutlined />}
                onClick={() => setEditOpen(true)}
                sx={{
                  mt: 1,
                  textTransform: "none",
                  fontWeight: 700,
                  borderRadius: 2,
                  px: 1.5,
                }}
              >
                Edit profile
              </Button>
            ) : null}
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: { xs: 1.25, sm: 1.75 },
                mt: 0.35,
              }}
              role="group"
              aria-label="Connection counts"
            >
              {(
                [
                  {
                    key: "friends" as const,
                    count: friendCount,
                    singular: "friend",
                    plural: "friends",
                  },
                  {
                    key: "followers" as const,
                    count: followerCount,
                    singular: "follower",
                    plural: "followers",
                  },
                  {
                    key: "following" as const,
                    count: followingCount,
                    singular: "following",
                    plural: "following",
                  },
                ] as const
              ).map(stat => (
                <Typography
                  key={stat.key}
                  component="button"
                  type="button"
                  variant="body2"
                  onClick={() => setPeopleModalTab(stat.key)}
                  aria-label={`View ${stat.count} ${stat.count === 1 ? stat.singular : stat.plural}`}
                  sx={{ ...statButtonSx, color: medium, fontWeight: 500 }}
                >
                  <Box component="span" sx={{ color: dark, fontWeight: 700, mr: 0.4 }}>
                    {stat.count}
                  </Box>
                  {stat.count === 1 ? stat.singular : stat.plural}
                </Typography>
              ))}
            </Box>
          </Box>
        </Box>

        <Divider />

        <Box sx={{ py: "0.7rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
            <LocationOnOutlined sx={{ fontSize: "1.05rem", color: main }} />
            <Typography variant="body2" sx={{ color: medium }}>
              {user.location?.trim() || "-"}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
            <WorkOutlineOutlined sx={{ fontSize: "1.05rem", color: main }} />
            <Typography variant="body2" sx={{ color: medium }}>
              {user.occupation?.trim() || "-"}
            </Typography>
          </Box>
          {formatJoinedDate(user.createdAt) ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
              <CalendarMonthOutlined sx={{ fontSize: "1.05rem", color: main }} />
              <Typography variant="body2" sx={{ color: medium }}>
                {formatJoinedDate(user.createdAt)}
              </Typography>
            </Box>
          ) : null}
        </Box>

        <Divider />

        <Box sx={{ py: "0.7rem" }}>
          <FlexBetween>
            <Typography variant="body2" sx={{ color: medium }}>
              Profile visits
            </Typography>
            <Typography variant="body2" sx={{ color: main, fontWeight: 600 }}>
              {user.viewedProfile || 0}
            </Typography>
          </FlexBetween>
        </Box>

        {activeSocials.length > 0 ? (
          <>
            <Divider />
            <Box sx={{ pt: "0.75rem", display: "flex", flexWrap: "wrap", gap: 0.75 }}>
              {activeSocials.map(item =>
                item.href ? (
                  <Tooltip key={item.key} title={`${item.label}: @${item.handle}`}>
                    <IconButton
                      component={Link}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="small"
                      aria-label={`${item.label} profile`}
                      sx={{
                        color: main,
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 2,
                        "&:hover": {
                          color: palette.primary.main,
                          borderColor: alpha(palette.primary.main, 0.35),
                          bgcolor: alpha(palette.primary.main, 0.06),
                        },
                      }}
                    >
                      {SOCIAL_ICONS[item.key]}
                    </IconButton>
                  </Tooltip>
                ) : null
              )}
            </Box>
          </>
        ) : null}
      </Box>

      {isOwnProfile ? (
        <EditProfileDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          user={user}
          onSaved={saved => setFetched(saved)}
        />
      ) : null}

      {peopleModalTab != null ? (
        <PeopleListModal
          // Remount per chip so tab state matches the opened section (avoids a stale
          // "friends" fetch when opening Following / Followers).
          key={`${userId}-${peopleModalTab}`}
          open
          onClose={() => setPeopleModalTab(null)}
          userId={userId}
          initialTab={peopleModalTab}
          isOwnProfile={isOwnProfile}
          onRelationshipChanged={refreshProfile}
        />
      ) : null}
    </WidgetWrapper>
  )
}

export default UserWidget
