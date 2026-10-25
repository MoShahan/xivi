"use client"

import React, { useState } from "react"
import { Box, Button, type SxProps, type Theme, Typography } from "@mui/material"

type ExpandableTextProps = {
  text: string
  /** Max words shown before “See more”. Default 40. */
  maxWords?: number
  /** Max characters for unbroken / very long strings. Default 280. */
  maxChars?: number
  typographySx?: SxProps<Theme>
  buttonSx?: SxProps<Theme>
}

/** Trim ends only. Internal newlines stay so posts can keep paragraph breaks. */
export function truncateText(
  text: string,
  maxWords: number,
  maxChars: number
): { preview: string; needsExpand: boolean } {
  const trimmed = text.trim()
  if (!trimmed) return { preview: "", needsExpand: false }

  const words = trimmed.split(/\s+/).filter(Boolean)
  const needsWordExpand = words.length > maxWords
  const needsCharExpand = trimmed.length > maxChars

  if (!needsWordExpand && !needsCharExpand) {
    return { preview: trimmed, needsExpand: false }
  }

  if (needsWordExpand) {
    const wordRe = /\S+/g
    let match: RegExpExecArray | null = null
    let count = 0
    let end = 0
    while ((match = wordRe.exec(trimmed)) !== null) {
      count += 1
      end = match.index + match[0].length
      if (count >= maxWords) break
    }
    return {
      preview: `${trimmed.slice(0, end)}…`,
      needsExpand: true,
    }
  }

  return {
    preview: `${trimmed.slice(0, maxChars)}…`,
    needsExpand: true,
  }
}

const ExpandableText = ({
  text,
  maxWords = 40,
  maxChars = 280,
  typographySx,
  buttonSx,
}: ExpandableTextProps) => {
  const [expanded, setExpanded] = useState(false)
  const { preview, needsExpand } = truncateText(text, maxWords, maxChars)
  const display = expanded || !needsExpand ? text.trim() : preview

  if (!display) return null

  return (
    <Box>
      <Typography
        sx={{
          overflowWrap: "anywhere",
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
          ...((typographySx || {}) as object),
        }}
      >
        {display}
      </Typography>
      {needsExpand && (
        <Button
          size="small"
          onClick={() => setExpanded(prev => !prev)}
          sx={{
            textTransform: "none",
            minWidth: 0,
            p: 0,
            mt: "0.15rem",
            fontSize: "0.8125rem",
            fontWeight: 600,
            ...((buttonSx || {}) as object),
          }}
        >
          {expanded ? "See less" : "See more"}
        </Button>
      )}
    </Box>
  )
}

export default ExpandableText
