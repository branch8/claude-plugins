#!/usr/bin/env bash
# SessionStart hook for the Branch8 Jira workflow.
#
# It emits hook JSON with two parts:
#   systemMessage      one line shown to the user at once: which Claude account
#                      this session runs on (read locally, no model involved)
#   additionalContext  instructions Claude follows on its first turn. MCP
#                      servers are still connecting when this runs, so Jira
#                      itself (connection, Jira account, board, tickets) can
#                      only be checked by Claude, not here.
#
# Account: `claude auth status` resolves the login the same way Claude Code
# does, and honours CLAUDE_CONFIG_DIR, so a tool running several accounts side
# by side (ccs keeps one config dir per account) gets the right one per
# session. Falls back to reading .claude.json from the config dir.
#
# Local records map a folder to a Jira project and live under $HOME (see
# hooks/lib.sh). A folder inherits the nearest record above it, so one repo,
# a workspace of repos, or a PM's document folder all work the same way.
#
# Opt out entirely with BRANCH8_JIRA_CHECK=off.

[ "$BRANCH8_JIRA_CHECK" = off ] && exit 0

. "$(dirname "$0")/lib.sh"

input=$(cat)
source_kind=startup
case "$input" in
  *'"source":"compact"'* | *'"source": "compact"'*) source_kind=compact ;;
esac

ctx="$(dirname "$0")/context"
helper="$(b8_native "$BRANCH8_PLUGIN_ROOT/bin/branch8-jira")"
jget() { b8_jget "$@"; }
jesc() { b8_jesc; }

# ---- Which Claude account is this session on? ------------------------------

status=""
if command -v claude >/dev/null 2>&1; then
  if command -v timeout >/dev/null 2>&1; then
    status=$(timeout 8 claude auth status 2>/dev/null)
  else
    status=$(claude auth status 2>/dev/null)
  fi
fi
email=$(jget "$status" email)
org_id=$(jget "$status" orgId)
org_name=$(jget "$status" orgName)
plan=$(jget "$status" subscriptionType)
auth_method=$(jget "$status" authMethod)
api_provider=$(jget "$status" apiProvider)

if [ -z "$status" ]; then
  cfg="${CLAUDE_CONFIG_DIR:-$HOME}/.claude.json"
  [ -f "$cfg" ] || cfg="$HOME/.claude.json"
  if [ -f "$cfg" ]; then
    raw=$(cat "$cfg")
    email=$(jget "$raw" emailAddress)
    org_id=$(jget "$raw" organizationUuid)
    org_name=$(jget "$raw" organizationName)
    [ -n "$email" ] && auth_method="claude.ai (from .claude.json)"
  fi
fi

# A custom endpoint means the model is not necessarily Anthropic's (ccs can
# route Claude Code to GLM, Kimi, OpenRouter, local models...).
base_url="${ANTHROPIC_BASE_URL:-}"
third_party=""
case "$base_url" in
  "" | https://api.anthropic.com*) ;;
  *) third_party="$base_url" ;;
esac

if [ -n "$third_party" ]; then
  account=other
elif [ -n "$BRANCH8_ORG_ID" ] && [ "$org_id" = "$BRANCH8_ORG_ID" ] && [ "${auth_method#claude.ai}" != "$auth_method" ]; then
  account=org
elif [ "${auth_method#claude.ai}" != "$auth_method" ] && [ -n "$email" ]; then
  account=personal
else
  account=other
fi

# ---- Where are we, and is it company work? --------------------------------

project_dir=$(b8_abs "${CLAUDE_PROJECT_DIR:-$PWD}")
layout_full=$(b8_layout "$project_dir")
layout=${layout_full%%$'\n'*}
layout_kind=${layout%% *}
# The folder a record for this session belongs to: the repo root inside a
# repo, otherwise the folder the session was opened in.
if [ "$layout_kind" = repo ]; then
  work_root=${layout#repo }
else
  work_root=$project_dir
fi

record_folder=""
record_file=""
mapping=""
if found=$(b8_lookup "$work_root"); then
  record_folder=${found%%$'\t'*}
  record_file=${found#*$'\t'}
  mapping=$(cat "$record_file")
fi
new_record_file=$(b8_record_path "$work_root")

company_remote() {
  [ -n "$BRANCH8_COMPANY_REMOTE_RE" ] && printf '%s\n' "$1" | grep -qiE "$BRANCH8_COMPANY_REMOTE_RE"
}

if [ "$account" = org ]; then
  project=company
  project_why="organisation account: everything on it is company work"
elif [ "$layout_kind" = repo ] && company_remote "$(git -C "$work_root" remote -v 2>/dev/null)"; then
  project=company
  project_why="git remote is under the company GitHub"
elif [ "$layout_kind" = workspace ] && company_remote "$layout_full"; then
  project=company
  project_why="company repos in this workspace"
elif printf '%s' "$mapping" | grep -q '"company": *true' ||
     printf '%s' "$mapping" | grep -q '"projectKey"'; then
  project=company
  project_why="recorded for $record_folder"
elif printf '%s' "$mapping" | grep -q '"company": *false'; then
  project=personal
else
  project=unknown
fi

# A personal project on a non-organisation account: nothing to do, say nothing.
[ "$project" = personal ] && exit 0

# ---- One line for the user, shown immediately -------------------------------

who="${email:-unknown account}"
case "$account" in
  org)
    banner="Claude 帳號：$who（${org_name:-Branch8}${plan:+ · $plan}）" ;;
  personal)
    if [ "$project" = company ]; then
      banner="⚠️ 目前用個人 Claude 帳號 $who 處理公司專案"
    else
      banner="Claude 帳號：$who（個人帳號）"
    fi ;;
  *)
    via="${third_party:-${api_provider:-?} / ${auth_method:-?}}"
    banner="⚠️ 此 session 沒有使用 Branch8 組織帳號（$via）" ;;
esac

# ---- Instructions for Claude ------------------------------------------------

build_context() {
  echo "# Branch8 Jira workflow (injected by the branch8-jira-check plugin)"
  echo
  cat "$ctx/asking.md"
  echo
  echo "## Session facts (read locally by the hook)"
  echo
  echo "- Claude account: ${email:-unknown}; org: ${org_name:-none} (${org_id:-no org id}); plan: ${plan:-unknown}; auth: ${auth_method:-unknown}; provider: ${api_provider:-unknown}${third_party:+; custom endpoint: $third_party}"
  echo "- Config dir: ${CLAUDE_CONFIG_DIR:-default (~/.claude)}"
  echo "- Account class: **$account** (org = the Branch8 organisation account)"
  echo "- Project: **$project**${project_why:+ ($project_why)}"
  echo "- Company Jira site: ${BRANCH8_JIRA_SITE:-not configured}; expected email domain: @${BRANCH8_EMAIL_DOMAIN:-not configured}"
  echo "- Session folder: \`$(b8_native "$project_dir")\`; layout: **$layout_kind**${layout#$layout_kind}"
  if [ "$layout_kind" = workspace ]; then
    echo "- Repos below it (path, origin):"
    printf '%s\n' "$layout_full" | sed -n '2,$p' | sed 's/^/  - /'
  fi
  if [ -n "$record_file" ]; then
    echo "- Nearest Jira record: folder \`$(b8_native "$record_folder")\`, file \`$(b8_native "$record_file")\`"
  else
    echo "- Nearest Jira record: none; a record for this folder goes to \`$(b8_native "$new_record_file")\`"
  fi
  echo "- Helper: \`bash \"$helper\" lookup <path>\` (nearest record for any path), \`record-path <dir>\`, \`layout <dir>\`, \`config\`"
  echo "- New per-project folders go under \`$(b8_native "${BRANCH8_WORKSPACE_ROOT:-$HOME/Branch8}")/<PROJECT KEY>\`"
  echo "- Jira config issues carry the label \`${BRANCH8_CONFIG_LABEL:-claude-config}\`"
  echo "- Hook source: $source_kind"
  echo
  cat "$ctx/accounts.md"
  echo
  if [ "$source_kind" != compact ]; then
    cat "$ctx/connection-check.md"
    echo
  fi
  cat "$ctx/folders.md"
  echo
  echo "## This folder's Jira project"
  echo
  if printf '%s' "$mapping" | grep -q '"projectKey"\|"jira": *"none"'; then
    echo "Recorded for \`$(b8_native "$record_folder")\` - use it for work under that folder, do not ask again:"
    echo
    echo '```json'
    printf '%s\n' "$mapping"
    echo '```'
  else
    cat "$ctx/ask-board.md"
  fi
  echo
  cat "$ctx/registry.md"
  echo
  [ "$layout_kind" != repo ] && { cat "$ctx/migrate.md"; echo; }
  cat "$ctx/task-tickets.md"
}

context=$(build_context)

if [ "$source_kind" = compact ]; then
  printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' \
    "$(printf '%s' "$context" | jesc)"
else
  printf '{"systemMessage":"%s","hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' \
    "$(printf '%s' "$banner" | jesc)" "$(printf '%s' "$context" | jesc)"
fi
