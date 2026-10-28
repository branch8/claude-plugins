---
name: jira-workflow
description: Use when the user starts a new unit of work (feature, fix, change, document, investigation), when you are about to change files for it, when a pull request is opened or review is requested, or when work is merged or declared done — in a session where Branch8 Jira is connected. Also when the user asks which ticket a task belongs to, to open a ticket, or to move a ticket.
---

# Jira workflow

Every unit of work maps to one Jira ticket, and the ticket's status follows the
work at three points. You decide what to ask; the user confirms every write.

Skip all of this when Jira is not connected, the user declined Jira this
session, or the folder's record says `"jira": "none"` / `"company": false`.

## 1. Resolve the ticket (new unit of work)

Stop at the first step that gives an answer:

1. **The message names a key** (`HS-123`) → `getJiraIssue` to confirm; use it. No card.
2. **This session already has a current ticket** → decide whether the message is
   the same unit of work, by these tests:
   - **Same** (keep it, no card): a follow-up on what was just done - a fix or
     tweak to it, review feedback, tests, the commit / PR for it, the next step
     of the same feature or bug, or an answer to your question.
   - **New** (go to step 3): a different feature, bug, document or area of the
     product; the user signals a switch (「另外」「接下來做」「換一個」"next",
     "also", "now let's"); or the result would be its own PR.
   - **Unsure** → one card: 「繼續用 KEY summary」 / 「換一張單」 / 「開新單」 /
     「不需要開單」. Never keep a ticket silently when unsure: a wrong ticket
     collects the wrong status moves.
3. **Find candidates** - one card, never a silent pick:
   - the git branch's key (`git branch --show-current`), if any: a branch can be
     left over from earlier work, so it is a candidate, not an answer. Show it
     first as `KEY summary (status) · 目前分支`;
   - **search** `assignee = currentUser() AND statusCategory != Done AND project = <folder's projectKey>`
     (folder record via the plugin's `lookup` helper; no record → resolve the
     folder's Jira project first, see `../../docs/board.md` from this skill) and
     add the ones whose summary matches the task.

   The card holds **at most 4 options**: up to 2 candidates (the branch's
   included), then 「開新單」 and 「不需要開單」. The card's own "Other" field
   takes any other key. With no candidates: 「開新單」 / 「不需要開單」, and
   "Other" for a key the user has.

**Another project's ticket:** if the resolved ticket's project (the key prefix) is not the
folder's recorded project, do not start. One card: "open a new session in that project's
folder (recommended)" — give `cd <folder> && claude`, the folder from the project's record
(`lookup`) or `~/Branch8/<KEY>` — / "work on it here" / "cancel". Only "work on it here"
continues (with the mod: `set_ticket` with `confirmedOtherProject: true`).

**Creating:** draft a summary (one line, the user's language) and a short description
(goal, scope). Show the summary **in the card** so the same answer approves it.
`createJiraIssue` in the folder's project with its `defaultIssueType` (default Task).
Return the key and `<site>/browse/<KEY>`.

## 2. Offer a transition (three points)

| Point | When | Look for a transition toward |
|---|---|---|
| `start` | before your first file change for this ticket | 進行中 / In Progress / WIP |
| `pr` | a PR was opened or review requested | Dev done / PR created / Code review |
| `merge` | merged or declared done | Merged / Ready to deploy — **not** anything QA, staging or deploy |

1. The ticket's available transitions — only what it can do **now**: `listJiraIssueTransitions`
   (Atlassian plugin, via `executeRead`) or `getTransitionsForJiraIssue` (claude.ai connector).
2. Pick by the target status name. Statuses differ per project (HS has 10, HTGO2 has 33)
   and status categories are unreliable, so never guess a status that is not in the list.
3. One fits → card "Move KEY to <status>?" (yes / not now). Several fit → card listing
   them, best first, plus "not now". None fits, or the ticket is already past it → ask nothing.
4. Yes → `transitionJiraIssue`. If it needs fields or permission is denied, do not force
   it: say why and give `<site>/browse/<KEY>`.
5. Ask once per ticket and point, whatever the answer.

## With the branch8-jira-mod extension

If `mcp__branch8-jira-mod__set_ticket` exists:
- after step 1 resolves or creates a ticket → `set_ticket` (key, summary, status, cloudId);
- after asking at a point → `mark_asked` with `"<KEY>:<start|pr|merge>"`;
- after a transition succeeds → `set_ticket` again with the new status, so the line above the prompt updates at once;
- the system prompt then lists the current ticket and the points already asked: trust it.
If the mod reminds you at a point, run section 2 for that point.

Without the mod, remember the ticket and the asked points yourself for the session.

## Always

- **No card, no write.** Where you cannot show a question card (a subagent, a headless
  `-p` run), never create a ticket or move a status — say what you would have asked.
- Question cards (AskUserQuestion), one question per card, in the user's language.
- Quiet: no narration of these steps; the user sees only the cards and the result lines.
- Use the key in branch names and commit messages (`HS-123: …`) unless the repo has its own convention.

## Common mistakes

| Mistake | Instead |
|---|---|
| Asking for a ticket when the message already names the key | Step 1 answers it silently |
| Using the branch's key without asking | The branch may be left over from earlier work: offer it as the first candidate |
| Keeping the current ticket when the user moved on to something else | Run the same / new / unsure tests in step 2 |
| A card with more than 4 options | Up to 2 candidates + 開新單 + 不需要開單; other keys go in "Other" |
| Moving a status without a card | Every write waits for the user's yes |
| Guessing "In Progress" by name when the workflow has no such transition now | Only offer transitions the list returns |
| Asking again after the user said "not now" | Once per ticket and point |
| Offering QA / staging / deploy moves after a merge | Those belong to QA and release, not you |
