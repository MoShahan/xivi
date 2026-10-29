"use client"

import CloseIcon from "@mui/icons-material/Close"
import { alpha, Box, Dialog, IconButton, Typography, useTheme } from "@mui/material"

import { mediaUrl } from "@/lib/api"
import { cardShadow, colorTokens } from "@/theme"

type PostImageLightboxProps = {
  open: boolean
  onClose: () => void
  src: string
  alt: string
  caption?: string
}

const PostImageLightbox = ({ open, onClose, src, alt, caption }: PostImageLightboxProps) => {
  const theme = useTheme()
  const resolvedSrc = mediaUrl(src)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      aria-label="Fullscreen post image"
      transitionDuration={200}
      slotProps={{
        backdrop: {
          sx: {
            bgcolor: alpha(colorTokens.stone[950], 0.88),
            backdropFilter: "blur(10px)",
          },
        },
        container: {
          onClick: event => {
            if (event.target === event.currentTarget) {
              onClose()
            }
          },
        },
        paper: {
          sx: {
            bgcolor: "transparent",
            backgroundImage: "none",
            boxShadow: "none",
            overflow: "visible",
            m: 2,
            maxWidth: "min(96vw, 1200px)",
            width: "auto",
          },
        },
      }}
    >
      <IconButton
        onClick={onClose}
        aria-label="Close"
        size="small"
        sx={{
          position: "fixed",
          top: { xs: "max(8px, env(safe-area-inset-top, 0px))", sm: 16 },
          right: { xs: "max(8px, env(safe-area-inset-right, 0px))", sm: 16 },
          zIndex: 1,
          bgcolor: theme => alpha(theme.palette.common.black, 0.72),
          color: "common.white",
          "&:hover": { bgcolor: theme => alpha(theme.palette.common.black, 0.88) },
        }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1.25,
        }}
      >
        <Box
          component="img"
          src={resolvedSrc}
          alt={alt}
          draggable={false}
          sx={{
            display: "block",
            maxWidth: "min(96vw, 1200px)",
            maxHeight: "min(calc(88vh - 3rem), 900px)",
            width: "auto",
            height: "auto",
            objectFit: "contain",
            borderRadius: `${theme.shape.borderRadius}px`,
            boxShadow: cardShadow(theme.palette.mode),
          }}
        />
        {caption ? (
          <Typography
            component="p"
            sx={{
              color: colorTokens.stone[400],
              fontSize: "0.875rem",
              lineHeight: 1.4,
              textAlign: "center",
              px: 1,
              maxWidth: "36rem",
            }}
          >
            {caption}
          </Typography>
        ) : null}
      </Box>
    </Dialog>
  )
}

export default PostImageLightbox
