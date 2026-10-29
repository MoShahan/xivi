"use client"

import { Box, type BoxProps } from "@mui/material"

/** Shared content width for AppShell main column and public info pages. */
export const PAGE_MAX_WIDTH = 1440
export const PAGE_MAX_WIDTH_NARROW = 720

type PageShellProps = BoxProps & {
  /** Constrain width for single-column pages (post, notifications). */
  narrow?: boolean
  /** Stretch to fill the AppShell column with no gutters (Messages). */
  fill?: boolean
}

/**
 * Shared page gutters so home / profile / notifications feel like one product.
 */
const PageShell = ({ children, narrow = false, fill = false, sx, ...props }: PageShellProps) => {
  return (
    <Box
      component="main"
      id="main-content"
      tabIndex={-1}
      {...props}
      sx={{
        width: "100%",
        outline: "none",
        ...(fill
          ? {
              flex: 1,
              minHeight: 0,
              maxWidth: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }
          : {
              maxWidth: narrow ? PAGE_MAX_WIDTH_NARROW : PAGE_MAX_WIDTH,
              margin: "0 auto",
              padding: {
                xs: "1rem 0.85rem 2rem",
                sm: "1.15rem 1.25rem 2.25rem",
                md: "1.25rem 1.75rem 2.5rem",
              },
            }),
        ...((sx as object) || {}),
      }}
    >
      {children}
    </Box>
  )
}

export default PageShell
