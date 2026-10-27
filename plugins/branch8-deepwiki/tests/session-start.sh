#!/usr/bin/env bash
# Checks the hooks: valid JSON, small context, repo detection, first-prompt
# arming and consuming, the "no Devin account" answer, and the off switch.
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"
hook="$root/hooks/session-start.sh"
first="$root/hooks/first-prompt.sh"
helper="$root/bin/branch8-deepwiki"
fail=0
check() { if eval "$2"; then echo "ok   $1"; else echo "FAIL $1"; fail=1; fi; }

ctx() { python3 -c 'import json,sys; print(json.load(sys.stdin)["hookSpecificOutput"]["additionalContext"])'; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
export HOME="$tmp/home"   # keep markers and answers out of the real home
mkdir -p "$HOME"

start() { printf '{"session_id":"%s","source":"%s"}' "$1" "${2:-startup}" | bash "$hook"; }
prompt() { printf '{"session_id":"%s","prompt":"hi"}' "$1" | bash "$first"; }

mkrepo() { git init -q "$tmp/$1" && git -C "$tmp/$1" remote add origin "$2"; }
mkrepo org-https https://github.com/Branch8/Some-Service.git
mkrepo org-ssh git@github.com:branch8/api.git
mkrepo other https://github.com/encode/httpx.git
mkdir "$tmp/plain"

out=$(cd "$tmp/org-https" && start s1)
check "org https remote is detected" '[[ $(printf "%s" "$out" | ctx) == *"repo \`Branch8/Some-Service\`"* ]]'
size=$(printf '%s' "$out" | ctx | wc -c)
check "context stays under 2 KB ($size bytes)" '[ "$size" -lt 2048 ]'

out=$(cd "$tmp/org-ssh" && start s2)
check "org ssh remote is detected" '[[ $(printf "%s" "$out" | ctx) == *"repo \`branch8/api\`"* ]]'

out=$(cd "$tmp/other" && start s3)
check "non-org remote is not claimed" '[[ $(printf "%s" "$out" | ctx) == *"not a branch8 repo"* ]]'

out=$(cd "$tmp/plain" && start s4)
check "folder without git still gets the rule" '[[ $(printf "%s" "$out" | ctx) == *"Consult it on your own initiative"* ]]'

out=$(prompt s4)
check "first prompt asks for the sign-in check" '[[ $(printf "%s" "$out" | ctx) == *"docs/login.md"* ]]'
out=$(prompt s4)
check "second prompt adds nothing" '[ -z "$out" ]'

(cd "$tmp/plain" && start s5 compact >/dev/null)
out=$(prompt s5)
check "compact does not arm the check" '[ -z "$out" ]'

bash "$helper" no-account >/dev/null
out=$(cd "$tmp/plain" && start s6)
check "no-account: context says do not ask" '[[ $(printf "%s" "$out" | ctx) == *"has no Devin account"* ]]'
out=$(prompt s6)
check "no-account: first prompt adds nothing" '[ -z "$out" ]'
bash "$helper" clear >/dev/null
(cd "$tmp/plain" && start s7 >/dev/null)
out=$(prompt s7)
check "clear: the check is armed again" '[[ $(printf "%s" "$out" | ctx) == *"docs/login.md"* ]]'

check "config prints the admin contact" '[[ $(bash "$helper" config) == *"admin="?* ]]'

out=$(cd "$tmp/plain" && BRANCH8_DEEPWIKI=off start s8)$(BRANCH8_DEEPWIKI=off prompt s8)
check "BRANCH8_DEEPWIKI=off prints nothing" '[ -z "$out" ]'

exit $fail
