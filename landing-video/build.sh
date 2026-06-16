#!/usr/bin/env bash
# Build one language's hero video end-to-end:
#   screenshots (from the user guide) → captions swap → render → encode.
#   bash build.sh <lang>        (fr | en)
#   bash build.sh fr && bash build.sh en   # both
# Run from landing-video/.
#
# Prereq: the user-guide screenshots for <lang> must exist. Regenerate with
#   GUIDE_LANGS=<lang> npm run user-guide      (from the repo root)
# The screenshots are derived (gitignored); only the final hero.<lang>.mp4 +
# poster (in ../public/) are committed.
set -euo pipefail
cd "$(dirname "$0")"

LANG_CODE="${1:?usage: build.sh <lang>  (fr | en)}"
ROOT="$(cd .. && pwd)"

# The guide writes FR to dist/guide/screenshots and other langs to dist/guide/<lang>/screenshots.
if [ "$LANG_CODE" = "fr" ]; then
  SHOTS="$ROOT/dist/guide/screenshots"
else
  SHOTS="$ROOT/dist/guide/$LANG_CODE/screenshots"
fi
[ -d "$SHOTS" ] || { echo "Missing $SHOTS — run: GUIDE_LANGS=$LANG_CODE npm run user-guide (from repo root)" >&2; exit 1; }

# 1. Source the four scene screenshots from the guide capture.
echo "[$LANG_CODE] assets ← $SHOTS"
cp "$SHOTS/05-home.png"                     composition/assets/s1.png
cp "$SHOTS/08-session-feedback-correct.png" composition/assets/s2.png
cp "$SHOTS/10-progress.png"                  composition/assets/s3.png
cp "$SHOTS/11-badges.png"                    composition/assets/s4.png

# 2. Point the composition's captions at this language.
printf "// Réécrit par build.sh pour le rendu en cours. Committé sur fr par défaut.\nexport { default as CAPS } from './captions/%s.js';\n" "$LANG_CODE" > composition/caps.active.js

# 3. Render the composition to composition/renders/*.mp4.
echo "[$LANG_CODE] rendering…"
( cd composition && npx --yes hyperframes@0.6.95 render )

# 4. Encode the web-ready portrait hero + poster into ../public/.
bash encode.sh "$LANG_CODE"

# Leave the committed default (fr) in place after a run.
printf "// Réécrit par build.sh pour le rendu en cours. Committé sur fr par défaut.\nexport { default as CAPS } from './captions/fr.js';\n" > composition/caps.active.js
echo "[$LANG_CODE] done."
