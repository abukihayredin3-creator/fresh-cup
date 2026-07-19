/**
 * Brand + semantic tokens for the native app. Mirrors
 * packages/config/tailwind/theme.css (the web equivalent) — kept as plain JS
 * values since React Native doesn't consume Tailwind/the web `ui` package.
 * Source of truth: fresh-cup-platform/docs/DESIGN_SYSTEM.md
 *
 * Fixed identity colors (correct as backgrounds paired with a foreground
 * chosen for that exact color) vs. theme-aware semantic tokens (surface/fg
 * and the `*Text` variants, safe to use as text directly on the page) follow
 * the same split as the web tokens — see DESIGN_SYSTEM.md's "Dark mode"
 * section for why a single fixed shade can't serve both roles.
 */
export const brand = {
  green900: "#1B4332",
  green700: "#2D6A4F",
  orange600: "#F2732E",
  warmWhite: "#FBF6EF",
  neutral900: "#1F2420",
  error600: "#C0392B",
} as const;

export interface SemanticTheme {
  surface: string;
  surfaceAlt: string;
  fg: string;
  fgMuted: string;
  border: string;
  tintGreen: string;
  tintOrange: string;
  accentText: string;
  successText: string;
  dangerText: string;
  overlay: string;
}

export const lightTheme: SemanticTheme = {
  surface: "#FBF6EF",
  surfaceAlt: "#FFFFFF",
  fg: "#1F2420",
  fgMuted: "#6B7268",
  border: "#E7E4DD",
  tintGreen: "#E4F0E9",
  tintOrange: "#FDE9DC",
  accentText: "#A54716",
  successText: "#2D6A4F",
  dangerText: "#C0392B",
  overlay: "rgba(31, 36, 32, 0.45)",
};

export const darkTheme: SemanticTheme = {
  surface: "#17140F",
  surfaceAlt: "#211D19",
  fg: "#F5F1EA",
  fgMuted: "#A8A398",
  border: "#3A342E",
  tintGreen: "#1E3328",
  tintOrange: "#3A2416",
  accentText: "#F2732E",
  successText: "#52B788",
  dangerText: "#E57373",
  overlay: "rgba(0, 0, 0, 0.6)",
};
