# Office Presence ping (Windows). Reporter version 3.
#
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File ping.ps1 <tool> <event>
#   tool:  claude | cursor | codex | hermes
#   event: prompt | tool | stop | test
#
# Privacy contract: the request body is exactly {credential, tool, event, v}.
# This script never reads the hook payload on stdin, so prompts and code never leave the machine.
#
# Hook mode (event != test): returns at once with a no-op JSON object; the AI tool never waits on the
# network. The request runs in a separate hidden PowerShell process. After a failed send, sends are
# skipped for 60 s (.offline marker), so being off the office network costs nothing.
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

$body = @{ credential = $cred; tool = $Tool; event = $Kind; v = '3' } | ConvertTo-Json -Compress

if ($Kind -eq 'test') {
  try {
    Invoke-RestMethod -Method Post -Uri "$url/api/events" -ContentType 'application/json' -Body $body -TimeoutSec 5 | Out-Null
    Write-Output 'ok'
  } catch {
    Write-Output "failed: $($_.Exception.Message)"
  }
  exit 0
}

$off = Join-Path $dir '.offline'
if ((Test-Path -LiteralPath $off) -and ((Get-Item -LiteralPath $off).LastWriteTime -gt (Get-Date).AddSeconds(-60))) { Noop }

# The body holds only base64url, tool and event names: no single quotes to escape. The path might.
$offQ = $off.Replace("'", "''")
$send = "try { Invoke-RestMethod -Method Post -Uri '$url/api/events' -ContentType 'application/json' -Body '$body' -TimeoutSec 3 | Out-Null; Remove-Item -LiteralPath '$offQ' -ErrorAction SilentlyContinue } catch { New-Item -ItemType File -Force -Path '$offQ' | Out-Null }"
$enc = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($send))
Start-Process -FilePath 'powershell' -ArgumentList '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', $enc -WindowStyle Hidden
Noop
