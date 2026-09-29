# Shared helpers for the branch8-jira-check hooks and bin/branch8-jira.
# Sourced, not executed. Bash only (Git Bash on Windows), no jq or python.

BRANCH8_PLUGIN_ROOT="${BRANCH8_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

# Settings: config.env at the plugin root, each overridable by an environment
# variable of the same name (e.g. from managed settings "env"). Parsed as
# KEY=value, never sourced.
b8_cfg() {
  local file="$BRANCH8_PLUGIN_ROOT/config.env"
  [ -f "$file" ] || return 0
  sed -n "s/^$1=//p" "$file" | tail -1 | tr -d '\r'
}
: "${BRANCH8_ORG_ID:=$(b8_cfg BRANCH8_ORG_ID)}"
: "${BRANCH8_JIRA_SITE:=$(b8_cfg BRANCH8_JIRA_SITE)}"
: "${BRANCH8_EMAIL_DOMAIN:=$(b8_cfg BRANCH8_EMAIL_DOMAIN)}"
: "${BRANCH8_COMPANY_REMOTE_RE:=$(b8_cfg BRANCH8_COMPANY_REMOTE_RE)}"
: "${BRANCH8_CONFIG_LABEL:=$(b8_cfg BRANCH8_CONFIG_LABEL)}"
: "${BRANCH8_WORKSPACE_ROOT:=$(b8_cfg BRANCH8_WORKSPACE_ROOT)}"
# "~/..." in config.env means the user's home directory.
case "$BRANCH8_WORKSPACE_ROOT" in "~"*) BRANCH8_WORKSPACE_ROOT="$HOME${BRANCH8_WORKSPACE_ROOT#\~}" ;; esac

# Local records live under $HOME, not the Claude config dir, so every account
# (ccs keeps one config dir per account) shares them.
BRANCH8_STATE_DIR="$HOME/.claude/branch8-jira/projects"

# First string value of "key" in a JSON blob. Good enough for the flat,
# machine-written JSON this reads; not a general parser.
b8_jget() {
  printf '%s' "$1" | tr -d '\n' | grep -o "\"$2\": *\"[^\"]*\"" | head -1 |
    sed 's/^[^:]*: *"//; s/"$//'
}

# JSON string escape (no jq on most machines).
b8_jesc() {
  sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/\t/\\t/g' -e 's/\r//g' |
    awk 'NR > 1 { printf "\\n" } { printf "%s", $0 }'
}

# Path shown to Claude: native on Git Bash for Windows, unchanged elsewhere.
b8_native() {
  if command -v cygpath >/dev/null 2>&1; then cygpath -w "$1"; else printf '%s' "$1"; fi
}

# Absolute, symlink-free path of a directory (itself if it does not exist).
b8_abs() {
  (cd "$1" 2>/dev/null && pwd -P) || printf '%s' "$1"
}

# Record file for exactly this folder.
b8_record_path() {
  local key
  key=$(printf '%s' "$1" | sed 's#[/\\: ]#_#g; s#^_*##')
  printf '%s/%s.json' "$BRANCH8_STATE_DIR" "${key:-root}"
}

# Nearest record for a path: the folder itself, then each parent in turn.
# Prints "<folder>\t<record file>" and returns 0, or returns 1 if none.
b8_lookup() {
  local dir
  dir=$(b8_abs "$1")
  while :; do
    local rec
    rec=$(b8_record_path "$dir")
    if [ -f "$rec" ]; then
      printf '%s\t%s\n' "$dir" "$rec"
      return 0
    fi
    local parent
    parent=$(dirname "$dir")
    [ "$parent" = "$dir" ] && return 1
    dir="$parent"
  done
}

# Is this a catch-all place (home, desktop, downloads...) rather than a project?
b8_is_catchall() {
  local d
  d=$(b8_abs "$1")
  case "$d" in
    / | "$(b8_abs "$HOME")" | */Desktop | */Documents | */Downloads | */桌面 | */文件 | */下載) return 0 ;;
  esac
  return 1
}

# Folder layout, first line is the kind:
#   repo <toplevel>          inside a git repository
#   catchall                 home, desktop, downloads...
#   workspace                not a repo, git repos below it (listed after,
#                            one "<path>\t<origin url>" per line)
#   folder <entry count>     plain folder, no git anywhere near it
b8_layout() {
  local d top
  d=$(b8_abs "$1")
  if top=$(git -C "$d" rev-parse --show-toplevel 2>/dev/null) && [ -n "$top" ]; then
    printf 'repo %s\n' "$top"
    return
  fi
  if b8_is_catchall "$d"; then
    echo catchall
    return
  fi
  local repos t=""
  # Bounded: a big folder must not stall session start.
  command -v timeout >/dev/null 2>&1 && t="timeout 3"
  repos=$($t find "$d" -maxdepth 3 \( -name node_modules -o -name .venv -o -name vendor \) -prune -o \
    -name .git -print 2>/dev/null | head -30)
  if [ -n "$repos" ]; then
    echo workspace
    printf '%s\n' "$repos" | while read -r g; do
      local r
      r=$(dirname "$g")
      printf '%s\t%s\n' "$r" "$(git -C "$r" remote get-url origin 2>/dev/null)"
    done
    return
  fi
  printf 'folder %s\n' "$(ls -A "$d" 2>/dev/null | wc -l | tr -d ' ')"
}
