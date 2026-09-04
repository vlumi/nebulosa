#!/usr/bin/env bash
# Build and publish to the web root.
#
#   ./deploy.sh                 # pull, build, publish to $WEBROOT
#   ./deploy.sh --no-pull       # build the working tree as-is
#   WEBROOT=/path ./deploy.sh   # override the publish dir
#
# The web root is asked on first run and saved to .deploy.local (git-ignored).
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

# Two renames instead of copying into the live root, so nginx never serves a half-written site.
staging="$WEBROOT.new"
previous="$WEBROOT.old"
mkdir -p "$(dirname "$WEBROOT")"
rm -rf "$staging" "$previous"
cp -R dist "$staging"
[[ -d "$WEBROOT" ]] && mv "$WEBROOT" "$previous"
mv "$staging" "$WEBROOT"
rm -rf "$previous"

echo "Published $(git rev-parse --short HEAD) to $WEBROOT"
