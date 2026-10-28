#!/usr/bin/env bash
# SessionStart: give Claude the sign-in rules for every service the Branch8
# setup uses, plus what this machine can tell about them right now.
#
# MCP servers (Jira, Devin) are still connecting when this runs, so their
# sign-in is checked by Claude on the first turn (armed here, consumed by
# first-prompt.sh). The gh CLI and env vars can be read here, and are passed
# on as facts so Claude need not run anything for them.
#
# Kept far below 10 KB: SessionStart context is merged with other plugins',
# and an oversized block is saved to a file Claude never reads.
# Output is additionalContext only: nothing is shown to the user.

[ "${BRANCH8_AUTH_CHECK:-on}" = off ] && exit 0

. "$(dirname "$0")/lib.sh"

input=$(cat)
source_kind=$(ba_jget "$input" source)
docs=$(ba_native "$BA_ROOT/docs")
helper=$(ba_native "$BA_ROOT/bin/branch8-auth")

# GitHub matters to people who work in git repos (mostly RD). Elsewhere (PMs'
# documents, research) it is neither checked nor shown - only offered if a task
# actually needs it - which also spares the network check at start-up.
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  gh_state=$(ba_gh_state)
  case "$gh_state" in
    signed-in*) gh_fact="signed in${gh_state#signed-in}" ;;
    signed-out) gh_fact="installed, NOT signed in" ;;
    unknown) gh_fact="installed, sign-in unknown (check timed out)" ;;
    *) gh_fact="NOT installed" ;;
  esac
  gh_fact="$gh_fact (git repo here: show github in the status line)"
else
  gh_fact="not checked - not a git folder; leave github out of the status line and offer it only if a task needs GitHub"
fi
[ -n "$GITHUB_PERSONAL_ACCESS_TOKEN" ] && pat=set || pat="not set"
[ -n "$GEMINI_API_KEY" ] && gemini=set || gemini="not set"
no_account=$(ba_no_account_list)

context="# Branch8 sign-in (branch8-auth-check)

One place for every sign-in. Services: **jira** (atlassian MCP), **github** (\`gh\` CLI; the github MCP is optional and needs a PAT), **devin** (Devin DeepWiki, \`devin\` MCP), **gemini** (\`GEMINI_API_KEY\`, only for ui-ux-pro-max image generation).

Facts (checked at session start): gh: $gh_fact · github MCP PAT: $pat · GEMINI_API_KEY: $gemini · no account (do not ask): ${no_account:-none}
Helper: \`bash \"$helper\" no-account <service>|clear [service]|status|config\`

**First turn**: show ONE status line, no card (the first message carries the format; full rules in \`$docs/status.md\`). A server whose only tool is \`authenticate\` = not signed in. Exception: Jira is asked about right away when branch8-jira-check's context says this folder is company work with Jira.

**When a task needs a service that is not signed in** (or a call fails with 401 / auth error): ask with a question card, each time it is needed until the user picks \"stop asking this session\" - options and handling in \`$docs/card.md\`, sign-in steps in \`$docs/<service>.md\`. Skip services listed under no account. Never ask for, accept or echo a token or key in the chat. Never block the user's request on any of this."

# Arm the first-prompt check, except when compaction resumes a session that
# already had its first turn.
if [ "$source_kind" != compact ] && marker=$(ba_session_marker "$(ba_jget "$input" session_id)"); then
  mkdir -p "$BA_SESSION_DIR" 2>/dev/null && : > "$marker" 2>/dev/null
  find "$BA_SESSION_DIR" -type f -mtime +2 -delete 2>/dev/null
fi

printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' \
  "$(printf '%s' "$context" | ba_jesc)"
