#!/usr/bin/env bash
# UserPromptSubmit hook: on the first message of a session only, ask Claude to
# check sign-ins and show the status line. Rules given only at SessionStart sit
# at the end of a long merged context and get skipped when the first message is
# a task (branch8-jira-check found this), so the check rides on the first
# message. SessionStart arms a marker; this consumes it.

[ "${BRANCH8_AUTH_CHECK:-on}" = off ] && exit 0

. "$(dirname "$0")/lib.sh"

input=$(cat)
marker=$(ba_session_marker "$(ba_jget "$input" session_id)") || exit 0
[ -f "$marker" ] || exit 0
rm -f "$marker"

reminder="Branch8 sign-in - first message of the session. Before working on it, check jira and devin once and show the one status line (see \"Branch8 sign-in\" in the session context; format in \`$(ba_native "$BA_ROOT/docs")/status.md\`). No card, except the Jira exception described there. Quietly: no narration of the check. Then do the user's request."

printf '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"%s"}}\n' \
  "$(printf '%s' "$reminder" | ba_jesc)"
