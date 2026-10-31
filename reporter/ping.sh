#!/bin/sh
# Office Presence ping (macOS / Linux). Reporter version 3.
#
# Usage: ping.sh <tool> <event>
#   tool:  claude | cursor | codex | hermes
#   event: prompt | tool | stop | test
#
# Privacy contract: the request body is exactly {credential, tool, event, v}.
# This script never reads the hook payload on stdin, so prompts and code never leave the machine.
#
# Hook mode (event != test): returns at once with a no-op JSON object; the AI tool never waits on the
# network. The request runs detached in its own session (perl/setsid), so it survives the hook runner
# killing the hook's process group. After a failed send, sends are skipped for 60 s (.offline marker),
# so being off the office network costs nothing.
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

BODY=$(printf '{"credential":"%s","tool":"%s","event":"%s","v":"3"}' "$CRED" "$TOOL" "$EVENT")

if [ "$EVENT" = test ]; then
  CODE=$(curl -s -m 5 -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' --data "$BODY" "$URL/api/events" 2>/dev/null)
  if [ "$CODE" = 200 ]; then echo ok; else echo "failed: HTTP ${CODE:-no response} from $URL"; fi
  exit 0
fi

OFF="$DIR/.offline"
if [ -f "$OFF" ] && [ -n "$(find "$OFF" -mmin -1 2>/dev/null)" ]; then noop; fi

SEND='curl -s --connect-timeout 2 -m 3 -o /dev/null -X POST -H "Content-Type: application/json" --data "$1" "$2/api/events" && rm -f "$3" || touch "$3"'
# Perl detach: fork, and return only once the child has its own session, so killing the hook's
# process group right after the hook exits cannot take the send down with it.
DETACH='use POSIX (); pipe(my $r, my $w) or exit 1; my $pid = fork; exit 1 unless defined $pid;
if ($pid) { close $w; my $x = <$r>; exit 0 } close $r; POSIX::setsid(); close $w; exec @ARGV or exit 1'
if command -v perl >/dev/null 2>&1; then
  perl -e "$DETACH" sh -c "$SEND" sh "$BODY" "$URL" "$OFF" </dev/null >/dev/null 2>&1
elif command -v setsid >/dev/null 2>&1; then
  setsid -f sh -c "$SEND" sh "$BODY" "$URL" "$OFF" </dev/null >/dev/null 2>&1
else
  sh -c "$SEND" sh "$BODY" "$URL" "$OFF" </dev/null >/dev/null 2>&1 &
fi
noop
