"use client"

import { Box } from "@mui/material"

type OnlineDotProps = {
  online: boolean
  size?: number
}

const OnlineDot = ({ online, size = 10 }: OnlineDotProps) => {
  if (!online) return null
  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        borderRadius: "50%",
        bgcolor: "success.main",
        border: theme => `2px solid ${theme.palette.background.paper}`,
        boxSizing: "content-box",
      }}
    />
  )
}

export default OnlineDot
