# Landing hero video

Build pipeline for the animated hero on the landing page. The video is a
[HyperFrames](https://github.com/heygen-com/hyperframes) composition (HTML/CSS +
GSAP → MP4) whose scenes are **real screenshots of the app**, captured with
Playwright via the user-guide generator.

It is **vertical 9:16** (1080×1920) — Tablito is a phone-first PWA and the link
is shared to parents on their phones, so the hero fills a portrait viewport and
doubles as a shareable clip. **Bilingual**: one render per language →
`public/video/hero.<lang>.mp4` (+ poster). The landing serves the file matching
the visitor's language and autoplays it muted/looping, with the poster as the
`prefers-reduced-motion` / no-JS fallback.

Only the final MP4 + posters are committed (under `../public/`). The
intermediate screenshots and renders are **gitignored** (derived, regenerable).

```
landing-video/
  composition/
    index.html          the HyperFrames composition (scenes + GSAP timeline)
    design.md           brand/design system (Tablito tokens, Piou, motion)
    captions/{fr,en}.js  the on-screen copy per language (keys = data-cap)
    caps.active.js       re-exports the language being rendered (committed = fr)
    assets/              screenshots (gitignored) + self-hosted fonts (committed)
  build.sh              one language end-to-end: assets → captions → render → encode
  encode.sh            newest render → ../public/video/hero.<lang>.mp4 + poster
```

## Prerequisites

- Node 22+ and FFmpeg (`ffmpeg -version`)
- `npx playwright install chromium` (the guide generator uses it)
- HyperFrames runs via `npx hyperframes@0.6.95` (downloaded on first use)

## Regenerate

The screenshots come from the user-guide generator (same seeded profiles, both
languages). From the **repo root**:

```bash
BASE=/ npm run build        # the guide serves dist/
npm run user-guide          # captures fr + en into dist/guide/[en/]/screenshots
```

Then, from `landing-video/`:

```bash
bash build.sh fr            # → ../public/video/hero.fr.mp4 + poster
bash build.sh en            # → ../public/video/hero.en.mp4 + poster
```

`build.sh` copies the scene screenshots from the guide (the list is at its
top, with the two-beat pairs of scenes `sd` and `sc`), points `caps.active.js`
at the language, renders, and encodes. It restores `caps.active.js` to `fr` at
the end.

Commit the updated `../public/video/hero.{fr,en}.mp4` and
`../public/img/hero-poster.{fr,en}.jpg`.

## Editing the video

- Preview live: `cd composition && npm run dev` (Studio at http://localhost:3002),
  or check a frame grid with `npx hyperframes@0.6.95 snapshot --at 1.8,5.2,8.6,12,15.4,19`.
- `npm run check` (lint + validate + inspect). The composition lints with 0
  errors; the residual warnings are benign (dynamic GSAP selectors the static
  linter can't resolve + a Studio drag-edit note — both expected for a
  programmatic timeline).
- Brand lives in `composition/design.md`. The captions live in
  `composition/captions/{fr,en}.js` — keep the two in sync.
- ⚠ The Studio injects `data-hf-id` attributes into `index.html` while running;
  strip them before committing: `sed -i '' 's/ data-hf-id="[^"]*"//g' composition/index.html`.

## Scenes

1. La séance du jour (home) · 2. Bonne réponse → étoile dorée · 3. Les niveaux
suivants (`sd`) : la division, puis la division avec reste · 4. Propre à la
langue (`sc`) : les deux autres matières en fr (conjugaison, puis verbes
irréguliers anglais dits à voix haute — toutes deux masquées en anglais), la
réponse à voix haute en en (pavé numérique, puis micro) · 5. L'image mystère
qui se dévoile (signature) · 6. Progrès sans notes ni classement (badges) ·
7. Pour les parents : le point de la semaine, suivi depuis son téléphone ·
8. Lockup Piou + Tablito + tagline + `tablito.app`.

Scenes 3 and 4 have two beats: two screenshots in turn (`.next` over the
first), and the end of the title changes with them, at half the scene.

**Pacing.** A scene's words come first and its phone a beat later
(`PHONE_IN` in the timeline), so they are read before the picture draws the
eye; scenes are held long enough for the words to stay on screen about 4 s. At
3.6 s per scene (until October 2026) they were readable for under 2 s — too
short to both read and look.

To add a scene: a `.scene.clip` in `index.html` (its `data-start` /
`data-duration` drive the timeline; shift the following scenes and the root
`data-duration`), its captions in both languages, its screenshot in `build.sh`.
