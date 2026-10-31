#!/bin/sh
# Office Presence ping (macOS / Linux). Reporter version 1.
#
# Usage: ping.sh <tool> <event>
#   tool:  claude | cursor | codex | hermes
#   event: prompt | tool | stop | test
#
# Privacy contract: the request body is exactly {credential, tool, event, v}.
# This script never reads the hook payload on stdin, so prompts and code never leave the machine.
#
# Hook mode (event != test): sends in the background, prints a no-op JSON object, exits 0.
# Test mode (event == test): sends in the foreground and prints "ok" or "failed: <reason>".

DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
TOOL=$1
EVENT=$2

noop() {
  if [ "$TOOL" = cursor ]; then printf '{"continue":true}\n'; else printf '{}\n'; fi
  exit 0
}

case "$TOOL" in claude|cursor|codex|hermes) ;; *) noop ;; esac
case "$EVENT" in prompt|tool|stop|test) ;; *) noop ;; esac

CRED=$(tr -d ' \r\n' < "$DIR/credential" 2>/dev/null)
URL=$(tr -d ' \r\n' < "$DIR/server_url" 2>/dev/null)
if [ -z "$CRED" ] || [ -z "$URL" ]; then
  if [ "$EVENT" = test ]; then echo "failed: credential or server_url file missing in $DIR"; exit 0; fi
  noop
fi

BODY=$(printf '{"credential":"%s","tool":"%s","event":"%s","v":"1"}' "$CRED" "$TOOL" "$EVENT")

if [ "$EVENT" = test ]; then
  CODE=$(curl -s -m 5 -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' --data "$BODY" "$URL/api/events" 2>/dev/null)
  if [ "$CODE" = 200 ]; then echo ok; else echo "failed: HTTP ${CODE:-no response} from $URL"; fi
  exit 0
fi

(curl -s -m 3 -o /dev/null -X POST -H 'Content-Type: application/json' --data "$BODY" "$URL/api/events" </dev/null >/dev/null 2>&1 &) >/dev/null 2>&1
noop
