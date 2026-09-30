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
# Account: read from .claude.json in the config dir (CLAUDE_CONFIG_DIR, so a
# tool running several accounts side by side - ccs keeps one config dir per
# account - gets the right one per session). That is instant; `claude auth
# status` takes 10-30 s on some machines, longer than this hook's timeout.
# Only when an API key or cloud provider is configured, which .claude.json
# does not reflect, is `claude auth status` asked instead.
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

email="" org_id="" org_name="" plan="" auth_method="" api_provider=""

# Credentials that override the claude.ai login; .claude.json may still hold
# the old OAuth account while one of these is in use.
non_oauth=""
for v in ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN CLAUDE_CODE_OAUTH_TOKEN \
         CLAUDE_CODE_USE_BEDROCK CLAUDE_CODE_USE_VERTEX CLAUDE_CODE_USE_FOUNDRY; do
  [ -n "${!v:-}" ] && non_oauth=$v
done

if [ -z "$non_oauth" ]; then
  cfg="${CLAUDE_CONFIG_DIR:-$HOME}/.claude.json"
  [ -f "$cfg" ] || cfg="$HOME/.claude.json"
  if [ -f "$cfg" ]; then
    raw=$(cat "$cfg")
    email=$(jget "$raw" emailAddress)
    org_id=$(jget "$raw" organizationUuid)
    org_name=$(jget "$raw" organizationName)
    plan=$(jget "$raw" organizationType)
    plan=${plan#claude_}
    if [ -n "$email" ]; then
      auth_method=claude.ai
      api_provider=firstParty
    fi
  fi
fi

if [ -z "$email" ] && command -v claude >/dev/null 2>&1; then
  # claude does not exit promptly on SIGTERM; -k makes the limit real.
  if command -v timeout >/dev/null 2>&1; then
    status=$(timeout -k 1 5 claude auth status 2>/dev/null)
  else
    status=$(claude auth status 2>/dev/null)
  fi
  email=$(jget "$status" email)
  org_id=$(jget "$status" orgId)
  org_name=$(jget "$status" orgName)
  plan=$(jget "$status" subscriptionType)
  auth_method=$(jget "$status" authMethod)
  api_provider=$(jget "$status" apiProvider)
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
    if [ -n "$third_party" ]; then
      via=$third_party
    elif [ -n "$auth_method$api_provider" ]; then
      via="${api_provider:-?} / ${auth_method:-?}"
    else
      via=${non_oauth:-unknown login}
    fi
    banner="⚠️ 此 session 沒有使用 Branch8 組織帳號（$via）" ;;
esac

# ---- Instructions for Claude ------------------------------------------------

# Kept short on purpose: Claude Code moves SessionStart context over ~10 KB
# into a file and shows Claude only a 2 KB preview. Only the sections that
# apply to this session are included; the rare procedures live in docs/ and
# are read on demand. tests/context-size.sh guards the limit.
docs="$(b8_native "$BRANCH8_PLUGIN_ROOT/docs")"
workspace="$(b8_native "${BRANCH8_WORKSPACE_ROOT:-$HOME/Branch8}")"
section() {
  sed -e "s#{{DOCS}}#$docs#g" -e "s#{{WORKSPACE}}#$workspace#g" \
      -e "s#{{LAYOUT}}#$layout_kind#g" "$ctx/$1.md"
  echo
}

build_context() {
  echo "# Branch8 Jira workflow (branch8-jira-check plugin)"
  echo
  section core
  echo "## Facts"
  echo
  echo "- Claude: ${email:-unknown} · org ${org_name:-none} · plan ${plan:-?} · auth ${auth_method:-?}${non_oauth:+ ($non_oauth)}${third_party:+ · endpoint $third_party} → class **$account**"
  echo "- Work: **$project**${project_why:+ ($project_why)}; company Jira ${BRANCH8_JIRA_SITE:-?}, email @${BRANCH8_EMAIL_DOMAIN:-?}"
  echo "- Folder: \`$(b8_native "$project_dir")\` · layout **$layout_kind**${layout#$layout_kind}"
  if [ "$layout_kind" = workspace ]; then
    printf '%s\n' "$layout_full" | sed -n '2,$p' | head -10 | sed 's/^/  - repo: /'
  fi
  echo "- Helper: \`bash \"$helper\" lookup|record-path|layout|config <path>\` - always use it for record paths"
  echo
  [ "$source_kind" != compact ] && section connect
  case "$account/$project" in
    org/*) section account-org ;;
    */company) section account-nonorg-company ;;
    *) section account-nonorg-unknown ;;
  esac
  echo "## This folder's Jira project"
  echo
  if printf '%s' "$mapping" | grep -q '"projectKey"\|"jira": *"none"'; then
    echo "Recorded for \`$(b8_native "$record_folder")\` (use it, do not ask): $(printf '%s' "$mapping" | tr -d '\n' | tr -s ' ')"
    echo
  else
    section board-missing
  fi
  # A plain folder that already has a record is fine as it is.
  if [ "$layout_kind" = catchall ] || { [ "$layout_kind" = folder ] && [ -z "$mapping" ]; }; then
    section folder-suggest
  fi
  section tickets
}

context=$(build_context)

if [ "$source_kind" = compact ]; then
  printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' \
    "$(printf '%s' "$context" | jesc)"
else
  printf '{"systemMessage":"%s","hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' \
    "$(printf '%s' "$banner" | jesc)" "$(printf '%s' "$context" | jesc)"
fi
