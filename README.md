# Office Presence Simulator

A 3D view of our office in the browser. Each employee's avatar sits at their desk and shows as **working** while they use an AI agent (Claude Code, Cursor, Codex, Hermes). The goal is to make AI usage visible and increase adoption.

Read `CONTEXT.md` for the domain language and `docs/adr/` for the decisions.

## Layout

| Path | What |
|---|---|
| `web/` | Vite + Three.js client: office scene, avatars, HUD |
| `server/` | Node server: event API, SSE presence stream, Bale bot, static hosting of `web/dist` |
| `shared/presence.ts` | Server ↔ client contract |
| `reporter/` | What goes into an employee's setup zip: `ping.sh`, `ping.ps1`, `install.md` (written for AI agents) |
| `deploy/` | systemd user unit and the deploy script for the dev server |

## Develop

```sh
cd server && cp .env.example .env   # fill in CREDENTIAL_KEY; leave BALE_BOT_TOKEN empty unless you mean to poll the real bot
npm install && npm run dev          # :8090
cd ../web && npm install && npm run dev   # :5173, proxies /api → :8090
```

Without a server, open the web app with `?demo=1`. `npm test` in `server/` runs the core tests.

Only one process may poll the Bale bot at a time. Leave the token unset locally while the server is running it.

## Deploy

Dev server `LNX-HDD-22` (172.16.24.90, office LAN). The checkout lives on the SSD at `/mnt/ssd/home/office-simulator`, symlinked from `~/office-simulator` like the server's other projects. It serves on port 8090 as the systemd user service `office-presence`.

1. Push to `main` on GitHub.
2. On the server, run `~/office-simulator/deploy/deploy.sh`. It pulls, builds, tests and restarts the service.

The secrets live only in `~/office-simulator/server/.env` on the server. The allowlist is `server/data/allowlist.txt` there, one Bale user id per line, and is re-read on every message.

Logs: `journalctl --user -u office-presence -f`. Each bot update is logged; set `BOT_DEBUG=1` in `.env` to dump raw updates.
