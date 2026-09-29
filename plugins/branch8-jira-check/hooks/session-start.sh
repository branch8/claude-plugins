#!/usr/bin/env bash
# SessionStart hook: print instructions that Claude Code adds to the session
# context. The hook itself checks nothing remotely - MCP servers are still
# connecting when it runs - so Claude does the actual Jira work on its first turn.
#
# Per-project Jira mapping lives outside the project, one file per project dir:
#   ~/.claude/branch8-jira/projects/<project dir with separators replaced>.json
# so nothing is ever written into (or committed to) the user's repo.
#
# Opt out entirely with BRANCH8_JIRA_CHECK=off.

[ "$BRANCH8_JIRA_CHECK" = off ] && exit 0

input=$(cat)
source_kind=startup
case "$input" in
  *'"source":"compact"'* | *'"source": "compact"'*) source_kind=compact ;;
esac

ctx="$(dirname "$0")/context"

project_dir="${CLAUDE_PROJECT_DIR:-$PWD}"
key=$(printf '%s' "$project_dir" | sed 's#[/\\: ]#_#g; s#^_*##')
map_file="$HOME/.claude/branch8-jira/projects/${key:-root}.json"
# Git Bash on Windows: hand Claude a native path its file tools can open.
command -v cygpath >/dev/null 2>&1 && map_file=$(cygpath -w "$map_file")

echo "# Branch8 Jira workflow (injected by the branch8-jira-check plugin)"
echo

# Printed on every source, compact included: the board and ticket steps rely on it.
cat "$ctx/asking.md"
echo

# After compaction the connection was already checked; only restate the rules.
if [ "$source_kind" != compact ]; then
  cat "$ctx/connection-check.md"
  echo
fi

echo "## This project's Jira board"
echo
echo "Project directory: \`$project_dir\`"
echo "Local mapping file: \`$map_file\`"
echo
if [ -f "$map_file" ]; then
  echo "Mapping already recorded - use it, do not ask again:"
  echo
  echo '```json'
  cat "$map_file"
  echo
  echo '```'
else
  cat "$ctx/ask-board.md"
fi
echo
cat "$ctx/task-tickets.md"
