#!/usr/bin/env bash
# Checks the SessionStart hook: valid JSON, small context, repo detection, off switch.
set -u
hook="$(cd "$(dirname "$0")/.." && pwd)/hooks/session-start.sh"
fail=0
check() { if eval "$2"; then echo "ok   $1"; else echo "FAIL $1"; fail=1; fi; }

ctx() { python3 -c 'import json,sys; print(json.load(sys.stdin)["hookSpecificOutput"]["additionalContext"])'; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

mkrepo() { git init -q "$tmp/$1" && git -C "$tmp/$1" remote add origin "$2"; }
mkrepo org-https https://github.com/Branch8/Some-Service.git
mkrepo org-ssh git@github.com:branch8/api.git
mkrepo other https://github.com/encode/httpx.git
mkdir "$tmp/plain"

out=$(cd "$tmp/org-https" && bash "$hook")
check "org https remote is detected" '[[ $(printf "%s" "$out" | ctx) == *"repo \`Branch8/Some-Service\`"* ]]'
size=$(printf '%s' "$out" | ctx | wc -c)
check "context stays under 2 KB ($size bytes)" '[ "$size" -lt 2048 ]'

out=$(cd "$tmp/org-ssh" && bash "$hook")
check "org ssh remote is detected" '[[ $(printf "%s" "$out" | ctx) == *"repo \`branch8/api\`"* ]]'

out=$(cd "$tmp/other" && bash "$hook")
check "non-org remote is not claimed" '[[ $(printf "%s" "$out" | ctx) == *"not a branch8 repo"* ]]'

out=$(cd "$tmp/plain" && bash "$hook")
check "folder without git still gets the rule" '[[ $(printf "%s" "$out" | ctx) == *"Consult it on your own initiative"* ]]'

out=$(cd "$tmp/plain" && BRANCH8_DEEPWIKI=off bash "$hook")
check "BRANCH8_DEEPWIKI=off prints nothing" '[ -z "$out" ]'

exit $fail
