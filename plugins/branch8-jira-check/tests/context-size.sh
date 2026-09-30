#!/usr/bin/env bash
# Guard: Claude Code moves SessionStart additionalContext over ~10 KB into a
# file and gives Claude only a 2 KB preview (measured 2026-09-30: 9 KB inline,
# 13.7 KB persisted). Run the hook in every account/layout combination and
# fail if any context exceeds the budget.
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"
budget=${BUDGET:-7000}
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/home/cfg" "$tmp/home/Desktop" "$tmp/home/plain" "$tmp/home/ws/a" "$tmp/home/repo"
git -C "$tmp/home/ws/a" init -q && git -C "$tmp/home/ws/a" remote add origin git@github.com:branch8/a.git
git -C "$tmp/home/repo" init -q
org='{"oauthAccount":{"emailAddress":"a@branch8.com","organizationUuid":"a4a2aa1a-21cd-467f-af54-8253e2ed15d8","organizationName":"Branch8","organizationType":"claude_team"}}'
per='{"oauthAccount":{"emailAddress":"a@gmail.com","organizationUuid":"x","organizationName":"x","organizationType":"claude_max"}}'
fail=0
for acct in "$org" "$per"; do
  printf '%s' "$acct" > "$tmp/home/cfg/.claude.json"
  for dir in "$tmp/home" "$tmp/home/Desktop" "$tmp/home/plain" "$tmp/home/ws" "$tmp/home/repo"; do
    for src in startup compact; do
      out=$(echo "{\"source\":\"$src\"}" | env -i PATH="$PATH" HOME="$tmp/home" \
        CLAUDE_CONFIG_DIR="$tmp/home/cfg" CLAUDE_PROJECT_DIR="$dir" bash "$root/hooks/session-start.sh")
      [ -z "$out" ] && continue
      size=$(printf '%s' "$out" | python3 -c 'import json,sys;print(len(json.load(sys.stdin)["hookSpecificOutput"]["additionalContext"].encode()))')
      label="$(printf '%s' "$acct" | grep -o '@[a-z0-9.]*' | head -1) ${dir#$tmp/} $src"
      if [ -z "$size" ]; then
        echo "FAIL hook output is not valid JSON: $label"; fail=1
      elif [ "$size" -gt "$budget" ]; then
        echo "FAIL $size bytes > $budget: $label"; fail=1
      else
        echo "ok   $size bytes: $label"
      fi
    done
  done
done
exit $fail
