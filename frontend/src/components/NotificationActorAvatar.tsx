"use client"

import { ChatBubble, Favorite, People, PersonAdd } from "@mui/icons-material"
import { Badge, Box, useTheme } from "@mui/material"

import { notificationTypeKind, notificationTypeLabel } from "@/lib/notifications"
import type { NotificationType } from "@/types/notifications"

import UserImage from "./UserImage"

type NotificationActorAvatarProps = {
  image: string
  name: string
  type: NotificationType
  size?: string
  bgColor?: string
}

const NotificationActorAvatar = ({
  image,
  name,
  type,
  size = "40px",
  bgColor,
}: NotificationActorAvatarProps) => {
  const theme = useTheme()
  const kind = notificationTypeKind(type)
  const numericSize = Number.parseInt(size, 10) || 40
  const badgePx = Math.max(16, Math.round(numericSize * 0.42))
  const iconPx = Math.max(10, Math.round(badgePx * 0.62))

  let Icon = ChatBubble
  let bgcolor = theme.palette.primary.main
  if (kind === "like") {
    Icon = Favorite
    bgcolor = theme.palette.error.main
  } else if (kind === "friend_request") {
    Icon = PersonAdd
  } else if (kind === "friend") {
    Icon = People
    bgcolor = theme.palette.success.main
  }

  return (
    <Badge
      overlap="circular"
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      badgeContent={
        <Box
          aria-hidden
          title={notificationTypeLabel(type)}
          sx={{
            width: badgePx,
            height: badgePx,
            borderRadius: "50%",
            bgcolor,
            color: theme.palette.getContrastText(bgcolor),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid",
            borderColor: "background.paper",
            boxSizing: "border-box",
          }}
        >
          <Icon sx={{ fontSize: iconPx }} />
        </Box>
      }
    >
      <UserImage image={image} name={name} size={size} bgColor={bgColor} />
    </Badge>
  )
}

export default NotificationActorAvatar
