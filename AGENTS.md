# Office Presence Simulator

Domain words: `CONTEXT.md`. Decisions: `docs/adr/`; read the ADR before changing what it decides. Layout, dev and deploy commands: `README.md`.

## Invariants

- **Privacy contract**: an activity event is `{credential, tool, event, v}`, nothing more. Hooks call the ping script with fixed arguments; the script never reads the hook's stdin.
- **Hooks return instantly**: `reporter/ping.*` detach the send. Cursor and Hermes wait on every hook, so any network wait in a hook slows the employee's AI tool.
- A `test` ping proves the wiring and never changes an avatar.
- Editing `reporter/ping.*`: bump the reporter version `v`. Installed copies change only when employees install a new zip from the bot.
- `shared/avatar.ts` owns the avatar options and code format; every code already handed out keeps decoding.

## Gotchas

- Deploy with `nohup ~/office-simulator/deploy/deploy.sh > /tmp/office-deploy.log 2>&1 &` on the server and watch the log: its disk is slow, so a deploy takes minutes.
- Off the office LAN, the server (172.16.24.90) needs the user's `servervpn` (it asks for sudo, so the user runs it).
- Kill processes by PID. `pkill -f <pattern>` kills the Bash tool's own shell when the pattern is in the command.
- Screenshots run headless Chrome with `--use-angle=swiftshader`; the user's laptop once hard-locked on a GPU hang.
- Only the server polls the bot token. Test the bot as the user through the maviz skill (`@office_sims_bot`).
