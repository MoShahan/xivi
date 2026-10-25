import { alpha, type Theme } from "@mui/material"
import type { SystemStyleObject } from "@mui/system"

/** Reset Box/Typography used as a native button. Theme `*:focus-visible` still applies. */
export const unstyledButtonSx: SystemStyleObject<Theme> = {
  border: 0,
  background: "none",
  p: 0,
  m: 0,
  font: "inherit",
  color: "inherit",
  cursor: "pointer",
}

/** Sidebar / drawer list rows. */
export const navListItemSx: SystemStyleObject<Theme> = {
  borderRadius: 2,
  mb: 0.25,
}

export function navListItemSelectedSx(isDark: boolean): SystemStyleObject<Theme> {
  return {
    borderRadius: 2,
    mb: 0.25,
    "&.Mui-selected": {
      bgcolor: theme => alpha(theme.palette.primary.main, isDark ? 0.18 : 0.1),
      "&:hover": {
        bgcolor: theme => alpha(theme.palette.primary.main, isDark ? 0.24 : 0.14),
      },
    },
  }
}

export function notificationRowSx(read: boolean, variant: "menu" | "page"): SystemStyleObject<Theme> {
  const inset = variant === "page" ? 10 : 8
  return {
    position: "relative",
    alignItems: "flex-start",
    gap: variant === "page" ? 1 : 0.5,
    ...(variant === "page" ? { borderRadius: 2, mb: 0.5 } : null),
    bgcolor: read
      ? undefined
      : theme => alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.12 : 0.07),
    ...(!read && {
      "&::before": {
        content: '""',
        position: "absolute",
        left: 0,
        top: inset,
        bottom: inset,
        width: 3,
        borderRadius: "0 2px 2px 0",
        bgcolor: "primary.main",
      },
    }),
  }
}
