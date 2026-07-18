/**
 * Brand tokens for the native app. Mirrors packages/ui/src/tokens.ts and
 * packages/config/tailwind/theme.css (the web equivalents) — kept as plain
 * JS values here since React Native doesn't consume the web UI package.
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
