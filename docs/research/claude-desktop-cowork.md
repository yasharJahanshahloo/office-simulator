# Research: detecting Claude Desktop chat, Cowork and the Code tab (2026-10-31)

| Surface | `~/.claude/settings.json` hooks | Plugin hooks (`hooks/hooks.json` in a plugin) |
|---|---|---|
| Code tab in Claude Desktop | Yes: same settings files as the CLI | Yes (marketplace plugins, Desktop 1.32352.0+, and plugins installed for Claude Code) |
| Cowork | **No.** Cowork does not fire them and has no `/hooks` (anthropics/claude-code#63360, May 2026) | Yes: marketplace plugins, org plugins and plugins users add themselves |
| Desktop chat | No | Yes: the same plugins as Cowork, on Claude Desktop 1.52386.0+ |

Where plugin hooks run: **on the device itself, not in Cowork's VM**. So a hook can call
`~/.office-presence/ping.sh` and reach the LAN server. The Cowork VM's egress allowlist
(`coworkEgressAllowedHosts`) does not apply to hooks.

On Windows without Git for Windows, hooks run in PowerShell. With Git for Windows, they run in Git Bash.

Installing a plugin as a user: **Customize → Plugins → Add → Upload plugin**, with a `.zip` holding one
`.claude-plugin/plugin.json`. The plugin is saved to the user's account, so it also loads in Cowork and Claude Code on
their other devices. An organization owner can push a plugin to everyone via Organization settings → Plugins.

Known issues:
- anthropics/claude-code#27398: plugin hooks did not fire in Cowork on Windows (old version). Verify on a real device.
- anthropics/claude-code#40414: upload only accepts `.zip`.
- anthropics/claude-code#65426: Cowork can stay pinned to an old plugin version after a manual upload.

Implication: one plugin per user (or one org plugin) whose hooks call the already-installed ping script covers Cowork
and Desktop chat. The same plugin also fires in Claude Code sessions, so its events can't be reliably told apart from
Claude Code CLI events without reading the hook payload.

Sources: claude.com/docs/third-party/claude-desktop/extensions#plugin-hooks,
claude.com/docs/third-party/claude-desktop/chat, claude.com/docs/plugins/overview,
github.com/anthropics/claude-code/issues/63360, /27398, /40414, /65426.
