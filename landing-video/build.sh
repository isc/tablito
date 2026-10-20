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

# 1. Source the scene screenshots from the guide capture. Scenes `sd` and `sc`
#    show two screenshots in turn: the next levels (division, then
#    remainders) and, language-specific, the two other subjects in fr
#    (conjugation, then English irregular verbs — both hidden in an English
#    UI), the spoken answer in en (keypad, then microphone).
echo "[$LANG_CODE] assets ← $SHOTS"
cp "$SHOTS/05-home.png"                     composition/assets/s1.png
cp "$SHOTS/08-session-feedback-correct.png" composition/assets/s2.png
cp "$SHOTS/10-progress.png"                  composition/assets/s3.png
cp "$SHOTS/11-badges.png"                    composition/assets/s4.png
cp "$SHOTS/13e-parent-week.png"              composition/assets/sp.png
cp "$SHOTS/16-division-intro.png"            composition/assets/sd.png
cp "$SHOTS/21-remainder-intro.png"           composition/assets/sd2.png
case "$LANG_CODE" in
  fr)
    cp "$SHOTS/24-conj-question.png"         composition/assets/sc.png
    cp "$SHOTS/26-irr-voice.png"             composition/assets/sc2.png ;;
  en)
    cp "$SHOTS/07-session-question.png"      composition/assets/sc.png
    cp "$SHOTS/07b-session-voice.png"        composition/assets/sc2.png ;;
  *)
    echo "No \`sc\` scene for $LANG_CODE: pick its two screenshots here, its words in captions/$LANG_CODE.js" >&2
    exit 1 ;;
esac

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
