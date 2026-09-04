#!/usr/bin/env bash
# Build and publish a release under the web root, then point `current` at it.
#
#   ./deploy.sh                 # pull, build, publish to $WEBROOT/releases/<sha>
#   ./deploy.sh --no-pull       # build the working tree as-is
#   WEBROOT=/path ./deploy.sh   # override the web root
#
# The web root must be writable by the deploying user; it is asked on first run and
# saved to .deploy.local (git-ignored). nginx serves $WEBROOT/current and $WEBROOT/data.
# The first run also installs the daily TLE refresh in the user's crontab.
set -euo pipefail

cd "$(dirname "$0")"

config=.deploy.local
if [[ -z "${WEBROOT:-}" && -f "$config" ]]; then
  # shellcheck source=/dev/null
  source "$config"
fi
if [[ -z "${WEBROOT:-}" ]]; then
  if [[ ! -t 0 ]]; then
    echo "WEBROOT not set and $config missing; run interactively once or set WEBROOT" >&2
    exit 1
  fi
  read -r -p "Web root [/var/www/nebulosa]: " answer
  WEBROOT=${answer:-/var/www/nebulosa}
  printf 'WEBROOT=%q\n' "$WEBROOT" > "$config"
  echo "Saved to $config"
fi

if [[ "${1:-}" != "--no-pull" ]]; then
  git pull --ff-only
fi

npm ci --no-audit --no-fund
npm run build

release="$WEBROOT/releases/$(git rev-parse --short HEAD)"
rm -rf "$release"
mkdir -p "$WEBROOT/releases"
cp -R dist "$release"
[[ -e "$WEBROOT/data/tles.json" ]] || node scripts/fetch-tles.mjs "$WEBROOT/data/tles.json"
ln -sfn "releases/$(basename "$release")" "$WEBROOT/current"
ls -1dt "$WEBROOT"/releases/* | tail -n +4 | xargs -r rm -rf

fetch="$PWD/scripts/fetch-tles.mjs"
if ! crontab -l 2>/dev/null | grep -qF "$fetch"; then
  cron_line="17 3 * * * $(command -v node) $fetch $WEBROOT/data/tles.json >> $WEBROOT/fetch-tles.log 2>&1"
  { crontab -l 2>/dev/null || true; echo "$cron_line"; } | crontab -
  echo "Installed cron job: $cron_line"
fi

echo "Published $(basename "$release") to $WEBROOT/current"
