"use client"

import { Box, Typography } from "@mui/material"

import { PROFILE_COLORS } from "@/lib/profileColors"

type ColorSwatchPickerProps = {
  label: string
  value: string
  onChange: (hex: string) => void
  /** Optional short hint under the label. */
  hint?: string
}

const ColorSwatchPicker = ({ label, value, onChange, hint }: ColorSwatchPickerProps) => {
  const selected = value.toUpperCase()

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: hint ? 0.25 : 1 }}>
        {label}
      </Typography>
      {hint ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {hint}
        </Typography>
      ) : null}
      <Box
        role="radiogroup"
        aria-label={label}
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        {PROFILE_COLORS.map(({ hex, label: colorLabel }) => {
          const isSelected = selected === hex.toUpperCase()
          return (
            <Box
              key={hex}
              component="button"
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={colorLabel}
              title={colorLabel}
              onClick={() => onChange(hex)}
              sx={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                bgcolor: hex,
                border: theme =>
                  isSelected
                    ? `2px solid ${theme.palette.common.white}`
                    : `2px solid transparent`,
                outline: theme =>
                  isSelected ? `2px solid ${theme.palette.primary.main}` : "none",
                outlineOffset: 2,
                cursor: "pointer",
                p: 0,
                flexShrink: 0,
                transition: "transform 0.15s ease",
                "&:hover": { transform: "scale(1.08)" },
              }}
            />
          )
        })}
      </Box>
    </Box>
  )
}

export default ColorSwatchPicker
