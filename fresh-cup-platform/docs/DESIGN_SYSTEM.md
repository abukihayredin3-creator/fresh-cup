# Design System — Brand Identity

Fresh Cup should read as premium, modern, minimal, fresh, healthy, elegant —
closer to a world-class specialty beverage brand than a typical fast-food
app. The palette is deliberately restrained: two brand colors plus a warm
neutral, used with a lot of white space rather than saturated color
everywhere.

## Color tokens

| Token                       | Hex       | Role                                                                        | Contrast notes                                                              |
| --------------------------- | --------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `green-900` (Deep Green)    | `#1B4332` | Primary brand color — logo, headers, primary buttons, nav                   | On `warm-white`: ~10.5:1 — passes AA/AAA for all text sizes                 |
| `green-700`                 | `#2D6A4F` | Secondary green — hover states, secondary buttons                           |                                                                             |
| `green-100`                 | `#E4F0E9` | Tints — subtle backgrounds, success states, badges                          |                                                                             |
| `orange-600` (Fresh Orange) | `#F2732E` | Accent — CTAs ("Order Now"), highlights, prices, active states              | On white: ~2.9:1 — **large text/icons/buttons only**, never small body text |
| `orange-100`                | `#FDE9DC` | Tints — promo badges, warm highlight backgrounds                            |                                                                             |
| `warm-white` (base)         | `#FBF6EF` | App background                                                              | Not pure white — keeps the "fresh/organic" warmth                           |
| `neutral-900`               | `#1F2420` | Body text (warm-tinted near-black, not pure black)                          | On `warm-white`: ~15:1                                                      |
| `neutral-500`               | `#6B7268` | Secondary/muted text                                                        | On `warm-white`: ~4.6:1 — passes AA for body text                           |
| `neutral-200`               | `#E7E4DD` | Borders, dividers                                                           |                                                                             |
| `error-600`                 | `#C0392B` | Errors, destructive actions                                                 |                                                                             |
| `success-600`               | `#2D6A4F` | Reuses `green-700` — success states stay on-brand rather than generic green |

**Accessibility rule:** Fresh Orange is a call-to-action/accent color, not a
text color at small sizes. Buttons using `orange-600` as a background use
white text (verify per-shade at implementation time) or, where a button
needs AA-safe text-on-orange, use `neutral-900` text instead of white if
that combination measures higher contrast — checked in `packages/ui`'s
token tests, not eyeballed per-component.

### Dark mode (Phase 4) — status/accent text

`green-900`, `green-700`, `orange-600`, and `error-600` are fixed identity
colors: correct as _background fills_ (paired with a foreground chosen for
that exact color), wrong as _text sitting directly on the page surface_,
because the surface itself repaints between themes and no single fixed
shade clears 4.5:1 against both a light and a dark surface. Concretely:
`orange-600` is ~2.7:1 on the light surface (fails even in light mode, per
the accessibility rule above) and `green-700` is ~1.2:1 on the dark
`tint-green` background.

For text — status messages, "eyebrow" captions, positive/negative deltas —
use the theme-aware text tokens instead, defined in
`packages/config/tailwind/theme.css`:

| Token          | Light mode | Dark mode | Use in place of                   |
| -------------- | ---------- | --------- | --------------------------------- |
| `accent-text`  | `#A54716`  | `#F2732E` | `orange-600` as text              |
| `success-text` | `#2D6A4F`  | `#52B788` | `green-700`/`success-600` as text |
| `danger-text`  | `#C0392B`  | `#E57373` | `error-600` as text               |

Page/section headings should use `fg` (already theme-aware) rather than a
brand color at all — distinctiveness comes from the `Fraunces` display
typeface, not from color, so it doesn't need its own token.

## Typography

| Use                        | Typeface                       | Notes                                                                                                                                                                        |
| -------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Display / headings (Latin) | **Fraunces** (variable, serif) | Warm, editorial, premium — differentiates Fresh Cup from generic sans-only fast-food apps                                                                                    |
| UI / body (Latin)          | **Inter**                      | Neutral, highly legible at small sizes, wide language support                                                                                                                |
| Amharic (headings + body)  | **Noto Sans Ethiopic**         | Reliable Ethiopic glyph coverage across web/Android/iOS; paired weight-for-weight with Inter so bilingual layouts feel like one system rather than two fonts bolted together |

Type scale (base 16px, 1.25 ratio): `12 / 14 / 16 / 20 / 25 / 31 / 39 / 49px`
mapped to `caption, body-sm, body, h5, h4, h3, h2, h1`.

## Spacing, radius, elevation

- Spacing scale: 4px base unit — `4, 8, 12, 16, 24, 32, 48, 64`
- Radius: `8px` default (cards, buttons), `16px` for large surfaces (modals, sheets), `999px` for pills/badges — soft but not overly rounded, keeping the "elegant" register rather than "playful"
- Elevation: flat design with a single soft shadow token for floating elements (cart drawer, modals); avoid heavy skeuomorphic shadows

## Imagery

- Menu photography: bright, natural light, minimal props, consistent
  overhead or 45° angle across the catalog so the grid feels curated, not
  stitched together from mismatched photos
- No stock-photo people; if lifestyle imagery is used, it should be shot
  specifically for the brand
- Iconography: single-weight line icons (not filled), consistent stroke
  width, sourced from one icon set (e.g. Phosphor or Lucide) across web,
  admin, and mobile so the same "cup" icon never looks different between apps

## Component principles

- Generous white space; the palette is intentionally narrow, so hierarchy
  comes from spacing and type scale, not from adding more colors
- One primary action per screen, styled in Fresh Orange; everything else
  (secondary actions, nav) stays in green/neutral so the CTA is unambiguous
- Cards and surfaces use `warm-white`/`neutral-200` borders rather than
  drop shadows as the default separation technique — shadows reserved for
  truly floating elements (cart, modals, toasts)

## Where this lives in code

`packages/ui` exports the tokens above as a Tailwind preset
(`tailwind-preset.ts`) consumed by `apps/web`, `apps/admin`, and
`apps/delivery`, and as a matching NativeWind theme for `apps/mobile` —
one definition, four consumers, so a color or type-scale change is a
one-line edit that propagates everywhere instead of four manual updates.
