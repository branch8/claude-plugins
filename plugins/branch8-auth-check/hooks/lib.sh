# Shared helpers for the branch8-auth-check hooks and bin/branch8-auth.
# Sourced, not executed. Bash only (Git Bash on Windows), no jq or python.

BA_ROOT="${BA_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

# Services this plugin knows. Keep in step with docs/<service>.md.
BA_SERVICES="jira github devin gemini"

# config.env at the plugin root, each key overridable by an environment
# variable of the same name. Parsed as KEY=value, never sourced.
ba_cfg() {
  local file="$BA_ROOT/config.env"
  [ -f "$file" ] || return 0
  sed -n "s/^$1=//p" "$file" | tail -1 | tr -d '\r'
}
: "${BRANCH8_AUTH_ADMIN:=$(ba_cfg BRANCH8_AUTH_ADMIN)}"
: "${BRANCH8_GITHUB_ORG:=$(ba_cfg BRANCH8_GITHUB_ORG)}"
: "${BRANCH8_DEVIN_ORG_ID:=$(ba_cfg BRANCH8_DEVIN_ORG_ID)}"

# The settings.json Claude Code reads for this account (follows
# CLAUDE_CONFIG_DIR, which ccs and similar tools set per account).
ba_settings_file() {
  ba_native "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json"
}

# A string value of "<KEY>": "..." in that settings.json (the env block's keys
# are unique enough to grep; no jq on Git Bash). Empty when absent.
ba_settings_env() {
  local f="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json"
  [ -f "$f" ] || return 0
  sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" "$f" | head -1
}

# Under $HOME, not the Claude config dir, so every account (ccs keeps one
# config dir per account) shares the answers.
BA_STATE_DIR="$HOME/.claude/branch8-auth"
BA_NO_ACCOUNT_DIR="$BA_STATE_DIR/no-account"
BA_SESSION_DIR="$BA_STATE_DIR/sessions"

# Path shown to Claude: native on Git Bash for Windows, unchanged elsewhere.
ba_native() {
  if command -v cygpath >/dev/null 2>&1; then cygpath -w "$1"; else printf '%s' "$1"; fi
}

# First string value of "key" in a flat JSON blob.
ba_jget() {
  printf '%s' "$1" | tr -d '\n' | grep -o "\"$2\": *\"[^\"]*\"" | head -1 |
    sed 's/^[^:]*: *"//; s/"$//'
}

# JSON string escape.
ba_jesc() {
  sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/\t/\\t/g' -e 's/\r//g' |
    awk 'NR > 1 { printf "\\n" } { printf "%s", $0 }'
}

# Marker file that arms the first-prompt status check for one session.
ba_session_marker() {
  local id
  id=$(printf '%s' "$1" | tr -cd 'A-Za-z0-9_-' | cut -c1-80)
  [ -n "$id" ] && printf '%s/%s' "$BA_SESSION_DIR" "$id"
}

# Services the user said they have no account for, space separated.
ba_no_account_list() {
  local s out=""
  for s in $BA_SERVICES; do
    [ -f "$BA_NO_ACCOUNT_DIR/$s" ] && out="$out $s"
  done
  printf '%s' "${out# }"
}

# GitHub CLI state: "signed-in <account>", "signed-out", "unknown" (timed out)
# or "missing". `gh auth status` validates the token over the network, so it is
# bounded: a slow or offline machine must not stall session start.
ba_gh_state() {
  command -v gh >/dev/null 2>&1 || { echo missing; return; }
  local out rc
  if command -v timeout >/dev/null 2>&1; then
    out=$(timeout -k 1 5 gh auth status --hostname github.com 2>&1); rc=$?
  else
    out=$(gh auth status --hostname github.com 2>&1); rc=$?
  fi
  case "$rc" in
    0) echo "signed-in $(printf '%s' "$out" | sed -n 's/.*account \([^ ]*\).*/\1/p' | head -1)" ;;
    124|137) echo unknown ;;
    *) echo signed-out ;;
  esac
}

# Service names as typed after /auth-check, and their aliases.
ba_service_of() {
  case "$(printf '%s' "$1" | tr 'A-Z' 'a-z')" in
    jira|atlassian) echo jira ;;
    github|gh) echo github ;;
    devin|deepwiki) echo devin ;;
    gemini) echo gemini ;;
    *) return 1 ;;
  esac
}

# Host of each OAuth MCP service, to find its server whatever it is named
# (the official plugin, a claude.ai connector, a second copy).
ba_mcp_host() {
  case "$1" in
    jira) echo mcp.atlassian.com ;;
    devin) echo mcp.devin.ai ;;
    *) return 1 ;;
  esac
}

# The MCP server of <service> to sign in to, from `claude mcp list` output on
# stdin: one connected server is enough (exit 3, its name printed), else the
# official plugin's before a connector's, as managed settings install the
# plugin. Exit 4 when the service has no server at all.
ba_pick_server() {
  local host="$1" line name status out="" connected=""
  while IFS= read -r line; do
    case "$line" in *"://$host/"*) ;; *) continue ;; esac
    name="${line%%: http*}"
    status="${line##* - }"
    case "$status" in
      *"Needs authentication"*) out="$out$name"$'\n' ;;
      *Connected*) [ -n "$connected" ] || connected="$name" ;;
    esac
  done
  [ -n "$connected" ] && { echo "$connected"; return 3; }
  [ -n "$out" ] || return 4
  { printf '%s' "$out" | grep '^plugin:'; printf '%s' "$out" | grep -v '^plugin:'; } | head -1
}

# Opens a URL in the person's browser. `claude mcp login` cannot do it on WSL
# (2026-11-03: its opener, wslview and `cmd.exe start` all fail on the long
# Atlassian URL), so WSL goes through PowerShell. Elsewhere Claude Code's own
# opener is left to it.
ba_open_url() {
  [ -n "${WSL_DISTRO_NAME:-}" ] || return 0
  command -v powershell.exe >/dev/null 2>&1 &&
    powershell.exe -NoProfile -Command "Start-Process '$1'" >/dev/null 2>&1
}

# Runs a command under a pseudo-terminal: `claude mcp login` refuses to wait
# for the browser when stdin is not a terminal, and Claude's shell has none.
ba_in_pty() {
  if [ "$(uname)" = Darwin ]; then
    script -q /dev/null "$@"
  else
    script -qfec "$(printf '%q ' "$@")" /dev/null
  fi
}

# Devin DeepWiki token check, through the same MCP endpoint and headers the
# branch8-deepwiki plugin uses. Prints one word:
#   unset     DEVIN_API_KEY is empty (the server will ask for sign-in)
#   ok        the token lists the organisation's repos
#   rejected  HTTP 401/403, or the repo list errors - a wrong/expired token or
#             organisation id (a bad token still passes `initialize` and
#             `tools/list`, so only a real call tells; the same error would
#             show during a Devin outage, so the docs say to re-check once)
#   unknown   no curl, offline, timed out or an unexpected answer
# The token is fed to curl on stdin (-K -), never on its command line.
ba_devin_post() { # <dir> <max seconds> <json body> [session id]
  {
    printf 'header = "Authorization: Bearer %s"\n' "$DEVIN_API_KEY"
    printf 'header = "X-Org-Id: %s"\n' "${DEVIN_ORG_ID:-$BRANCH8_DEVIN_ORG_ID}"
    [ -n "$4" ] && printf 'header = "Mcp-Session-Id: %s"\n' "$4"
  } | curl -s -m "$2" -K - -X POST "${BA_DEVIN_URL:-https://mcp.devin.ai/mcp}" \
    -D "$1/h" -o "$1/b" -w '%{http_code}' \
    -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
    -d "$3" 2>/dev/null
}

ba_devin_check() {
  [ -n "$DEVIN_API_KEY" ] || { echo unset; return; }
  command -v curl >/dev/null 2>&1 || { echo unknown; return; }
  local tmp code sid body
  tmp=$(mktemp -d 2>/dev/null) || { echo unknown; return; }
  code=$(ba_devin_post "$tmp" 6 '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"branch8-auth-check","version":"1"}}}')
  case "$code" in
    200) ;;
    401|403) rm -rf "$tmp"; echo rejected; return ;;
    *) rm -rf "$tmp"; echo unknown; return ;;
  esac
  sid=$(sed -n 's/^[Mm][Cc][Pp]-[Ss][Ee][Ss][Ss][Ii][Oo][Nn]-[Ii][Dd]: *//p' "$tmp/h" | tr -d '\r' | head -1)
  code=$(ba_devin_post "$tmp" 12 '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_available_repos","arguments":{}}}' "$sid")
  body=$(cat "$tmp/b" 2>/dev/null)
  rm -rf "$tmp"
  case "$code" in
    401|403) echo rejected ;;
    200)
      case "$body" in
        *'"isError":true'*) echo rejected ;;
        *'"result"'*) echo ok ;;
        *) echo unknown ;;
      esac ;;
    *) echo unknown ;;
  esac
}
