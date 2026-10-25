import { alpha, type ThemeOptions } from "@mui/material/styles"

/**
 * Xivi design tokens - stone-first UI, muted forest green as accent only (Step 5.1).
 * Typography families come from CSS variables set in `layout.tsx` (next/font).
 */
export const colorTokens = {
  stone: {
    0: "#FFFFFF",
    50: "#FAFAF9",
    100: "#F5F5F4",
    200: "#E7E5E4",
    300: "#D6D3D1",
    400: "#A8A29E",
    500: "#78716C",
    600: "#57534E",
    700: "#44403C",
    800: "#292524",
    900: "#1C1917",
    950: "#0C0A09",
  },
  /** Desaturated olive - accent for brand / primary actions, not page chrome. */
  forest: {
    50: "#F3F6F3",
    100: "#E4EBE4",
    200: "#C5D4C7",
    300: "#9BB5A0",
    400: "#6F9478",
    500: "#4F7A5A",
    600: "#3D6248",
    700: "#314F3B",
    800: "#283F30",
    900: "#1A2A20",
  },
} as const

const fontBody = 'var(--font-body), "Segoe UI", system-ui, sans-serif'
const fontDisplay = 'var(--font-display), Georgia, "Times New Roman", serif'

/** Soft card elevation - use on WidgetWrapper / feed surfaces. */
export function cardShadow(mode: "light" | "dark"): string {
  return mode === "dark"
    ? `0 1px 0 ${alpha(colorTokens.stone[0], 0.05)}, 0 4px 16px ${alpha("#000", 0.28)}`
    : `0 1px 2px ${alpha(colorTokens.stone[900], 0.04)}, 0 4px 14px ${alpha(colorTokens.stone[900], 0.06)}`
}

export const themeSettings = (mode: "light" | "dark"): ThemeOptions => {
  const isDark = mode === "dark"
  const scrollbarThumb = isDark
    ? alpha(colorTokens.stone[100], 0.28)
    : alpha(colorTokens.stone[800], 0.28)
  const scrollbarThumbHover = isDark
    ? alpha(colorTokens.stone[100], 0.42)
    : alpha(colorTokens.stone[800], 0.4)

  // Keep primary quieter so most UI reads as stone/ink, not green.
  const primary = isDark
    ? {
        light: colorTokens.forest[300],
        main: colorTokens.forest[400],
        dark: colorTokens.forest[200],
        contrastText: colorTokens.stone[950],
      }
    : {
        light: colorTokens.forest[100],
        main: colorTokens.forest[700],
        dark: colorTokens.forest[800],
        contrastText: colorTokens.stone[0],
      }

  const neutral = isDark
    ? {
        dark: colorTokens.stone[100],
        main: colorTokens.stone[300],
        mediumMain: colorTokens.stone[400],
        medium: colorTokens.stone[500],
        light: colorTokens.stone[800],
      }
    : {
        // medium / mediumMain sized for ~4.5:1+ on white (WCAG AA body secondary).
        dark: colorTokens.stone[700],
        main: colorTokens.stone[600],
        mediumMain: colorTokens.stone[600],
        medium: colorTokens.stone[500],
        light: colorTokens.stone[100],
      }

  // Neutral charcoal/stone surfaces - not green-tinted pages.
  // Dark: slightly lift cards (alt) off the page for clearer separation.
  const background = isDark
    ? { default: colorTokens.stone[950], alt: colorTokens.stone[900] }
    : { default: colorTokens.stone[100], alt: colorTokens.stone[0] }

  const divider = isDark ? alpha(colorTokens.stone[100], 0.12) : alpha(colorTokens.stone[800], 0.1)

  return {
    palette: {
      mode,
      primary,
      secondary: {
        main: isDark ? colorTokens.stone[400] : colorTokens.stone[600],
      },
      success: {
        main: isDark ? "#6F9478" : "#3D6248",
        dark: colorTokens.forest[800],
        light: colorTokens.forest[200],
      },
      error: {
        main: isDark ? "#F87171" : "#DC2626",
        dark: isDark ? "#EF4444" : "#B91C1C",
        light: isDark ? "#FCA5A5" : "#FECACA",
      },
      neutral,
      divider,
      background,
      text: {
        primary: isDark ? colorTokens.stone[100] : colorTokens.stone[800],
        secondary: isDark ? colorTokens.stone[400] : colorTokens.stone[500],
      },
      action: {
        hover: isDark ? alpha(colorTokens.stone[100], 0.06) : alpha(colorTokens.stone[900], 0.04),
        selected: isDark ? alpha(colorTokens.forest[400], 0.12) : alpha(colorTokens.forest[700], 0.08),
        focus: isDark ? alpha(colorTokens.forest[400], 0.2) : alpha(colorTokens.forest[700], 0.16),
      },
    },
    shape: {
      // Cards use ~1.25x via WidgetWrapper; controls stay ~10px via overrides.
      borderRadius: 14,
    },
    spacing: 8,
    typography: {
      fontFamily: fontBody,
      fontSize: 14,
      htmlFontSize: 16,
      h1: {
        fontFamily: fontDisplay,
        fontSize: "2.1rem",
        fontWeight: 650,
        letterSpacing: "-0.02em",
        lineHeight: 1.15,
      },
      h2: {
        fontFamily: fontDisplay,
        fontSize: "1.7rem",
        fontWeight: 650,
        letterSpacing: "-0.02em",
        lineHeight: 1.2,
      },
      h3: {
        fontFamily: fontDisplay,
        fontSize: "1.35rem",
        fontWeight: 600,
        letterSpacing: "-0.015em",
        lineHeight: 1.25,
      },
      h4: {
        fontFamily: fontDisplay,
        fontSize: "1.15rem",
        fontWeight: 600,
        letterSpacing: "-0.01em",
        lineHeight: 1.3,
      },
      h5: {
        fontFamily: fontBody,
        fontSize: "0.95rem",
        fontWeight: 600,
        lineHeight: 1.35,
      },
      h6: {
        fontFamily: fontBody,
        fontSize: "0.875rem",
        fontWeight: 600,
        lineHeight: 1.4,
      },
      body1: { fontSize: "0.9rem", lineHeight: 1.5 },
      body2: { fontSize: "0.8125rem", lineHeight: 1.45 },
      button: {
        fontFamily: fontBody,
        fontWeight: 600,
        fontSize: "0.875rem",
        textTransform: "none" as const,
        letterSpacing: "0.01em",
      },
      subtitle1: { fontFamily: fontBody, fontWeight: 600, fontSize: "0.9rem" },
      subtitle2: { fontFamily: fontBody, fontWeight: 600, fontSize: "0.8125rem" },
      caption: { fontSize: "0.72rem", lineHeight: 1.4 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            // Soft stone wash only - avoid green wash across the whole app.
            backgroundImage: isDark
              ? `radial-gradient(1000px 520px at 10% -10%, ${alpha(colorTokens.stone[700], 0.42)}, transparent 55%)`
              : `radial-gradient(1000px 520px at 10% -10%, ${alpha(colorTokens.stone[200], 0.85)}, transparent 55%)`,
            backgroundAttachment: "fixed",
            // Firefox
            scrollbarWidth: "thin",
            scrollbarColor: `${scrollbarThumb} transparent`,
          },
          "*:focus-visible": {
            outline: `2px solid ${primary.main}`,
            outlineOffset: 2,
          },
          // MUI outlined fields already draw a notched border; a second ring
          // sits behind the floating label and looks like a gray halo on mobile.
          "input:focus-visible, textarea:focus-visible, select:focus-visible": {
            outline: "none",
          },
          // Thin overlay scrollbars (dialogs, menus, page) - match stone UI.
          "*::-webkit-scrollbar": {
            width: 8,
            height: 8,
          },
          "*::-webkit-scrollbar-track": {
            background: "transparent",
          },
          "*::-webkit-scrollbar-thumb": {
            backgroundColor: scrollbarThumb,
            borderRadius: 8,
            border: "2px solid transparent",
            backgroundClip: "padding-box",
          },
          "*::-webkit-scrollbar-thumb:hover": {
            backgroundColor: scrollbarThumbHover,
          },
          "*::-webkit-scrollbar-corner": {
            background: "transparent",
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 10,
            paddingInline: 14,
            paddingBlock: 6,
            boxShadow: "none",
            transition: "background-color 0.15s ease, color 0.15s ease, transform 0.12s ease",
            "&:hover": { boxShadow: "none" },
            "&:active": { transform: "scale(0.98)" },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            padding: 8,
            transition: "background-color 0.15s ease, color 0.15s ease, transform 0.12s ease",
            "&:hover": {
              backgroundColor: isDark
                ? alpha(colorTokens.stone[0], 0.08)
                : alpha(colorTokens.stone[900], 0.06),
            },
            "&:active": { transform: "scale(0.94)" },
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            marginInline: 4,
            minHeight: 36,
            fontSize: "0.875rem",
            transition: "background-color 0.12s ease",
            "&:hover": {
              backgroundColor: isDark
                ? alpha(colorTokens.stone[0], 0.08)
                : alpha(colorTokens.stone[900], 0.06),
            },
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: "none",
            fontWeight: 600,
            fontSize: "0.875rem",
            minHeight: 40,
            paddingInline: 12,
            transition: "color 0.15s ease",
          },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          variant: "outlined",
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            backgroundColor: isDark ? alpha(colorTokens.stone[0], 0.03) : colorTokens.stone[0],
            transition: "border-color 0.15s ease",
            "&.Mui-focused": {
              boxShadow: "none",
            },
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 12,
            border: `1px solid ${divider}`,
            boxShadow: isDark
              ? `0 12px 40px ${alpha("#000", 0.45)}`
              : `0 12px 32px ${alpha(colorTokens.stone[900], 0.12)}`,
          },
          list: {
            paddingBlock: 4,
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: 8,
            fontSize: "0.75rem",
          },
        },
      },
    },
  }
}
