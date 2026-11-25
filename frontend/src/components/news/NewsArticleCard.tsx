"use client"

import { Box, Typography, useTheme } from "@mui/material"
import { alpha } from "@mui/material/styles"

import { cardShadow } from "@/theme"
import type { NewsArticle } from "@/types/news"

type NewsArticleCardProps = {
  article: NewsArticle
  /** Taller first card in the feed. */
  hero?: boolean
}

/** Fixed card heights so oversized source images never stretch the layout. */
const CARD_HEIGHT = { xs: 320, sm: 360 } as const
const HERO_HEIGHT = { xs: 480, sm: 560 } as const

function formatPublishedAt(iso: string): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""

  const diffMs = Date.now() - date.getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

const NewsArticleCard = ({ article, hero = false }: NewsArticleCardProps) => {
  const theme = useTheme()
  const isDark = theme.palette.mode === "dark"
  const published = formatPublishedAt(article.publishedAt)
  const meta = [article.sourceName, published].filter(Boolean).join(" · ")
  const hasImage = Boolean(article.image)

  return (
    <Box
      component="a"
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${article.title}${article.sourceName ? ` - ${article.sourceName}` : ""}`}
      sx={{
        display: "block",
        position: "relative",
        overflow: "hidden",
        borderRadius: `${Number(theme.shape.borderRadius) * 1.15}px`,
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: cardShadow(theme.palette.mode),
        textDecoration: "none",
        color: "inherit",
        bgcolor: "background.alt",
        height: hero ? HERO_HEIGHT : CARD_HEIGHT,
        maxHeight: hero ? HERO_HEIGHT : CARD_HEIGHT,
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow:
            theme.palette.mode === "dark"
              ? `0 8px 24px ${alpha("#000", 0.4)}`
              : `0 8px 24px ${alpha(theme.palette.common.black, 0.1)}`,
          "& .news-card-image": {
            transform: "scale(1.04)",
          },
          "& .news-card-scrim": {
            opacity: 1,
          },
        },
        "&:focus-visible": {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: 2,
        },
      }}
    >
      {hasImage ? (
        <Box
          className="news-card-image"
          component="img"
          src={article.image}
          alt=""
          aria-hidden
          loading="lazy"
          // Some publishers (e.g. AllAfrica CDN) 403 hotlinks when Referer is our origin.
          referrerPolicy="no-referrer"
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            maxHeight: "100%",
            objectFit: "cover",
            objectPosition: "center",
            transition: "transform 0.35s ease",
          }}
        />
      ) : (
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: 0,
            background: isDark
              ? `linear-gradient(145deg, ${alpha(theme.palette.primary.main, 0.22)}, ${theme.palette.background.alt})`
              : `linear-gradient(145deg, ${alpha(theme.palette.primary.main, 0.14)}, ${theme.palette.background.alt})`,
          }}
        />
      )}

      <Box
        className="news-card-scrim"
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          opacity: 0.92,
          transition: "opacity 0.35s ease",
          background: hasImage
            ? `linear-gradient(
                180deg,
                ${alpha("#000", 0)} 0%,
                ${alpha("#000", 0.12)} 28%,
                ${alpha("#000", 0.45)} 52%,
                ${alpha("#000", 0.78)} 72%,
                ${alpha("#000", 0.92)} 100%
              )`
            : `linear-gradient(180deg, ${alpha("#000", 0)} 0%, ${alpha("#000", isDark ? 0.65 : 0.55)} 100%)`,
        }}
      />

      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          height: "100%",
          maxHeight: "100%",
          p: hero ? { xs: 2, sm: 2.5 } : { xs: 1.75, sm: 2 },
        }}
      >
        {meta ? (
          <Typography
            sx={{
              color: alpha("#fff", 0.82),
              fontSize: "0.72rem",
              fontWeight: 600,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
              mb: 0.75,
            }}
          >
            {meta}
          </Typography>
        ) : null}
        <Typography
          component="h2"
          sx={{
            color: "#fff",
            fontWeight: 700,
            fontSize: hero ? { xs: "1.2rem", sm: "1.45rem" } : { xs: "1rem", sm: "1.1rem" },
            lineHeight: 1.25,
            letterSpacing: "-0.01em",
            display: "-webkit-box",
            WebkitLineClamp: hero ? 3 : 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            textShadow: `0 1px 2px ${alpha("#000", 0.35)}`,
          }}
        >
          {article.title}
        </Typography>
        {article.description ? (
          <Typography
            sx={{
              mt: 0.85,
              color: alpha("#fff", 0.88),
              fontSize: hero ? "0.9rem" : "0.82rem",
              lineHeight: 1.45,
              display: "-webkit-box",
              WebkitLineClamp: hero ? 3 : 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {article.description}
          </Typography>
        ) : null}
      </Box>
    </Box>
  )
}

export default NewsArticleCard
