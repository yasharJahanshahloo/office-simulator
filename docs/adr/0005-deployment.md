# ADR-0005: Deployment

Status: accepted (2026-10-31)

## Decision
- Source of truth: GitHub `git@github.com:yasharJahanshahloo/office-simulator.git`.
- Workflow: develop on the laptop (`~/simulator`) → push → on the dev server `git pull`, build, deploy.
- Target: dev server `LNX-HDD-22` (172.16.24.90, office LAN only; see `~/server/AGENTS.md` on the laptop),
  checkout at `~/office-simulator`.
- One Node process: web app + event API + Bale bot (long polling), run as the **systemd user service**
  `office-presence` (same pattern as the server's other bots; linger keeps it up across reboots).
  SQLite file and allowlist in `server/data/`. `deploy/deploy.sh` pulls, builds, tests and restarts.
- Docker was the original plan; dropped because `docker compose` hangs on that host and Docker Hub
  needs Iranian mirrors there, while Node 24 is already installed (`~/.n/bin/node`).
- Secrets (`BALE_BOT_TOKEN`, `CREDENTIAL_KEY`, `ADMIN_IDS`) live only in `.env` on the server; never committed.

## Facts verified 2026-10-31
- Server reaches GitHub over SSH (authenticated as yasharJahanshahloo) and `tapi.bale.ai` directly.
- Docker 29.9.1 works without sudo; `docker compose version` hung during the check — investigate at deploy time
  (moot: Docker not used, see above).
- Ports in use on the server include 3999 and 8080; the app uses 8090.
- The server's disk is very slow under load (synchronous writes ~11 KB/s, IO pressure ~60%):
  SQLite runs WAL + `synchronous=NORMAL`, activity writes are throttled to one per user per 30 s,
  and `deploy.sh` skips `npm ci` when the lockfile is unchanged. Cold start (tsx compile) takes a few seconds.
