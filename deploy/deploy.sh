#!/usr/bin/env bash
# Run on the dev server from ~/office-simulator: pull, build, (re)start.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.n/bin:$PATH"

git pull --ff-only

# npm ci is slow on this disk: reinstall only when the lockfile changed.
install_deps() {
  local stamp=node_modules/.lock-sha
  local sha; sha=$(sha256sum package-lock.json | cut -d' ' -f1)
  if [ "$(cat "$stamp" 2>/dev/null)" != "$sha" ]; then
    npm ci --no-audit --no-fund && echo "$sha" > "$stamp"
  fi
}

(cd web && install_deps && npm run build)
(cd server && install_deps && npm run typecheck && npm test)

mkdir -p server/data
[ -f server/data/allowlist.txt ] || cp server/allowlist.example.txt server/data/allowlist.txt
if [ ! -f server/.env ]; then
  echo "server/.env is missing; create it from server/.env.example" >&2
  exit 1
fi

mkdir -p ~/.config/systemd/user
install -m 644 deploy/office-presence.service ~/.config/systemd/user/office-presence.service
systemctl --user daemon-reload
systemctl --user enable office-presence.service >/dev/null
systemctl --user restart office-presence.service
sleep 2
systemctl --user --no-pager --lines=5 status office-presence.service
