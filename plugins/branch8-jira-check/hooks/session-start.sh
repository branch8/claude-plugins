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
# Per-project state lives outside the project, one file per project dir, and
# under $HOME rather than the config dir so every account shares it:
#   ~/.claude/branch8-jira/projects/<project dir with separators replaced>.json
#
# Opt out entirely with BRANCH8_JIRA_CHECK=off.

[ "$BRANCH8_JIRA_CHECK" = off ] && exit 0

# Settings: config.env next to the plugin root, each overridable by an
# environment variable of the same name (e.g. from managed settings "env").
# Parsed as KEY=value, never sourced.
config_file="$(dirname "$0")/../config.env"
cfg_get() {
  [ -f "$config_file" ] || return 0
  sed -n "s/^$1=//p" "$config_file" | tail -1 | tr -d '\r'
}
: "${BRANCH8_ORG_ID:=$(cfg_get BRANCH8_ORG_ID)}"
: "${BRANCH8_JIRA_SITE:=$(cfg_get BRANCH8_JIRA_SITE)}"
: "${BRANCH8_EMAIL_DOMAIN:=$(cfg_get BRANCH8_EMAIL_DOMAIN)}"
: "${BRANCH8_COMPANY_REMOTE_RE:=$(cfg_get BRANCH8_COMPANY_REMOTE_RE)}"

input=$(cat)
source_kind=startup
case "$input" in
  *'"source":"compact"'* | *'"source": "compact"'*) source_kind=compact ;;
esac

ctx="$(dirname "$0")/context"

# First string value of "key" in a JSON blob. Good enough for the flat,
# machine-written JSON this reads; not a general parser.
jget() {
  printf '%s' "$1" | tr -d '\n' | grep -o "\"$2\": *\"[^\"]*\"" | head -1 |
    sed 's/^[^:]*: *"//; s/"$//'
}

# JSON string escape for the hook output (no jq on most machines).
jesc() {
  sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/\t/\\t/g' -e 's/\r//g' |
    awk 'NR > 1 { printf "\\n" } { printf "%s", $0 }'
}

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

# ---- Is this project company work? -----------------------------------------

project_dir="${CLAUDE_PROJECT_DIR:-$PWD}"
key=$(printf '%s' "$project_dir" | sed 's#[/\\: ]#_#g; s#^_*##')
map_posix="$HOME/.claude/branch8-jira/projects/${key:-root}.json"
map_file="$map_posix"
# Git Bash on Windows: hand Claude a native path its file tools can open.
command -v cygpath >/dev/null 2>&1 && map_file=$(cygpath -w "$map_posix")

mapping=""
[ -f "$map_posix" ] && mapping=$(cat "$map_posix")

if [ "$account" = org ]; then
  project=company
  project_why="organisation account: everything on it is company work"
elif [ -n "$BRANCH8_COMPANY_REMOTE_RE" ] &&
     git -C "$project_dir" remote -v 2>/dev/null | grep -qiE "$BRANCH8_COMPANY_REMOTE_RE"; then
  project=company
  project_why="git remote is under github.com/branch8"
elif printf '%s' "$mapping" | grep -q '"company": *true' ||
     printf '%s' "$mapping" | grep -q '"projectKey"'; then
  project=company
  project_why="recorded in the local mapping file"
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
  echo "- Project directory: \`$project_dir\`"
  echo "- Local mapping file: \`$map_file\`"
  echo "- Hook source: $source_kind"
  echo
  cat "$ctx/accounts.md"
  echo
  if [ "$source_kind" != compact ]; then
    cat "$ctx/connection-check.md"
    echo
  fi
  echo "## This project's Jira board"
  echo
  if printf '%s' "$mapping" | grep -q '"projectKey"\|"jira": *"none"'; then
    echo "Mapping already recorded - use it, do not ask again:"
    echo
    echo '```json'
    printf '%s\n' "$mapping"
    echo '```'
  else
    cat "$ctx/ask-board.md"
  fi
  echo
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
