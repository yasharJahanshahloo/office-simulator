# Office Presence: setup for AI agents

You are an AI coding agent (Claude Code, Cursor, Codex or Hermes) on an employee's machine. The employee asked you to follow this file. Your job is to connect **every AI agent installed on this machine** to the office presence display. When any of them is in use, the employee's avatar shows as working in the office's 3D view.

Server: `{{SERVER}}`

## The contract

Hooks call one ping script. The script sends exactly `{credential, tool, event, v}` and nothing else. It never reads the hook's stdin, so prompts, file names and code stay on this machine. Keep that **contract** intact: wire hooks so they call the script with fixed arguments, and route nothing else to the server.

## Steps

Work through them in order. Each step ends on a **done when** line; move on only when it holds.

### 1. Check the bundle

This folder holds `install.md`, `ping.sh`, `ping.ps1`, `credential`, `server_url`, and the `claude-plugin/` template folder.

**Done when:** all of them exist next to this file.

### 2. Install the files

1. Pick the install directory: `~/.office-presence` on macOS/Linux, `%USERPROFILE%\.office-presence` on Windows.
2. Create it and copy everything from this folder into it, overwriting older copies. A reinstall with a fresh bundle replaces the old credential.
3. On macOS/Linux, run `chmod 700` on the directory, `chmod 600` on `credential`, and `chmod +x` on `ping.sh`.
4. Build `PING`, the absolute command prefix every hook uses. Expand `~` and `%USERPROFILE%` to real paths.
   - macOS/Linux: `/home/alice/.office-presence/ping.sh`
   - Windows: `powershell -NoProfile -ExecutionPolicy Bypass -File "C:/Users/alice/.office-presence/ping.ps1"`. Use forward slashes; they work in PowerShell, cmd and Git Bash alike.

**Done when:** the files are in place and you have written down the exact `PING` string.

### 3. Test the connection

Run `PING <tool> test` once, where `<tool>` is the tool you yourself are (`claude`, `cursor`, `codex` or `hermes`), e.g. `/home/alice/.office-presence/ping.sh codex test` if you are Codex. A test ping only checks the wiring; it never shows the employee as working.

**Done when:** it prints `ok`. On anything else, stop and tell the employee the matching fix:

| Output | Fix for the employee |
|---|---|
| `failed: HTTP 401` | This bundle was replaced or revoked. Press "🔄 صدور فایل جدید" in the Bale bot and use the new zip. |
| `failed: HTTP 409` | No desk is registered. Press "🚀 شروع" in the Bale bot and pick a desk. |
| `failed: HTTP 000`, `no response`, or a timeout | The server is unreachable. Connect to the office network or VPN and rerun this step. |

### 4. Find the installed AI tools

A tool counts as installed when its config directory exists or its command is on `PATH`:

| Tool (`<tool>` arg) | Config directory | Command |
|---|---|---|
| Claude Code (`claude`) | `$CLAUDE_CONFIG_DIR`, else `~/.claude` | `claude` |
| Cursor (`cursor`) | `~/.cursor` | `cursor` |
| Codex (`codex`) | `$CODEX_HOME`, else `~/.codex` | `codex` |
| Hermes (`hermes`) | `$HERMES_HOME`, else `~/.hermes` (Windows: `%LOCALAPPDATA%\hermes`) | `hermes` |

On Windows, `~` means `%USERPROFILE%`.

Also check for the **Claude Desktop app** (macOS: `/Applications/Claude.app`; Windows: an installed app named Claude, e.g. under `%LOCALAPPDATA%\AnthropicClaude`). Its Cowork mode and chat ignore the Claude Code hooks; they run hooks only from a plugin, which step 5b builds.

**Done when:** you have the list of installed tools, with the config directory you will edit for each. Tools that are not installed get no config files and no test pings.

### 5. Add the hooks

For each installed tool, add the entries from its section under [Hook reference](#hook-reference). Apply these merge rules to every file:

- Copy the file to `<file>.bak-office-presence` before the first edit. A missing file means you create it fresh.
- Parse the file, add the entries, and write it back with every existing key and hook preserved.
- An office-presence entry is any hook whose command contains `.office-presence/ping` or `.office-presence\ping`. Replace existing office-presence entries in place; each event ends up with exactly one.
- Use the exact `PING` string from step 2.

**Done when:** each edited file parses (JSON, TOML or YAML), and each installed tool has exactly one office-presence entry for every event in its table.

### 5b. Build and install the Claude Desktop plugin

Skip this step when Claude Desktop is not installed.

1. In `<install dir>/claude-plugin/hooks/hooks.json`, replace every `{{PING}}` with the exact `PING` string. Edit it as JSON (parse, set the three `command` values, serialize), so the quotes inside a Windows `PING` are escaped.
2. Zip the **contents** of `<install dir>/claude-plugin/` into `<install dir>/office-presence-claude-plugin.zip`, so the archive root holds `.claude-plugin/plugin.json` and `hooks/hooks.json`.
3. **Install it yourself first.** Use any route on this machine that adds a plugin to the employee's Claude Desktop (Cowork and chat), e.g. an install command of the Claude Desktop app or of the `claude` CLI that targets the Desktop app or the employee's Claude account. A route that installs only into the Claude Code CLI does not count: step 5 already covers Claude Code.
4. If no route works, the employee uploads it by hand: in Claude Desktop, **Customize → Plugins → Add → Upload plugin**, then pick `office-presence-claude-plugin.zip`.

Hooks in Desktop chat need Claude Desktop 1.52386.0 or later; Cowork runs them in any version with plugins.

**Done when:** the zip exists, and either you installed the plugin (say how) or the employee has the upload instructions with the zip's full path.

### 6. Test every tool

For each tool you configured in step 5, and only those, run `PING <tool> test`. Check with `test` only: running a hook command such as `PING claude prompt` by hand reports real AI use and shows the employee as working. The Claude Desktop plugin uses the `claude` ping, so it needs no separate test.

**Done when:** each one prints `ok`. The employee also receives a "✅ وصل شد" message in Bale for each tool.

### 7. Report

Tell the employee, in a few lines:

- the install directory and the tools you configured;
- the test result for each tool;
- the approvals still waiting on them:
  - **Codex:** open `/hooks` in Codex and trust the three office-presence hooks. Codex skips untrusted hooks.
  - **Hermes:** approve each office-presence hook when the next `hermes chat` asks. Approval is a one-time step per hook.
  - **Claude Code, Cursor:** hooks load in new sessions; restart open windows.
  - **Claude Desktop:** if you could not install the plugin, the upload steps from step 5b with the zip's full path. Then quit and reopen Claude Desktop.

## Hook reference

`PING` is the string from step 2. Each table maps the tool's event to the ping event argument.

### Claude Code

File: `<config dir>/settings.json`, under the top-level `"hooks"` object.

| Claude Code event | Command |
|---|---|
| `UserPromptSubmit` | `PING claude prompt` |
| `PostToolUse` | `PING claude tool` |
| `Stop` | `PING claude stop` |

```json
{
  "hooks": {
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "PING claude prompt", "async": true }] }],
    "PostToolUse": [{ "matcher": "*", "hooks": [{ "type": "command", "command": "PING claude tool", "async": true }] }],
    "Stop": [{ "hooks": [{ "type": "command", "command": "PING claude stop", "async": true }] }]
  }
}
```

### Codex

File: `<config dir>/hooks.json`. If `<config dir>/config.toml` already holds a `[hooks]` table, add the same entries there in TOML instead, so each layer keeps one representation.

| Codex event | Command |
|---|---|
| `UserPromptSubmit` | `PING codex prompt` |
| `PostToolUse` | `PING codex tool` |
| `Stop` | `PING codex stop` |

```json
{
  "hooks": {
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "PING codex prompt", "async": true }] }],
    "PostToolUse": [{ "hooks": [{ "type": "command", "command": "PING codex tool", "async": true }] }],
    "Stop": [{ "hooks": [{ "type": "command", "command": "PING codex stop", "async": true }] }]
  }
}
```

### Cursor

File: `~/.cursor/hooks.json`, with `"version": 1` at the top level. Use only the four agent events below; Tab completions stay out of the display.

| Cursor event | Command |
|---|---|
| `beforeSubmitPrompt` | `PING cursor prompt` |
| `afterFileEdit` | `PING cursor tool` |
| `afterShellExecution` | `PING cursor tool` |
| `stop` | `PING cursor stop` |

```json
{
  "version": 1,
  "hooks": {
    "beforeSubmitPrompt": [{ "command": "PING cursor prompt" }],
    "afterFileEdit": [{ "command": "PING cursor tool" }],
    "afterShellExecution": [{ "command": "PING cursor tool" }],
    "stop": [{ "command": "PING cursor stop" }]
  }
}
```

### Hermes

File: `<config dir>/config.yaml`, under the top-level `hooks:` key. If the employee uses named Hermes profiles, ask which profiles to cover and edit each profile's `config.yaml` the same way. Leave `hooks_auto_accept` as it is.

| Hermes event | Command |
|---|---|
| `pre_llm_call` | `PING hermes prompt` |
| `post_tool_call` | `PING hermes tool` |
| `on_session_end` | `PING hermes stop` |

```yaml
hooks:
  pre_llm_call:
    - command: "PING hermes prompt"
      timeout: 5
  post_tool_call:
    - command: "PING hermes tool"
      timeout: 5
  on_session_end:
    - command: "PING hermes stop"
      timeout: 5
```

## Uninstall

When the employee asks to remove Office Presence:

1. In every config file listed in the hook reference, delete each office-presence entry, i.e. every hook whose command contains `.office-presence/ping` or `.office-presence\ping`. Drop any event list or matcher group this leaves empty. Leave everything else as it was.
2. Remove the office-presence plugin from Claude Desktop (Customize → Plugins), or tell the employee to.
3. Delete the install directory.

**Done when:** no config file mentions `.office-presence`, the plugin is removed or the employee knows to remove it, and the install directory is gone.
