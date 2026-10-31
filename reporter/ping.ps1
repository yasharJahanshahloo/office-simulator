# Office Presence ping (Windows). Reporter version 2.
#
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File ping.ps1 <tool> <event>
#   tool:  claude | cursor | codex | hermes
#   event: prompt | tool | stop | test
#
# Privacy contract: the request body is exactly {credential, tool, event, v}.
# This script never reads the hook payload on stdin, so prompts and code never leave the machine.
#
# Hook mode (event != test): sends with a 2 s timeout, prints a no-op JSON object, exits 0.
# Test mode (event == test): prints "ok" or "failed: <reason>".
param([string]$Tool, [string]$Kind)
$ErrorActionPreference = 'SilentlyContinue'

function Noop {
  if ($Tool -eq 'cursor') { Write-Output '{"continue":true}' } else { Write-Output '{}' }
  exit 0
}

if ($Tool -notin @('claude', 'cursor', 'codex', 'hermes')) { Noop }
if ($Kind -notin @('prompt', 'tool', 'stop', 'test')) { Noop }

$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$cred = "$(Get-Content -Raw (Join-Path $dir 'credential'))".Trim()
$url = "$(Get-Content -Raw (Join-Path $dir 'server_url'))".Trim()
if (-not $cred -or -not $url) {
  if ($Kind -eq 'test') { Write-Output "failed: credential or server_url file missing in $dir"; exit 0 }
  Noop
}

$body = @{ credential = $cred; tool = $Tool; event = $Kind; v = '2' } | ConvertTo-Json -Compress

if ($Kind -eq 'test') {
  try {
    Invoke-RestMethod -Method Post -Uri "$url/api/events" -ContentType 'application/json' -Body $body -TimeoutSec 5 | Out-Null
    Write-Output 'ok'
  } catch {
    Write-Output "failed: $($_.Exception.Message)"
  }
  exit 0
}

try { Invoke-RestMethod -Method Post -Uri "$url/api/events" -ContentType 'application/json' -Body $body -TimeoutSec 2 | Out-Null } catch {}
Noop
