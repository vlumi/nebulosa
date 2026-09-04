#!/usr/bin/env bash
# Capture the site with headless Chrome.
#
#   scripts/screenshot.sh docs/screenshots/2026-09-04-m1.png                      # deployed site
#   scripts/screenshot.sh out.png http://localhost:4173/                          # local preview
#   CHROME=/usr/bin/google-chrome scripts/screenshot.sh out.png                   # other Chrome
#   VIRTUAL_TIME_MS=90000 scripts/screenshot.sh out.png                            # slow tiles
set -euo pipefail

out=${1:?usage: screenshot.sh <output.png> [url]}
url=${2:-https://nebulosa.misaki.fi/}
chrome=${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}
budget=${VIRTUAL_TIME_MS:-30000}

# Virtual time lets the element fetch and the map tiles settle before the shot; a plain timeout
# fires at the load event, which is too early for both.
"$chrome" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist \
  --window-size=1400,900 --hide-scrollbars --virtual-time-budget="$budget" \
  --screenshot="$out" "$url" >/dev/null 2>&1
echo "Saved $out"
