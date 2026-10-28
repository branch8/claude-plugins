#!/usr/bin/env bash
# Checks the hooks: valid JSON, small context, git/non-git GitHub handling,
# first-prompt arming and consuming, "no account" answers, the off switch.
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"
hook="$root/hooks/session-start.sh"
first="$root/hooks/first-prompt.sh"
helper="$root/bin/branch8-auth"
fail=0
check() { if eval "$2"; then echo "ok   $1"; else echo "FAIL $1"; fail=1; fi; }

ctx() { python3 -c 'import json,sys; print(json.load(sys.stdin)["hookSpecificOutput"]["additionalContext"])'; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
export HOME="$tmp/home"   # keep markers and answers out of the real home
mkdir -p "$HOME" "$tmp/bin" "$tmp/plain"
git init -q "$tmp/repo"

# Fake gh: signed in unless GH_FAKE=out; absent when GH_FAKE=missing (PATH trick).
cat > "$tmp/bin/gh" <<'SH'
#!/bin/sh
[ "$GH_FAKE" = out ] && { echo "You are not logged into any GitHub hosts." >&2; exit 1; }
echo "  ✓ Logged in to github.com account octo (keyring)"
SH
chmod +x "$tmp/bin/gh"
export PATH="$tmp/bin:$PATH"
unset GITHUB_PERSONAL_ACCESS_TOKEN GEMINI_API_KEY BRANCH8_AUTH_CHECK

start() { printf '{"session_id":"%s","source":"%s"}' "$1" "${2:-startup}" | bash "$hook"; }
prompt() { printf '{"session_id":"%s","prompt":"hi"}' "$1" | bash "$first"; }

out=$(cd "$tmp/repo" && start s1)
c=$(printf '%s' "$out" | ctx)
check "git repo: gh signed in with account" '[[ $c == *"gh: signed in octo"* ]]'
size=$(printf '%s' "$c" | wc -c)
check "context stays under 3 KB ($size bytes)" '[ "$size" -lt 3072 ]'

out=$(cd "$tmp/repo" && GH_FAKE=out start s2)
check "git repo: gh signed out is reported" '[[ $(printf "%s" "$out" | ctx) == *"NOT signed in"* ]]'

out=$(cd "$tmp/plain" && start s3)
check "non-git folder: GitHub not checked" '[[ $(printf "%s" "$out" | ctx) == *"not checked - not a git folder"* ]]'

out=$(cd "$tmp/repo" && GEMINI_API_KEY=x GITHUB_PERSONAL_ACCESS_TOKEN=y start s4)
c=$(printf '%s' "$out" | ctx)
check "env presence reported, values never" '[[ $c == *"PAT: set"* && $c == *"GEMINI_API_KEY: set"* && $c != *"=x"* ]]'

out=$(prompt s3)
check "first prompt asks for the status line" '[[ $(printf "%s" "$out" | ctx) == *"status.md"* ]]'
# jira-check only maps a folder once Jira is connected, so an unmapped company
# folder must still get the Jira card on the first turn.
check "first prompt asks Jira upfront for unmapped company folders too" '[[ $(printf "%s" "$out" | ctx) == *"not yet mapped"* ]]'
out=$(prompt s3)
check "second prompt adds nothing" '[ -z "$out" ]'

(cd "$tmp/plain" && start s5 compact >/dev/null)
out=$(prompt s5)
check "compact does not arm the check" '[ -z "$out" ]'

bash "$helper" no-account devin >/dev/null
out=$(cd "$tmp/plain" && start s6)
check "no-account is listed" '[[ $(printf "%s" "$out" | ctx) == *"no account (do not ask): devin"* ]]'
bash "$helper" clear devin >/dev/null
out=$(cd "$tmp/plain" && start s7)
check "clear removes it" '[[ $(printf "%s" "$out" | ctx) == *"no account (do not ask): none"* ]]'
check "unknown service is rejected" '! bash "$helper" no-account nope 2>/dev/null'
check "config prints the admin contact" '[[ $(bash "$helper" config) == *"admin="?* ]]'

out=$(cd "$tmp/plain" && BRANCH8_AUTH_CHECK=off start s8)$(BRANCH8_AUTH_CHECK=off prompt s8)
check "BRANCH8_AUTH_CHECK=off prints nothing" '[ -z "$out" ]'

for f in status card jira github devin gemini; do
  check "docs/$f.md exists" '[ -f "$root/docs/$f.md" ]'
done

exit $fail
