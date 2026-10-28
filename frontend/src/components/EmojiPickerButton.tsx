"use client"

import { useState } from "react"
import { SentimentSatisfiedAltOutlined } from "@mui/icons-material"
import { alpha, Box, Popover, Tooltip, Typography, useTheme } from "@mui/material"

/** Curated set - covers common reactions without a heavy emoji library. */
const EMOJIS = [
  "😀",
  "😃",
  "😄",
  "😁",
  "😆",
  "😅",
  "😂",
  "🤣",
  "😊",
  "😇",
  "🙂",
  "😉",
  "😍",
  "🥰",
  "😘",
  "😗",
  "😋",
  "😜",
  "🤪",
  "😝",
  "🤑",
  "🤗",
  "🤭",
  "🤫",
  "🤔",
  "🤐",
  "🤨",
  "😐",
  "😑",
  "😶",
  "🙄",
  "😏",
  "😣",
  "😥",
  "😮",
  "🤐",
  "😯",
  "😪",
  "😫",
  "🥱",
  "😴",
  "😌",
  "😛",
  "😒",
  "😓",
  "😔",
  "😕",
  "🙃",
  "🤑",
  "😲",
  "☹️",
  "🙁",
  "😖",
  "😞",
  "😟",
  "😤",
  "😢",
  "😭",
  "😦",
  "😧",
  "😨",
  "😩",
  "🤯",
  "😬",
  "😰",
  "😱",
  "🥵",
  "🥶",
  "😳",
  "🤪",
  "😵",
  "😡",
  "😠",
  "🤬",
  "😷",
  "🤒",
  "🤕",
  "🤢",
  "🤮",
  "🥴",
  "😎",
  "🤓",
  "🧐",
  "😕",
  "👍",
  "👎",
  "👏",
  "🙌",
  "🤝",
  "🙏",
  "💪",
  "✌️",
  "🤞",
  "🤟",
  "🤘",
  "👌",
  "🫶",
  "❤️",
  "🧡",
  "💛",
  "💚",
  "💙",
  "💜",
  "🖤",
  "🤍",
  "💔",
  "❣️",
  "💕",
  "💞",
  "💓",
  "💗",
  "💖",
  "💘",
  "💝",
  "🔥",
  "⭐",
  "✨",
  "💫",
  "🎉",
  "🎊",
  "🎈",
  "🎁",
  "🏆",
  "🥇",
  "🎯",
  "🚀",
  "💡",
  "📸",
  "🎵",
  "☕",
  "🍕",
  "🍔",
  "🍰",
  "🎂",
  "🌈",
  "☀️",
  "🌙",
  "⚡",
  "🌸",
  "🍀",
  "🐶",
  "🐱",
  "🦄",
  "✅",
  "❌",
  "💯",
] as const

/** Dedupe while preserving order (list above has a few repeats). */
const UNIQUE_EMOJIS = [...new Set(EMOJIS)]

type EmojiPickerButtonProps = {
  onSelect: (emoji: string) => void
  disabled?: boolean
  /** Optional label shown next to the icon (create-post toolbar). */
  showLabel?: boolean
  active?: boolean
  /** Compact circular control for inline composers. */
  dense?: boolean
}

/**
 * Lightweight emoji popover - no extra package; inserts via parent callback.
 */
const EmojiPickerButton = ({
  onSelect,
  disabled = false,
  showLabel = false,
  active = false,
  dense = false,
}: EmojiPickerButtonProps) => {
  const theme = useTheme()
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const open = Boolean(anchorEl)
  const accent = active || open

  return (
    <>
      <Tooltip title="Add emoji">
        <Box
          component="button"
          type="button"
          disabled={disabled}
          aria-label="Add emoji"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={e => setAnchorEl(e.currentTarget)}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: dense ? 0 : "0.35rem",
            border: 0,
            background: accent ? alpha(theme.palette.primary.main, 0.1) : "transparent",
            cursor: disabled ? "default" : "pointer",
            ...(dense
              ? {
                  width: 32,
                  height: 32,
                  p: 0,
                  borderRadius: "50%",
                }
              : {
                  px: showLabel ? 1 : 0.5,
                  py: 0.5,
                  borderRadius: 1.5,
                }),
            color: accent ? theme.palette.primary.main : theme.palette.neutral.mediumMain,
            font: "inherit",
            fontWeight: accent ? 600 : 500,
            transition: "color 0.15s ease, background-color 0.15s ease",
            "&:hover": {
              color: disabled ? undefined : theme.palette.primary.main,
              bgcolor: disabled ? undefined : alpha(theme.palette.primary.main, 0.08),
            },
          }}
        >
          <SentimentSatisfiedAltOutlined sx={{ fontSize: dense ? 20 : 22 }} />
          {showLabel && !dense ? <Typography component="span">Emoji</Typography> : null}
        </Box>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              p: 1.5,
              width: 380,
              maxWidth: "min(380px, 92vw)",
              overflowX: "hidden",
              borderRadius: 2,
              border: `1px solid ${theme.palette.divider}`,
              boxShadow:
                theme.palette.mode === "dark"
                  ? `0 12px 40px ${alpha(theme.palette.common.black, 0.45)}`
                  : `0 12px 36px ${alpha(theme.palette.common.black, 0.12)}`,
            },
          },
        }}
      >
        <Typography
          variant="caption"
          sx={{ display: "block", px: 0.5, pb: 1, color: "text.secondary", fontWeight: 600 }}
        >
          Pick an emoji
        </Typography>
        <Box
          role="listbox"
          aria-label="Emoji list"
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(8, minmax(0, 1fr))",
            gap: 0.5,
            maxHeight: 260,
            overflowY: "auto",
            overflowX: "hidden",
            pr: 0.25,
            // Slightly warmer panel so emoji yellows read richer in light mode.
            ...(theme.palette.mode === "light"
              ? {
                  bgcolor: alpha(theme.palette.common.black, 0.02),
                  borderRadius: 1.5,
                  p: 0.5,
                }
              : null),
          }}
        >
          {UNIQUE_EMOJIS.map(emoji => (
            <Box
              key={emoji}
              component="button"
              type="button"
              role="option"
              aria-label={`Insert ${emoji}`}
              onClick={() => {
                onSelect(emoji)
                setAnchorEl(null)
              }}
              sx={{
                width: "100%",
                minWidth: 0,
                aspectRatio: "1",
                p: 0,
                m: 0,
                border: 0,
                cursor: "pointer",
                fontSize: "1.45rem",
                lineHeight: 1,
                borderRadius: 1.5,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "transparent",
                // IconButton’s action.active color washes Segoe UI Emoji in light mode.
                color: "unset",
                WebkitTextFillColor: "unset",
                opacity: 1,
                transition: "background-color 0.12s ease, transform 0.12s ease",
                "&:hover": {
                  bgcolor:
                    theme.palette.mode === "dark"
                      ? alpha(theme.palette.primary.main, 0.14)
                      : alpha(theme.palette.common.black, 0.06),
                },
                "&:active": {
                  transform: "scale(0.92)",
                },
                "&:focus-visible": {
                  outline: `2px solid ${theme.palette.primary.main}`,
                  outlineOffset: 1,
                },
              }}
            >
              <Box component="span" aria-hidden sx={{ color: "unset", WebkitTextFillColor: "unset" }}>
                {emoji}
              </Box>
            </Box>
          ))}
        </Box>
      </Popover>
    </>
  )
}

export default EmojiPickerButton

/** Insert `emoji` at the caret (or append) and restore focus/selection. */
export function insertEmojiAtCursor(
  input: HTMLInputElement | HTMLTextAreaElement | null,
  current: string,
  emoji: string,
  setValue: (next: string) => void
) {
  if (!input) {
    setValue(`${current}${emoji}`)
    return
  }
  const start = input.selectionStart ?? current.length
  const end = input.selectionEnd ?? current.length
  const next = `${current.slice(0, start)}${emoji}${current.slice(end)}`
  setValue(next)
  const caret = start + emoji.length
  requestAnimationFrame(() => {
    input.focus()
    input.setSelectionRange(caret, caret)
  })
}
