/**
 * Brand tokens, mirrored from the Tailwind preset (@fresh-cup/config/tailwind/preset)
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

export const radii = {
  default: "8px",
  lg: "16px",
  pill: "999px",
} as const;
