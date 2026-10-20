#!/usr/bin/env bash
# Encode the newest HyperFrames render into the web-ready, per-language hero
# assets the landing serves: a small 9:16 MP4 + a poster frame.
#   bash encode.sh <lang>   (e.g. fr, en) → ../public/video/hero.<lang>.mp4
# Run from landing-video/. Usually called by build.sh, not directly.
set -euo pipefail
cd "$(dirname "$0")"

LANG_CODE="${1:?usage: encode.sh <lang>  (e.g. fr, en)}"

SRC=$(ls -t composition/renders/*.mp4 2>/dev/null | head -1)
if [ -z "${SRC:-}" ]; then
  echo "No render found. Run: (cd composition && npm run render)" >&2
  exit 1
fi
echo "Encoding ($LANG_CODE) from: $SRC"

mkdir -p ../public/video ../public/img

# Portrait 9:16, downscaled to 720×1280 — small enough for a landing hero,
# muted (no audio track: the landing autoplays it looping). CRF 31: the
# screenshots' small text reads the same as at 28 (checked on still and moving
# frames), for a quarter less weight. A single keyframe (the loop only ever
# restarts at 0, it never seeks) and `-tune animation` (flat UI, long holds)
# take another quarter off, at an SSIM no lower than without them.
ffmpeg -y -i "$SRC" -vf "scale=720:1280:flags=lanczos" \
  -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 31 -preset veryslow \
  -tune animation -g 9999 -keyint_min 9999 \
  -movflags +faststart -an "../public/video/hero.${LANG_CODE}.mp4"

# Poster frame from the opening scene (home + headline), once the phone has
# risen in (PHONE_IN + RISE in the composition's timeline) — the no-JS /
# reduced-motion fallback.
ffmpeg -y -ss 2.5 -i "$SRC" -frames:v 1 -update 1 -vf "scale=720:1280:flags=lanczos" \
  -q:v 4 "../public/img/hero-poster.${LANG_CODE}.jpg"

echo "Wrote ../public/video/hero.${LANG_CODE}.mp4 and ../public/img/hero-poster.${LANG_CODE}.jpg"
