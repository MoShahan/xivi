"use client"

import React from "react"
import { alpha, Box, Typography, useTheme } from "@mui/material"

type BrandLogoProps = {
  /** Click handler (e.g. go home). */
  onClick?: () => void
  /** Compact for navbar vs larger for auth pages. */
  size?: "nav" | "auth"
}

const BrandLogo = ({ onClick, size = "nav" }: BrandLogoProps) => {
  const theme = useTheme()
  const primary = theme.palette.primary.main
  const pLight = theme.palette.primary.light
  const isNav = size === "nav"
  const markPx = isNav ? 32 : 44

  return (
    <Box
      component={onClick ? "button" : "div"}
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-label="Xivi home"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: isNav ? "0.65rem" : "0.85rem",
        border: 0,
        background: "none",
        padding: 0,
        margin: 0,
        cursor: onClick ? "pointer" : "default",
        textAlign: "left",
        borderRadius: onClick ? "0.5rem" : undefined,
        "&:hover .xivi-wordmark": onClick
          ? { color: theme.palette.mode === "dark" ? pLight : theme.palette.primary.dark }
          : undefined,
        "&:hover .xivi-mark": onClick ? { transform: "scale(1.04)" } : undefined,
      }}
    >
      <Box
        className="xivi-mark"
        component="img"
        src="/assets/xivi-mark.png"
        alt=""
        width={markPx}
        height={markPx}
        draggable={false}
        sx={{
          width: markPx,
          height: markPx,
          objectFit: "contain",
          objectPosition: "center",
          borderRadius: "0.65rem",
          display: "block",
          flexShrink: 0,
          aspectRatio: "1 / 1",
          transition: "transform 0.15s ease",
          boxShadow:
            theme.palette.mode === "dark"
              ? `0 0 0 1px ${alpha(theme.palette.common.white, 0.08)}`
              : `0 1px 2px ${alpha(theme.palette.common.black, 0.08)}`,
        }}
      />
      <Typography
        className="xivi-wordmark"
        component="span"
        sx={{
          fontFamily: "var(--font-display), Georgia, serif",
          fontWeight: 700,
          letterSpacing: "-0.03em",
          lineHeight: 1,
          fontSize: isNav ? "clamp(1.05rem, 1.8vw, 1.35rem)" : "clamp(1.35rem, 2.5vw, 1.75rem)",
          color: primary,
          transition: "color 0.15s ease",
          userSelect: "none",
        }}
      >
        Xivi
      </Typography>
    </Box>
  )
}

export default BrandLogo
