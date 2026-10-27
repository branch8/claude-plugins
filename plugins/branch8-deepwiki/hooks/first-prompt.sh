#!/usr/bin/env bash
# UserPromptSubmit hook: on the first message of a session only, ask Claude to
# check the `devin` sign-in. Rules given only at SessionStart sit at the end of
# a long merged context and get skipped when the first message is a task
# (branch8-jira-check found this), so the check rides on the first message.
# SessionStart arms a marker; this consumes it, so later messages pass through.

[ "${BRANCH8_DEEPWIKI:-on}" = off ] && exit 0

. "$(dirname "$0")/lib.sh"

input=$(cat)
marker=$(dw_session_marker "$(dw_jget "$input" session_id)") || exit 0
[ -f "$marker" ] || exit 0
rm -f "$marker"

reminder="Branch8 DeepWiki - first message of the session. Before or alongside the request, check once whether the \`devin\` MCP server is signed in and show the one status line from \`$DW_ROOT/docs/login.md\` (section 2; helper: \`$DW_ROOT/bin/branch8-deepwiki\`). Do not ask to sign in now - only when a task needs the organisation wiki (section 3). Never block the user's request on it."

printf '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"%s"}}\n' \
  "$(printf '%s' "$reminder" | dw_jesc)"
