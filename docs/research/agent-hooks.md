# Research: AI agent hook mechanisms (2026-10-31)

All four tools have native hooks with a "prompt sent" and "turn ended" event. All key payloads
contain prompt/response text → the hook script must build its own body and never forward stdin.

| Tool | Prompt sent | Turn ended | User config | Payload | Notes |
|---|---|---|---|---|---|
| Claude Code | `UserPromptSubmit` | `Stop` / `StopFailure` (no event on user interrupt) | `~/.claude/settings.json` (Win `%USERPROFILE%\.claude`) | stdin JSON | Fires in terminal, IDE ext, Desktop. Use `async: true`, exit 0, print nothing (stdout injected into context). |
| Codex | `UserPromptSubmit` | `Stop`, `Interrupt` | `~/.codex/hooks.json` or `[hooks]` in `config.toml` | stdin JSON (legacy `notify`: argv, turn-complete only) | Non-managed hooks need `/hooks` trust approval, re-approved when the hook changes. Desktop app background threads emit `UserPromptSubmit` without `Stop` (openai/codex#18541) — null `transcript_path` heuristic. `UserPromptSubmit` since ~v0.116. |
| Cursor | `beforeSubmitPrompt` | `stop` (`completed`/`aborted`/`error`) | `~/.cursor/hooks.json` (`"version": 1`) | stdin JSON (Win: PowerShell) | Since 1.7 (beta). Also Tab hooks: `afterTabFileEdit`. Payload has `user_email`. Non-empty `followup_message` on `stop` output gets auto-submitted — print nothing. |
| Hermes Agent | `pre_llm_call` | `on_session_end` (turn-scoped, incl. interrupts) | `hooks:` in `~/.hermes/config.yaml` (Win `%LOCALAPPDATA%\hermes`) | stdin JSON | Each hook needs one-time consent; pre-approve via allowlist file / `hooks_auto_accept`. Printing `{"context":…}` injects into prompt — print nothing. |

Managed (MDM) locations exist for Claude Code, Codex (`requirements.toml`) and Cursor (`/etc/cursor/hooks.json`, etc.).

Design implications:
- Sanitize in the hook: send only `{token, tool, event, ts}` (+ optional opaque session id).
- Hook must be non-blocking (async / short curl timeout), always exit 0, print nothing.
- Server must expire "working" by timeout — missing turn-end events are common.

Sources: code.claude.com/docs/en/hooks, learn.chatgpt.com/docs/hooks.md, cursor.com/docs/agent/hooks,
hermes-agent.nousresearch.com/docs/user-guide/features/hooks, openai/codex#18541.
