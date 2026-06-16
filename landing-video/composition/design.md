# Tablito — Hero video design system

Brand identity for the landing-page hero. Warm, calm, reassuring — matches the
app's own UI (the `--cream/--indigo/--ink` token set in `src/index.css`).
The opposite of a hype reel: this sells *douceur*, not performance.

## Palette

- Background base: `#FBF6EC` (`--cream`, app bg)
- Background accent wash: `#F3EADB` (`--cream-deep`) / `#F7E9C4` (`--honey-soft`)
- Surface / cards: `#FFFFFF` (`--paper`)
- Border: `#EADFCB`
- Text: `#1E1A2E` (`--ink`)
- Text muted: `#6B6678` (ink at ~60%)
- Accent (primary): `#4F46BA` (`--indigo`)
- Mascot Piou (accents, sparkles): body `#F0B43A`, belly/highlight `#FBD96C`

## Typography

- Headlines: **Fraunces** (the app's H1 face), `font-weight: 600`, letter-spacing
  `-0.01em`. Warm, slightly editorial serif.
- Body / chips: **Nunito**, 600–700. Rounded, friendly sans.
- Both are self-hosted in `../../public/fonts/` (woff2, latin subset).

## Motion

- Easing: `power3.out` for entrances, `sine.inOut` for the mid-scene drift,
  `power2.in` for exits.
- Calm and confident — gentle slides, soft crossfades, a slow Ken-Burns float on
  the phone. Nothing bouncy except a single small `back.out` pop on the final CTA.
- No shader transitions: hard crossfades only. This is a focused learning tool.

## Surfaces

- **Phone mockup**: portrait device bezel (≈9:19, matches the 360×760 capture
  viewport) — ink-coloured frame, radius `52px`, soft shadow
  `0 40px 90px rgba(30,26,46,0.18)`. The screenshot fills the screen, radius `40px`.
- **Chips**: pill radius, `--honey-soft` background, `--indigo` text, 600 weight.
- Cards/screens never touch the frame edge: ≥120px title-safe padding.
