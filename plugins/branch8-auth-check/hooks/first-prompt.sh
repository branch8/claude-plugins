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

reminder="Branch8 sign-in - first message of the session. Before working on it, show this one line, then do the user's request (no narration, no card):

> **登入狀態**　✅ Jira　✅ GitHub（<gh account>）　⚪ Devin DeepWiki

- ✅ signed in, ⚪ not. Any ⚪ -> append 「（需要時我會引導登入，或輸入 /auth-check）」. Translate to the user's language.
- Jira / Devin: the tool names you already see are enough, no need to load them - a server with only \`authenticate\` = not signed in; Jira counts as signed in if any Atlassian server (plugin or claude.ai connector) has working tools. GitHub: the gh fact in \"Branch8 sign-in\".
- Leave out: github when the fact says not a git folder; services under \"no account\"; a service whose server is absent; Jira when branch8-jira-check shows its own Jira account block.
- Only if Jira is NOT signed in, branch8-jira-check is in this session and this folder is company work (mapped to a Jira project or not yet mapped - anything but \"no Jira for this folder\" / personal): ask the Jira card now (\`$(ba_native "$BA_ROOT/docs")/status.md\`, last section)."

printf '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"%s"}}\n' \
  "$(printf '%s' "$reminder" | ba_jesc)"
