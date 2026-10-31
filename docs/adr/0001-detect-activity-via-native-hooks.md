# ADR-0001: Detect AI activity via native tool hooks

Status: accepted (2026-10-31)

## Context
We must show an avatar as "working" only while its employee is using an AI agent.
"Tool is running" is useless as a signal (Cursor is the everyday editor). Vendor
usage/admin APIs are aggregated and hours-to-days delayed — unusable for live presence.

## Decision
- "Working" means **recent AI activity**: an activity event (prompt submitted, agent tool call/edit,
  turn end) within the activity window (~5 min). Each event refreshes a lease that expires on its own.
- Events come from each tool's **native hook mechanism** (Claude Code hooks, Codex notify/hooks,
  Cursor agent hooks, Hermes Agent shell hooks — all verified, see docs/research/agent-hooks.md).
- A single cross-platform **reporter** installs the hooks for whichever tools are present.
- Process-watching daemon only as a fallback for tools without hooks.

## Consequences
- Precise, real-time signal; no always-on daemon.
- Turn-end events are unreliable (interrupts, Codex app background threads) → server-side timeout is mandatory.
- Codex and Hermes require one-time hook trust/consent; the installer should pre-approve where possible.
- Hook configs differ per tool/OS; the reporter must handle mac/Linux/Windows.

## Addendum (2026-10-31): Claude Desktop, Cowork and chat
- Cowork and Desktop chat ignore `~/.claude/settings.json` hooks; they run hooks only from plugins, on the
  device (not in Cowork's VM). See docs/research/claude-desktop-cowork.md.
- The setup zip carries a Claude plugin template whose hooks call the same ping script. The installing agent
  fills in `PING`, tries to install it into Claude Desktop itself, and otherwise hands the employee the
  Customize → Plugins → Upload steps (per-user, not org-wide).
- All Claude surfaces report as one tool, `claude`, shown as "Claude": the account-level plugin also fires in
  Claude Code sessions, so surfaces can't be told apart without reading the hook payload. Desktop chat counts as AI use.
