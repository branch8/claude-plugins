#!/usr/bin/env bash
# UserPromptSubmit hook: on the first message of a session only, put the
# Jira steps right next to that message. SessionStart arms a marker for the
# session; this consumes it, so every later message passes through untouched
# and nothing is added where SessionStart decided not to inject (personal
# projects, BRANCH8_JIRA_CHECK=off).

[ "$BRANCH8_JIRA_CHECK" = off ] && exit 0

. "$(dirname "$0")/lib.sh"

input=$(cat)
marker=$(b8_session_marker "$(b8_jget "$input" session_id)") || exit 0
[ -f "$marker" ] || exit 0
rm -f "$marker"

reminder=$(cat "$(dirname "$0")/context/first-prompt.md")
printf '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"%s"}}\n' \
  "$(printf '%s' "$reminder" | b8_jesc)"
