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
