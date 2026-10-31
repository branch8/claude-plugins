# branch8-practices / rd-before-coding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a new plugin `branch8-practices` whose first skill, `rd-before-coding`, walks an RD through understanding a requirement, reviewing the PRD, and designing a solution together with Claude before any code is written, leaving a record in the repo and a self-contained summary on Jira.

**Architecture:** A prompt-only plugin: one short `SKILL.md` (entry, scale check, pair rules, stage map, overrides of borrowed skills) plus one doc per stage under the plugin's `docs/`, read only when that stage starts. It calls `superpowers:brainstorming`, `mattpocock-skills:grilling` and `mattpocock-skills:domain-modeling`, and leaves ticket and status work to `branch8-jira-check:jira-workflow`. jira-mod's `pickNote` gains one sentence so that picking a ticket in the pane triggers the scale check.

**Tech Stack:** Markdown skills; bash test script (repo convention); `claude plugin eval` (local, billed); TypeScript for the jira-mod change (`claude plugin test`).

**Spec:** `docs/superpowers/specs/2026-10-30-rd-before-coding-design.md`. Read it in full before any task. The plan pins names and checks; the spec holds the reasoning and the exact rules.

## Global Constraints

- Plugin name `branch8-practices`, skill name `rd-before-coding`, invoked as `/branch8-practices:rd-before-coding`. Future skills in this plugin carry a role prefix (`rd-…`, `pm-…`).
- Skill and docs text in English (like jira-workflow). Claude talks to the RD, writes the record and drafts Jira comments in the user's language.
- `SKILL.md` under 8192 bytes. Stage detail lives in `plugins/branch8-practices/docs/*.md`, referenced from the skill as `../../docs/<file>.md`.
- The repo is public: every example in the skill, docs and evals is fictional. No client names, no real project names.
- Nothing is posted to Jira without the RD's explicit yes on a question card ("No card, no write", as in jira-workflow).
- Record path: `docs/features/<JIRA-KEY>-<slug>.md`, or `docs/features/<YYYY-MM-DD>-<slug>.md` when there is no ticket. It goes into the project repo even when the client can read it, so it must be written professionally.
- Repo conventions: bump a plugin's version on every change; `python3 scripts/validate.py` reports 0 errors; code comments and CI output in English; README.md and CLAUDE.md in Traditional Chinese; Python scripts use only the standard library.
- Evals are billed model calls: run them locally on demand, never in CI.

## Review Focus

1. **A PRD link Claude cannot open** (Google Docs, Jira attachment, no connector): Claude says what it could not read and asks for it to be pasted or connected. It never summarises content it did not see. Pinned by eval `unreadable-link` (Task 3).
2. **A second session after the PM answered**: Claude finds the existing record and continues from its status, without restarting stage 1. Pinned by eval `resume-from-record` (Task 3).
3. **A small change**: no flow is offered and Claude just does it. Pinned by eval `small-change` (Task 3).
4. **The RD writes in Chinese**: replies, the record and the Jira drafts are in Chinese, even though the skill text is English. Pinned by the rubric line in every eval (Task 3).
5. **A PM picks a ticket in a folder that is not a code repo**: the pickNote hint must not push the RD flow on them. Pinned by the wording assertion in Task 4 and the manual check in Task 6.

---

### Task 1: Plugin skeleton, core SKILL.md, structure test, marketplace entry

**Files:**
- Create: `plugins/branch8-practices/.claude-plugin/plugin.json`
- Create: `plugins/branch8-practices/skills/rd-before-coding/SKILL.md`
- Create: `plugins/branch8-practices/tests/structure.sh`
- Create: `plugins/branch8-practices/docs/understand.md`, `review.md`, `design.md`, `wrap-up.md`, `record-template.md` (empty headings only in this task; Task 2 fills them)
- Modify: `.claude-plugin/marketplace.json` (append entry)
- Modify: `.github/workflows/validate.yml` (add a step after "branch8-auth-check hooks")

**Interfaces:**
- Produces: the five doc paths above, which `SKILL.md` references as `../../docs/<name>.md`, and the record state names used by Tasks 2 and 3: `understanding`, `reviewing`, `waiting-for-pm`, `designing`, `done`.

- [ ] **Step 1: Write the failing structure test** `plugins/branch8-practices/tests/structure.sh`, in the style of `plugins/branch8-auth-check/tests/hooks.sh` (a `check "<name>" '<condition>'` helper, `ok`/`FAIL` lines, exit 1 on any failure). Checks:
  - `plugin.json` is valid JSON with `"name": "branch8-practices"` and a semver `version`.
  - SKILL.md frontmatter `name: rd-before-coding`; `description` is present and at most 1024 characters.
  - SKILL.md is under 8192 bytes.
  - Every `../../docs/*.md` path SKILL.md mentions exists, and every file in `docs/` is mentioned by SKILL.md (no orphans).
  - SKILL.md contains each of these literal strings: `superpowers:brainstorming`, `mattpocock-skills:grilling`, `mattpocock-skills:domain-modeling`, `branch8-jira-check:jira-workflow`, `docs/features/`.
  - SKILL.md and `docs/` contain no `TODO`.

- [ ] **Step 2: Run it and see it fail**
  Run: `bash plugins/branch8-practices/tests/structure.sh`
  Expected: `FAIL` lines (files missing), exit 1.

- [ ] **Step 3: Write `plugin.json`** with version `0.1.0`, displayName `Branch8 Practices`, author `Branch8`, and a description covering: Branch8's way of working with Claude; first skill rd-before-coding (understand the requirement, review the PRD, design the solution with Claude before coding, record kept in the repo plus a Jira summary).

- [ ] **Step 4: Write `SKILL.md`.** Frontmatter `description`: trigger when the user picks or hands over a Jira ticket, PRD or feature request that is more than a small change (a new feature, several user scenarios, or an architecture choice) and no code has been written for it yet; also on `/branch8-practices:rd-before-coding`. Say explicitly that it does not apply to small changes such as copy edits or limit tweaks. The body must contain, in this order:
  1. **When to offer it**: the scale check from the spec's "入口與規模判斷", plus "only in a code repo". Offer it; never force it. An explicit invocation skips the check.
  2. **Pair rules**: the four rules from the spec's "pair 的規則". "RD first" applies only at the key points the spec lists: what it solves, what feels wrong, which approach, and each grilling round. The RD can always say "you go first".
  3. **Stage map**: one line per stage naming its doc (`../../docs/understand.md`, `review.md`, `design.md`, `wrap-up.md`). Read the doc when entering the stage, not before.
  4. **Borrowed skills**: the three overrides from the spec's table. Grilling: RD answers before Claude's recommendation. Brainstorming: hand it stages 1 and 2 first; its spec goes into the record's Solution section, not `docs/superpowers/specs/`; its list of calls is confirmed by the RD item by item; it may move on to writing-plans only after grilling. Domain-modeling: used together with grilling, and the record links its ADRs. If a borrowed skill is not installed, ask the same questions directly and do not stop.
  5. **Record and resume**: the path rule from Global Constraints, the five state names, and the rule that the record is the flow's state. On resume, look on the current branch first, then `git log --all -- 'docs/features/<KEY>-*'`.
  6. **Jira and git**: tickets and status changes belong to `branch8-jira-check:jira-workflow`, and this skill never suggests a transition itself. Every Jira comment is drafted, shown, and posted only after a yes on a card, and must be readable without opening the repo (PM and QA mostly cannot open GitHub). Commit the record before sending questions to the PM; do not push on the RD's behalf; suggest a branch named with the key only when on the default branch.

- [ ] **Step 5: Create the five docs** with a single `# <Stage name>` heading each, so the structure test's reference checks can pass. Content comes in Task 2.

- [ ] **Step 6: Run the structure test until it passes**
  Run: `bash plugins/branch8-practices/tests/structure.sh`
  Expected: only `ok` lines, exit 0.

- [ ] **Step 7: Register the plugin.** Append to `marketplace.json` `plugins`: `{"name": "branch8-practices", "source": "./plugins/branch8-practices", "description": <one sentence matching plugin.json>, "category": "productivity", "keywords": ["workflow", "bdd", "prd", "design", "pairing"]}`. Add to `validate.yml`: a step named `branch8-practices structure` that runs `bash plugins/branch8-practices/tests/structure.sh`.

- [ ] **Step 8: Validate**
  Run: `python3 scripts/validate.py`
  Expected: `0 error(s)` and no warning for `branch8-practices`.

- [ ] **Step 9: Commit**
  ```bash
  git add plugins/branch8-practices .claude-plugin/marketplace.json .github/workflows/validate.yml
  git commit -m "feat(branch8-practices): skeleton and rd-before-coding core skill (0.1.0)"
  ```

### Task 2: Stage docs and record template

**Files:**
- Modify: `plugins/branch8-practices/docs/understand.md`, `review.md`, `design.md`, `wrap-up.md`, `record-template.md`
- Modify: `plugins/branch8-practices/tests/structure.sh`

**Interfaces:**
- Consumes: the doc paths and state names from Task 1.
- Produces: the record headings that Task 3's `resume-from-record` scaffold writes: `## Purpose`, `## Scenarios`, `## Issues found`, `## Solution`, `## Collaboration`, plus a `Status: <state>` line under the title.

- [ ] **Step 1: Extend the structure test (failing).** `record-template.md` contains each of the five headings above and a `Status:` line. `review.md` contains `waiting-for-pm`. `design.md` contains both `superpowers:brainstorming` and `writing-plans`.

- [ ] **Step 2: Run it and see the new checks fail**
  Run: `bash plugins/branch8-practices/tests/structure.sh`
  Expected: `FAIL` on the new checks only.

- [ ] **Step 3: Write the docs.** Each one carries the spec's section for its stage, turned into instructions to Claude:
  - `understand.md`: spec "第 1 段". Lay out the source text without interpretation. For a long PRD, give only a table of contents with locations. If a link or attachment cannot be read, say so and ask for it to be pasted or connected; never summarise unseen content. Then the RD restates the purpose, then Claude adds its reading and the differences. "Just tell me" skips the restatement and is noted in the record.
  - `review.md`: spec "第 2 段". Ask the RD what feels wrong first. Then Claude scans every scenario for gaps, conflicts, infeasibility and better approaches, and the RD rules on each finding. If the PRD has no scenarios, write them with the RD and mark them "written by RD, pending PM". Run grilling (with the RD-first override). Draft the PM questions as one self-contained Jira comment, post it after a card yes, commit the record and set the status to `waiting-for-pm`. The RD may go on with assumptions, which are marked as such in the record.
  - `design.md`: spec "第 3 段" and the brainstorming ordering rule. Ask which approach the RD leans to. Invoke brainstorming every time, with stages 1–2 handed over and its spec going into the record. The RD picks. Then grilling and domain-modeling, with ADRs for hard-to-reverse trade-offs. The Solution section is approved by the RD only after grilling, and only then may writing-plans follow.
  - `wrap-up.md`: spec "第 4 段", plus "RD 想了什麼" (the RD-thinking column) confirmed item by item. The Jira summary is self-contained (purpose, scenarios with confirmation state, main decisions with reasons, open questions) and posted after a card yes. Scenarios go to the PM. State that the Jira comment is a snapshot and the repo record is the source of truth when they differ. Hand-off: writing-plans, or direct implementation if brainstorming sized it as a small change; with a test framework, scenarios become the test list for TDD.
  - `record-template.md`: the spec's "紀錄格式" with the English headings above. One instruction line at the top: write headings and content in the user's language. The Solution section includes the brainstorming calls the RD confirmed and the ADR links. The Collaboration section keeps "Claude proposed" and "RD thought / decided" apart, quoting the RD's key sentences verbatim.

- [ ] **Step 4: Run the structure test until it passes**
  Run: `bash plugins/branch8-practices/tests/structure.sh`
  Expected: only `ok` lines, exit 0.

- [ ] **Step 5: Commit** (the plugin is unreleased: keep version `0.1.0` across Tasks 1–3)
  ```bash
  git add plugins/branch8-practices
  git commit -m "feat(branch8-practices): rd-before-coding stage docs and record template"
  ```

### Task 3: Evals

**Files:**
- Create: `plugins/branch8-practices/evals/<case>/prompt.md` and `graders/*.md` for the five cases below (`case.yaml` only for `resume-from-record`)
- Create: `plugins/branch8-practices/evals/resume-from-record/scaffold.sh`
- Modify: `.gitignore` (add `plugins/branch8-practices/evals/results/`)
- Modify: `docs/superpowers/specs/2026-10-30-rd-before-coding-design.md` ("驗證方式" section)

**Interfaces:**
- Consumes: record headings and state names from Task 2; skill name `rd-before-coding`.

Format (from https://code.claude.com/docs/en/plugin-evals.md; confirm against `claude plugin eval --help` in your build): one directory per case. `prompt.md` has YAML frontmatter (`name`, `tags`, `runs`, `max_turns`, …) and the prompt as its body. Each `graders/<name>.md` has frontmatter `type` and a body. Skill trigger: `type: tool_used`, `tool: Skill`, `input_match: '"skill"\s*:\s*"(?:[\w-]+:)?rd-before-coding"'`. Rubric: `type: llm` with a body of `PASS if … / FAIL if …`. The sandbox loads only this plugin: no superpowers, no mattpocock, no Jira MCP, and a single user turn.

Every case's llm rubric also includes: `FAIL if the reply is not in the same language as the prompt.`

- [ ] **Step 1: Write the five cases.** All PRDs are fictional and the prompts are in Chinese.
  - `prd-with-scenarios`: a short fictional PRD with 3 Given/When/Then scenarios, plus "幫我做這個功能". Graders: tool_used (the skill). llm: PASS if Claude lays out the PRD without stating its own interpretation of the purpose and asks the RD to say in their own words what it solves; FAIL if it writes code, plans an implementation, or gives its interpretation first.
  - `prd-without-scenarios`: a prose-only PRD, plus a prompt in which the RD has already restated the purpose and asks to review the PRD. llm: PASS if Claude asks the RD what feels wrong before listing its own findings, or notes that the PRD has no concrete scenarios and offers to write them together as pending PM confirmation; FAIL if it jumps to a solution or code.
  - `small-change`: "把結帳按鈕文字從「送出」改成「確認付款」". llm: PASS if Claude goes straight to the change (or asks only where the button is); FAIL if it proposes requirement review, PRD review or the rd-before-coding flow. If the eval format supports a negated tool_used, add it; if not, the rubric is the check.
  - `unreadable-link`: "這是 PRD：https://docs.google.com/document/d/FAKE-ID/edit 幫我開始". llm: PASS if Claude says it cannot open the link and asks for the content to be pasted or a connector; FAIL if it describes or summarises any PRD content.
  - `resume-from-record`: `case.yaml` (`schema_version: "1.1"`, `name`, `context.scaffold_script: scaffold.sh`). `scaffold.sh` runs `git init` and commits `docs/features/DEMO-12-coupon-stacking.md` with `Status: waiting-for-pm`, filled Purpose, Scenarios and Issues sections, and two open PM questions. Prompt: "DEMO-12 PM 回覆了：第一題可以疊加，第二題上限 3 張。繼續。" llm: PASS if Claude reads the record, records the PM answers against the two questions, and moves on to the remaining review or to design; FAIL if it restarts by laying out the PRD or asking the RD to restate the purpose. Grant `allowed_tools` the read tools plus Bash for `git log`.

- [ ] **Step 2: Gitignore results.** Add `plugins/branch8-practices/evals/results/` to `.gitignore`.

- [ ] **Step 3: Run the suite**
  Run: `cd plugins/branch8-practices && claude plugin eval . --scaffold --ablation none --runs 3 --max-cost-usd 10`
  Expected: exit 0; every case's WITH column at 1.00. If a case fails, change SKILL.md or the docs, not the grader, unless the grader misreads a reply that meets the spec. Then rerun only that case with `--case <name>`.

- [ ] **Step 4: Update the spec's "驗證方式" section.** The eval sandbox loads only the plugin under test and replays a single turn, so "brainstorming then grilling before writing-plans" and "no separate spec under `docs/superpowers/specs/`" move to the manual walkthrough (Task 6). The eval list becomes the five cases above.

- [ ] **Step 5: Commit**
  ```bash
  git add plugins/branch8-practices .gitignore docs/superpowers/specs/2026-10-30-rd-before-coding-design.md
  git commit -m "test(branch8-practices): rd-before-coding evals"
  ```

### Task 4: jira-mod pickNote hint

**Files:**
- Modify: `plugins/branch8-jira-mod/hooks/logic.ts` (`pickNote`, ~line 886)
- Modify: `plugins/branch8-jira-mod/hooks/logic.test.ts` (test "the note Claude reads when the person picks or unselects a ticket in the pane", ~line 574)
- Modify: `plugins/branch8-jira-mod/.claude-plugin/plugin.json` (`0.16.1` → `0.17.0`)

**Interfaces:**
- Consumes: skill id `branch8-practices:rd-before-coding`.

- [ ] **Step 1: Extend the test (failing).** For a picked ticket: `note.includes('branch8-practices:rd-before-coding')` and `note.includes('code repo')` are both true. For `pickNote(null)`: `includes('rd-before-coding')` is false.

- [ ] **Step 2: Run it and see it fail**
  Run: `claude plugin test plugins/branch8-jira-mod`
  Expected: the pickNote test fails, and all other tests pass.

- [ ] **Step 3: Append to the picked-ticket string** in `pickNote`, after the existing sentences, exactly:
  `'If this folder is a code repo and the ticket is more than a small change (a new feature, several user scenarios, or an architecture choice), offer the branch8-practices:rd-before-coding workflow before writing code, if that skill is available; the user may decline.'`
  Leave the unselect string unchanged.

- [ ] **Step 4: Run the tests until they pass**
  Run: `claude plugin test plugins/branch8-jira-mod`
  Expected: all tests pass, the same count as before this change.

- [ ] **Step 5: Bump to `0.17.0` and commit**
  ```bash
  python3 scripts/validate.py
  git add plugins/branch8-jira-mod
  git commit -m "feat(branch8-jira-mod): picking a ticket offers rd-before-coding for feature-sized work (0.17.0)"
  ```

### Task 5: Distribution and docs

**Files:**
- Modify: `managed-settings.json` (`enabledPlugins`: add `"branch8-practices@branch8": true` after `branch8-auth-check`)
- Modify: `README.md` ("目前發送什麼" table: one row for `branch8-practices`, in the style of the `branch8-auth-check` row)
- Modify: `CLAUDE.md` (file map: an entry for `plugins/branch8-practices/`; update the managed-settings line's count, "自家 2 個", to match the real number)

- [ ] **Step 1: Check that the official marketplace has no equivalent** (CLAUDE.md decision 3: "加新 plugin 前的第一個動作，永遠是查官方有沒有"), using the method in README "目前發送什麼". Note the date and how many plugins were checked, for the README row.

- [ ] **Step 2: Edit the three files.** README row (zh-TW): what the skill does, its trigger (picking a ticket in the panel, or the slash command), that it calls brainstorming, grilling and domain-modeling, and the official-marketplace check result. CLAUDE.md entry (zh-TW): why it is a separate plugin (it holds Branch8's working practices; skills carry a role prefix); records go into project repos, client repos included (user decision, 2026-10-30); Jira comments are self-contained because PM and QA mostly cannot open GitHub; evals are local and billed, never in CI; the sandbox cannot test the brainstorming→grilling order.

- [ ] **Step 3: Validate**
  Run: `python3 scripts/validate.py && bash plugins/branch8-practices/tests/structure.sh && python3 -c "import json; json.load(open('managed-settings.json'))"`
  Expected: 0 errors, all `ok`, no JSON error.

- [ ] **Step 4: Commit**
  ```bash
  git add managed-settings.json README.md CLAUDE.md
  git commit -m "feat(managed-settings): ship branch8-practices; docs"
  ```

### Task 6: Manual walkthrough (before merge)

No code. Run this in a real Claude Code session, with this branch's plugins loaded and the company plugins installed. Use a fictional or low-stakes ticket in a scratch repo. Write the results into the PR description.

- [ ] Picking a feature-sized ticket in the `/jira-todo` panel, inside a code repo, makes Claude offer rd-before-coding. Declining lets work continue with no further nagging.
- [ ] Picking the same ticket in a non-git folder brings no offer.
- [ ] Stage 1 lays out the ticket without interpretation, waits for the RD's restatement, then shows the differences.
- [ ] Stage 2 asks the RD first; the PM-questions comment is self-contained and posted only after a card yes; the record is committed with status `waiting-for-pm`; nothing is pushed.
- [ ] Stage 3 invokes brainstorming; no file appears under `docs/superpowers/specs/`; grilling (RD first) and domain-modeling run **before** writing-plans; brainstorming's calls are confirmed by the RD item by item.
- [ ] Wrap-up: the RD-thinking column is confirmed item by item, the Jira summary reads well without the repo link, and writing-plans or TDD comes next.
- [ ] A new session resumes from the record.
- [ ] On the default branch, Claude suggests a branch named with the key; on a feature branch, it does not.
- [ ] (Added after final review) Free-text entry: with superpowers installed, pasting a feature PRD and saying 「幫我做這個功能」 starts rd-before-coding (or offers it), not brainstorming on its own.
- [ ] Brainstorming's exits: answering "skip" to its opening line, or it deciding everything is known, still returns to "RD picks" and grilling; nothing gets built.
- [ ] Approving the Solution section leads to wrap-up (RD-thinking confirmed item by item, Jira summary) before writing-plans.
- [ ] Resume while on main with the record on the ticket branch: Claude names the branch and asks; no second record appears.
- [ ] Declining the offer for ticket A, then picking feature-sized ticket B, brings an offer for B.
- [ ] The record and the Jira drafts are in Chinese when the RD writes in Chinese.
