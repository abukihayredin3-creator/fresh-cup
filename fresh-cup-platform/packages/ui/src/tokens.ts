/**
 * Brand tokens, mirrored from the Tailwind theme (@fresh-cup/config/tailwind/theme.css)
 * for use in contexts that need raw values (inline styles, charts, native code).
 * Source of truth: fresh-cup-platform/docs/DESIGN_SYSTEM.md
 */
export const colors = {
  green900: "#1B4332",
  green700: "#2D6A4F",
  green100: "#E4F0E9",
  orange600: "#F2732E",
  orange100: "#FDE9DC",
  warmWhite: "#FBF6EF",
  neutral900: "#1F2420",
  neutral500: "#6B7268",
  neutral200: "#E7E4DD",
  error600: "#C0392B",
  success600: "#2D6A4F",
} as const;

/** Light/dark semantic palette — matches the `[data-theme="dark"]` overrides in theme.css. */
export const semanticColors = {
  light: {
    surface: "#FBF6EF",
    surfaceAlt: "#FFFFFF",
    fg: "#1F2420",
    fgMuted: "#6B7268",
    border: "#E7E4DD",
    tintGreen: "#E4F0E9",
    tintOrange: "#FDE9DC",
  },
  dark: {
    surface: "#17140F",
    surfaceAlt: "#211D19",
    fg: "#F5F1EA",
    fgMuted: "#A8A398",
    border: "#3A342E",
    tintGreen: "#1E3328",
    tintOrange: "#3A2416",
  },
} as const;

export const radii = {
  default: "8px",
  lg: "16px",
  pill: "999px",
} as const;
