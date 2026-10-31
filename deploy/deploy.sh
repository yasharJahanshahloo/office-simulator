#!/usr/bin/env bash
# Run on the dev server from ~/office-simulator: pull, build, (re)start.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.n/bin:$PATH"

git pull --ff-only

(cd web && npm ci --no-audit --no-fund && npm run build)
(cd server && npm ci --no-audit --no-fund && npm run typecheck && npm test)

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
