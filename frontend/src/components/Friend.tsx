"use client"

import React from "react"
import { alpha, Box, Typography, useTheme } from "@mui/material"
import { useRouter } from "next/navigation"

import { useAppSelector } from "@/app/hooks"
import { sameUserId } from "@/types/models"
import type { UserRelationship } from "@/types/relationships"

import FlexBetween from "./FlexBetween"
import RelationshipActions from "./RelationshipActions"
import { unstyledButtonSx } from "./sharedSx"
import UserImage from "./UserImage"

type FriendProps = {
  id: string
  subtitle: string
  url: string
  name: string
  /** Initials avatar background when no photo. */
  avatarColor?: string
  /** Avatar size - lists use 48px; post headers keep 55px. */
  avatarSize?: string
  /** When false, hide follow/friend actions (e.g. post cards). Default true. */
  showFriendButton?: boolean
  /** Prefill relationship (e.g. from discover). */
  relationship?: Partial<UserRelationship> | null
  /** Optional trailing control (e.g. post ⋮ menu). */
  endAction?: React.ReactNode
  /** Soft row hover for list contexts (friends / discover). */
  listHover?: boolean
  /** After friend/follow mutation from this row. */
  onRelationshipChanged?: () => void
  /** Called before navigating to this user’s profile (e.g. close a modal). */
  onBeforeNavigate?: () => void
}

const Friend = ({
  id,
  name,
  subtitle,
  url,
  avatarColor,
  avatarSize = "42px",
  showFriendButton = true,
  relationship = null,
  endAction,
  listHover = false,
  onRelationshipChanged,
  onBeforeNavigate,
}: FriendProps) => {
  const router = useRouter()
  const user = useAppSelector(state => state.user)

  const theme = useTheme()
  const main = theme.palette.neutral.main
  const medium = theme.palette.neutral.medium
  const nameHover = theme.palette.primary.main

  const isSelf = sameUserId(user?._id, id)

  const handleGoToProfile = () => {
    if (!id) return
    onBeforeNavigate?.()
    if (isSelf) {
      router.push("/profile")
    } else {
      router.push(`/profile/${id}`)
    }
  }

  return (
    <FlexBetween
      sx={{
        width: "100%",
        gap: 1,
        minWidth: 0,
        alignItems: "center",
        ...(listHover
          ? {
              mx: -0.75,
              px: 0.75,
              py: 0.55,
              borderRadius: 2,
              transition: "background-color 0.15s ease",
              "&:hover": {
                bgcolor: alpha(
                  theme.palette.primary.main,
                  theme.palette.mode === "dark" ? 0.08 : 0.05
                ),
              },
            }
          : null),
      }}
    >
      <Box
        component={id ? "button" : "div"}
        type={id ? "button" : undefined}
        onClick={id ? handleGoToProfile : undefined}
        aria-label={id ? name : undefined}
        sx={{
          ...unstyledButtonSx,
          display: "flex",
          alignItems: "center",
          gap: "0.65rem",
          flex: "1 1 auto",
          minWidth: 0,
          textAlign: "left",
          cursor: id ? "pointer" : "default",
        }}
      >
        <UserImage image={url} name={name} size={avatarSize} bgColor={avatarColor} />
        <Box sx={{ minWidth: 0, flex: "1 1 auto" }}>
          <Typography
            title={name}
            sx={{
              color: main,
              fontWeight: 600,
              fontSize: "0.9rem",
              lineHeight: 1.45,
              display: "block",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              py: "0.1em",
              transition: "color 0.15s ease",
              "&:hover": {
                cursor: id ? "pointer" : "default",
                color: id ? nameHover : main,
              },
            }}
          >
            {name}
          </Typography>
          {subtitle ? (
            <Typography
              title={subtitle}
              sx={{
                color: medium,
                fontSize: "0.75rem",
                lineHeight: 1.4,
                display: "block",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                py: "0.05em",
              }}
            >
              {subtitle}
            </Typography>
          ) : null}
        </Box>
      </Box>
      {(showFriendButton && id && !isSelf) || endAction ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, flexShrink: 0 }}>
          {showFriendButton && id && !isSelf ? (
            <RelationshipActions
              userId={id}
              initial={relationship}
              dense
              onChanged={onRelationshipChanged}
            />
          ) : null}
          {endAction}
        </Box>
      ) : null}
    </FlexBetween>
  )
}

export default Friend
