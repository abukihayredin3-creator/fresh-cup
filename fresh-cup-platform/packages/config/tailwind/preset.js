/**
 * Shared Tailwind preset — Fresh Cup brand tokens.
 * Source of truth: fresh-cup-platform/docs/DESIGN_SYSTEM.md
 * Consumed by apps/web, apps/admin, apps/delivery. Mirrored for React Native
 * via NativeWind in apps/mobile (see apps/mobile/tailwind.config.js).
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        green: {
          900: "#1B4332",
          700: "#2D6A4F",
          100: "#E4F0E9",
        },
        orange: {
          600: "#F2732E",
          100: "#FDE9DC",
        },
        warm: {
          white: "#FBF6EF",
        },
        neutral: {
          900: "#1F2420",
          500: "#6B7268",
          200: "#E7E4DD",
        },
        error: {
          600: "#C0392B",
        },
        success: {
          600: "#2D6A4F",
        },
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        sans: ["Inter", "sans-serif"],
        ethiopic: ["Noto Sans Ethiopic", "sans-serif"],
      },
      fontSize: {
        caption: "0.75rem",
        "body-sm": "0.875rem",
        body: "1rem",
        h5: "1.25rem",
        h4: "1.5625rem",
        h3: "1.953rem",
        h2: "2.441rem",
        h1: "3.052rem",
      },
      spacing: {
        4.5: "1.125rem",
      },
      borderRadius: {
        DEFAULT: "8px",
        lg: "16px",
        pill: "999px",
      },
    },
  },
};
