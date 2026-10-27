# Shared helpers for the branch8-deepwiki hooks and bin/branch8-deepwiki.
# Sourced, not executed. Bash only (Git Bash on Windows), no jq or python.

DW_ROOT="${DW_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

# config.env at the plugin root, each key overridable by an environment
# variable of the same name. Parsed as KEY=value, never sourced.
dw_cfg() {
  local file="$DW_ROOT/config.env"
  [ -f "$file" ] || return 0
  sed -n "s/^$1=//p" "$file" | tail -1 | tr -d '\r'
}
: "${BRANCH8_DEEPWIKI_ORG:=$(dw_cfg BRANCH8_DEEPWIKI_ORG)}"
: "${BRANCH8_DEEPWIKI_ORG:=branch8}"
: "${BRANCH8_DEEPWIKI_ADMIN:=$(dw_cfg BRANCH8_DEEPWIKI_ADMIN)}"

# Under $HOME, not the Claude config dir, so every account (ccs keeps one
# config dir per account) shares the "no Devin account" answer.
DW_STATE_DIR="$HOME/.claude/branch8-deepwiki"
DW_NO_ACCOUNT="$DW_STATE_DIR/no-account"
DW_SESSION_DIR="$DW_STATE_DIR/sessions"

# First string value of "key" in a flat JSON blob.
dw_jget() {
  printf '%s' "$1" | tr -d '\n' | grep -o "\"$2\": *\"[^\"]*\"" | head -1 |
    sed 's/^[^:]*: *"//; s/"$//'
}

# JSON string escape.
dw_jesc() {
  sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/\t/\\t/g' -e 's/\r//g' |
    awk 'NR > 1 { printf "\\n" } { printf "%s", $0 }'
}

# Marker file that arms the first-prompt login check for one session.
dw_session_marker() {
  local id
  id=$(printf '%s' "$1" | tr -cd 'A-Za-z0-9_-' | cut -c1-80)
  [ -n "$id" ] && printf '%s/%s' "$DW_SESSION_DIR" "$id"
}
