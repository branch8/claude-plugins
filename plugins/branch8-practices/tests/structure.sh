#!/usr/bin/env bash
# Checks the plugin's shape: manifest, skill frontmatter, SKILL.md size, that
# every stage doc is referenced (and exists), and that the borrowed skills are
# named. Prompt behaviour is covered by evals/, which cost money and run locally.
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"
skill="$root/skills/rd-before-coding/SKILL.md"
docs="$root/docs"
fail=0
check() { if eval "$2"; then echo "ok   $1"; else echo "FAIL $1"; fail=1; fi; }

check "plugin.json is valid with name branch8-practices and a semver version" \
  'python3 -c "import json,re,sys; m=json.load(open(sys.argv[1])); sys.exit(0 if m.get(\"name\")==\"branch8-practices\" and re.fullmatch(r\"\d+\.\d+\.\d+\", m.get(\"version\",\"\")) else 1)" "$root/.claude-plugin/plugin.json" 2>/dev/null'

check "SKILL.md exists" '[ -f "$skill" ]'

# Frontmatter: name and description (<= 1024 characters).
front() { python3 - "$skill" "$1" <<'PY' 2>/dev/null
import sys
text = open(sys.argv[1], encoding="utf-8").read()
if not text.startswith("---\n"):
    sys.exit(1)
head = text[4:text.index("\n---", 4)]
for line in head.splitlines():
    key, _, value = line.partition(":")
    if key.strip() == sys.argv[2]:
        print(value.strip())
        sys.exit(0)
sys.exit(1)
PY
}
check "frontmatter name is rd-before-coding" '[ "$(front name)" = "rd-before-coding" ]'
desc=$(front description)
check "frontmatter description is present" '[ -n "$desc" ]'
check "description is at most 1024 characters (${#desc})" '[ "${#desc}" -le 1024 ]'

size=$( [ -f "$skill" ] && wc -c < "$skill" || echo 99999)
check "SKILL.md is under 8192 bytes ($size)" '[ "$size" -lt 8192 ]'

# Every doc SKILL.md points at exists, and every doc is pointed at.
refs=$(grep -o '\.\./\.\./docs/[a-z-]*\.md' "$skill" 2>/dev/null | sort -u)
check "SKILL.md references at least one stage doc" '[ -n "$refs" ]'
for r in $refs; do
  check "referenced $r exists" '[ -f "$root/skills/rd-before-coding/$r" ]'
done
for f in "$docs"/*.md; do
  [ -e "$f" ] || continue
  name=$(basename "$f")
  check "docs/$name is referenced from SKILL.md" 'grep -q "\.\./\.\./docs/$name" "$skill"'
done

for s in superpowers:brainstorming mattpocock-skills:grilling mattpocock-skills:domain-modeling \
         branch8-jira-check:jira-workflow docs/features/; do
  check "SKILL.md names $s" 'grep -qF "$s" "$skill" 2>/dev/null'
done

# The record template carries the headings the resume eval's scaffold writes.
for h in '## Purpose' '## Scenarios' '## Issues found' '## Solution' '## Collaboration' 'Status:'; do
  check "record-template.md has '$h'" 'grep -qF "$h" "$docs/record-template.md"'
done
check "review.md sets the waiting-for-pm state" 'grep -qF waiting-for-pm "$docs/review.md"'
check "design.md names superpowers:brainstorming" 'grep -qF superpowers:brainstorming "$docs/design.md"'
check "design.md orders writing-plans after grilling" 'grep -qF writing-plans "$docs/design.md"'

check "no TODO left in SKILL.md or docs/" '! grep -rq TODO "$skill" "$docs" 2>/dev/null'

exit $fail
