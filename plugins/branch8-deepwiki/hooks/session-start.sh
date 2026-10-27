#!/usr/bin/env bash
# Inject a short standing rule: use the organisation's DeepWiki (Devin MCP) as
# project knowledge. Kept far below 10 KB - SessionStart context is merged with
# other plugins', and an oversized block is saved to a file Claude never reads.
# Output is additionalContext only: nothing is shown to the user.

[ "${BRANCH8_DEEPWIKI:-on}" = off ] && exit 0

org="${BRANCH8_DEEPWIKI_ORG:-branch8}"

# owner/repo of this folder's origin, when it is one of the org's GitHub repos.
repo=""
url=$(git remote get-url origin 2>/dev/null) || url=""
case "$url" in
  *github.com[:/]*)
    slug=${url#*github.com[:/]}
    slug=${slug%.git}
    slug=${slug%/}
    owner=${slug%%/*}
    if [ "$(printf '%s' "$owner" | tr '[:upper:]' '[:lower:]')" = "$(printf '%s' "$org" | tr '[:upper:]' '[:lower:]')" ]; then
      repo="$slug"
    fi
    ;;
esac

if [ -n "$repo" ]; then
  here="This folder is the repo \`$repo\`: its own wiki on \`devin\` is project knowledge for this work."
else
  here="This folder is not a $org repo, but work here may still depend on $org repos."
fi

context="# Branch8 DeepWiki (project knowledge)

$org's GitHub repos are indexed in Devin's DeepWiki. Treat it as a project knowledge source next to the code: MCP server \`devin\` (ToolSearch \"devin\"); public open-source repos use server \`deepwiki\`.
$here

Consult it on your own initiative, without being asked, when:
- before changing an unfamiliar area you need the big picture: architecture, module boundaries, data flow, why something is built this way;
- the work touches another $org repo or service (API contract, shared library, integration) whose source is not here;
- the user asks how a company system or project works.

Ask one specific question (\`ask_question\` / \`ask_wiki_question\`, repoName \`owner/repo\`, up to 10 repos), then verify in the actual code anything you will rely on - the wiki is a snapshot. Never call devin_session_* or other Devin management tools unless the user asks. If \`devin\` is not authenticated, tell the user once: \`/mcp\` -> devin -> Authenticate. Details: skill \`branch8-deepwiki:deepwiki\`."

jesc() {
  sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/\t/\\t/g' -e 's/\r//g' |
    awk 'NR > 1 { printf "\\n" } { printf "%s", $0 }'
}

printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' \
  "$(printf '%s' "$context" | jesc)"
