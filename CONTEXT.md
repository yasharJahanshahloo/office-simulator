# Office Presence Simulator — Context

A browser-based 3D view of our office where each employee's avatar sits at their desk.
An avatar is shown **working** only while that person is actively using an AI agent.
Purpose: make AI usage visible and social, to increase AI adoption across the company.

## Glossary

- **Office** — the stylized low-poly 3D model of our real floor plan (`web/src/office/layout.ts`).
- **Seat** — a place an avatar can sit. Has a stable id (`desk-A1`…`desk-E4`, `meeting-*`, `lounge-*`).
- **Desk seat** — one of the 24 seats in zone `desk`; the only seats assigned to employees.
- **Employee** — a Bale user registered to exactly one desk seat. Remote employees get a seat too.
- **Seat assignment** — config mapping `employee → desk seat id`. Mock data until real roster is provided.
- **AI agent** — one of: Cursor, Claude (Claude Code, Code tab, Cowork, Desktop chat — one tool), Codex (OpenAI), Hermes Agent (Nous Research).
- **Claude plugin** — per-user plugin built by the installing agent; the only way Cowork and Desktop chat run hooks.
- **Activity event** — a heartbeat emitted by an AI agent's native hook: `{employee, tool, event, timestamp}`. Nothing else.
- **Reporter** — the tiny per-OS ping script plus hook entries on an employee machine; installed by the employee's own AI agent following `install.md`.
- **Credential** — the employee's Bale user id, encrypted by the server, built into their setup zip; identifies the employee on every activity event.
- **Setup zip** — what the bot sends a registered user: latest reporter scripts + credential + install.md.
- **Seat label** — short human label of a desk seat (e.g. `A1`) shown on the seat map; typed by the user to register.
- **Registration** — binding of one Bale user to one desk seat. Created by the user via the bot; removable by admin.
- **Admin** — can unregister seats, ban Bale user ids, and get a registration report, via the bot.
- **Bale bot** — onboarding entry point: registration to a seat, then delivers the setup zip.
- **Name tag** — Bale `@username` (or first 14 chars of display name if none), shown on their desk (on the table).
- **Allowlist** — Bale user ids permitted to register; provided by the admin.
- **Avatar state**
  - **working** — an activity event was received within the activity window.
  - **idle** — reporter installed, but no activity event within the window.
  - **away** — no reporter installed / never seen (empty seat).
- **Activity window** — how long one activity event keeps an avatar "working" (default ~5 min, TBD).

## Decisions so far
- [ADR-0001](docs/adr/0001-detect-activity-via-native-hooks.md) — detect via native tool hooks, "working" = recent AI activity
- [ADR-0002](docs/adr/0002-privacy-minimal-payload-opt-in.md) — minimal payload, opt-in
- [ADR-0003](docs/adr/0003-ambient-display-internal-hosting.md) — ambient display, internal hosting, no auth in v1
- [ADR-0004](docs/adr/0004-onboarding-via-bale-bot.md) — onboarding via Bale bot; agents self-install via install.md
- [ADR-0005](docs/adr/0005-deployment.md) — GitHub → dev server LNX-HDD-22, systemd user service
- Working = 5-min activity window + 'agent busy' animation; Cursor Tab does not count.
- Avatars: low-poly figures, shirt colour, name tag on the desk, tool icon when working; static at desks in v1.
- HUD: 'N of M working with AI', per-tool counts, clock; TV-friendly auto-orbit; no leaderboard.
- Server: Node/TS, POST /events, SSE to browsers. Live state in memory; registrations/bans/credential versions in SQLite (`node:sqlite`). Allowlist from config.
- Non-allowlisted users are ignored silently by the bot.
- Idle = pinged earlier today (Tehran time); away = registered, no ping today (empty desk, name tag stays); unregistered = empty desk, no tag.

## Facts
- Employee machines: mixed macOS / Linux / Windows → reporter must be cross-platform.
- Fixed desks; 24 desk seats in the current layout. Mock roster for now; real data provided later.
