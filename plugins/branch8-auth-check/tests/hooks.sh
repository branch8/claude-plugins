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
# Never reach the real Devin from tests: a closed local port = "unknown".
export BA_DEVIN_URL=http://127.0.0.1:9/mcp
unset GITHUB_PERSONAL_ACCESS_TOKEN GEMINI_API_KEY DEVIN_API_KEY DEVIN_ORG_ID BRANCH8_AUTH_CHECK

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

out=$(cd "$tmp/repo" && DEVIN_API_KEY=cog_secret123 DEVIN_ORG_ID=org-777 start d1)
c=$(printf '%s' "$out" | ctx)
check "devin token presence reported, values never" '[[ $c == *"DEVIN_API_KEY: set"* && $c == *"DEVIN_ORG_ID: set"* && $c != *"cog_secret123"* && $c != *"org-777"* ]]'
out=$(cd "$tmp/repo" && start d2)
check "devin token not set is reported" '[[ $(printf "%s" "$out" | ctx) == *"DEVIN_API_KEY: not set · DEVIN_ORG_ID: not set"* ]]'
check "devin check not run without a token" '[[ $(printf "%s" "$out" | ctx) == *"Devin token check: not run (no token)"* ]]'
out=$(cd "$tmp/repo" && DEVIN_API_KEY=x start d3)
check "devin check unreachable is unknown" '[[ $(printf "%s" "$out" | ctx) == *"Devin token check: unknown"* ]]'
DEVIN_API_KEY= bash "$helper" check devin >/dev/null 2>&1; rc=$?
check "check devin without token exits 3" '[ "$rc" = 3 ]'
out=$(DEVIN_API_KEY=x bash "$helper" check devin 2>/dev/null); rc=$?
check "check devin offline exits 5" '[ "$rc" = 5 ] && [ "$out" = "devin: unknown" ]'

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

# /auth-check <service>: names and aliases.
check "service alias atlassian -> jira" '[ "$(bash "$helper" service Atlassian)" = jira ]'
check "service alias deepwiki -> devin" '[ "$(bash "$helper" service deepwiki)" = devin ]'
check "unknown service word is rejected" '! bash "$helper" service nope 2>/dev/null'

# Fake claude: `mcp list` prints $MCP_LIST.
cat > "$tmp/bin/claude" <<'SH'
#!/bin/sh
[ "$1 $2" = "mcp list" ] && printf '%b' "$MCP_LIST"
SH
chmod +x "$tmp/bin/claude"
need='! Needs authentication'
pick() { MCP_LIST="$1" bash "$helper" server "${2:-jira}" 2>/dev/null; }
L="claude.ai Atlassian: https://mcp.atlassian.com/v1/mcp - $need\nplugin:atlassian:atlassian: https://mcp.atlassian.com/v2/mcp (HTTP) - $need\n"
check "server: official plugin before connector" '[ "$(pick "$L")" = plugin:atlassian:atlassian ]'
L="claude.ai Atlassian: https://mcp.atlassian.com/v1/mcp - $need\n"
check "server: connector when no plugin" '[ "$(pick "$L")" = "claude.ai Atlassian" ]'
L="claude.ai Atlassian: https://mcp.atlassian.com/v1/mcp - $need\nplugin:atlassian:atlassian: https://mcp.atlassian.com/v2/mcp (HTTP) - ✔ Connected\n"
pick "$L" >/dev/null; rc=$?
check "server: one connected = signed in (exit 3)" '[ "$rc" = 3 ]'
L="plugin:branch8-deepwiki:devin: https://mcp.devin.ai/mcp (HTTP) - $need\n"
check "server: devin by host" '[ "$(pick "$L" devin)" = plugin:branch8-deepwiki:devin ]'
pick "$L" jira >/dev/null; rc=$?
check "server: no server for the service (exit 4)" '[ "$rc" = 4 ]'
check "server: github has no MCP sign-in" '! bash "$helper" server github 2>/dev/null'

for f in status card jira github devin gemini mcp-login; do
  check "docs/$f.md exists" '[ -f "$root/docs/$f.md" ]'
done

exit $fail
