"use client"

import { Box, Skeleton, useTheme } from "@mui/material"

import { cardShadow } from "@/theme"

const CardSkeleton = ({ hero = false }: { hero?: boolean }) => {
  const theme = useTheme()
  return (
    <Box
      aria-hidden
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: `${Number(theme.shape.borderRadius) * 1.15}px`,
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: cardShadow(theme.palette.mode),
        bgcolor: "background.alt",
        height: hero ? { xs: 480, sm: 560 } : { xs: 320, sm: 360 },
        maxHeight: hero ? { xs: 480, sm: 560 } : { xs: 320, sm: 360 },
        p: hero ? { xs: 2, sm: 2.5 } : { xs: 1.75, sm: 2 },
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      <Skeleton
        variant="rectangular"
        sx={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          maxHeight: "100%",
        }}
      />
      <Box sx={{ position: "relative", zIndex: 1 }}>
        <Skeleton variant="text" width="36%" height={16} sx={{ bgcolor: "action.hover" }} />
        <Skeleton
          variant="text"
          width="88%"
          height={hero ? 32 : 26}
          sx={{ bgcolor: "action.hover" }}
        />
        <Skeleton
          variant="text"
          width="72%"
          height={hero ? 28 : 22}
          sx={{ bgcolor: "action.hover" }}
        />
      </Box>
    </Box>
  )
}

/** Loading placeholders for the News feed. */
const NewsFeedSkeleton = () => (
  <Box
    sx={{ display: "flex", flexDirection: "column", gap: 1.75 }}
    role="status"
    aria-live="polite"
    aria-label="Loading news"
  >
    <CardSkeleton hero />
    <CardSkeleton />
    <CardSkeleton />
    <CardSkeleton />
  </Box>
)

export default NewsFeedSkeleton
