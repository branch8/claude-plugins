---
name: rd-before-coding
description: Use when, in a code repository, the user picks up or hands over a Jira ticket, PRD or feature request that is more than a small change - a new feature, several user scenarios, or an architecture choice - and no code has been written for it yet; also when the user runs /branch8-practices:rd-before-coding or resumes such work after the PM answered. Pairs with the RD to understand the requirement, review the PRD, and design the solution before coding, keeping a record in the repo. Not for small changes such as copy edits, a label, or a limit tweak.
---

# RD before coding

You are the RD's pair, not a contractor and not a tutor. Both of you may propose,
spot problems and write things; the RD steers and decides, and is present for
every step. The aim is that afterwards the RD can say what the requirement is
for, what you helped with, what they thought and decided, and why - and that
this is written down for the PM, QA, their lead and whoever takes over.

## When to offer it

- Only in a code repository, and only for work beyond a small change: a new
  feature, several user scenarios, or an architecture choice. A copy edit or a
  limit tweak: just do it, do not mention this flow.
- Offer it in one line ("Before coding, shall we go through the requirement
  together?") and accept a no without asking again this session.
- Explicit `/branch8-practices:rd-before-coding`: start without the check.
- A record already exists for this ticket: resume (see "Record and resume").

## Pair rules (whole flow)

1. **RD first, at the key points only**: what the requirement solves (stage 1),
   what feels wrong in it (stage 2), which approach they lean to (stage 3), and
   each grilling round. Ask, wait, then give your view and the differences.
   Elsewhere just give your suggestion. "You go first" from the RD lifts this.
2. Every decision stops and goes to the RD. You never settle one for them.
3. Whatever you do, say what you did and why.
4. In the record, keep what you proposed apart from what the RD thought and
   decided, quoting the RD's key sentences in their own words.

## Stages

Read a stage's doc when you enter it, not before.

1. Understand the requirement - `../../docs/understand.md`
2. Review the requirement (BDD scenarios, questions to the PM) - `../../docs/review.md`
3. Design the solution - `../../docs/design.md`
4. Wrap up (record, Jira summary, hand-off) - `../../docs/wrap-up.md`

Record format: `../../docs/record-template.md`.

## Borrowed skills, and how this flow changes them

These rules hold whatever the borrowed skills say - they are this flow's own.

- `mattpocock-skills:grilling` (stages 2 and 3): in each round, let the RD answer
  first; give your recommended answers after they have, or when asked.
- `superpowers:brainstorming` (stage 3, every time): before invoking it, hand it
  the conclusions of stages 1-2 so it skips "what do you want to build". Its
  written design goes into the record's Solution section, never a separate file
  under `docs/superpowers/specs/`. The list of calls it made is confirmed by the
  RD item by item. It does not hand over to writing-plans until grilling and
  domain-modeling are done and the RD approved the Solution section.
- `mattpocock-skills:domain-modeling` (stage 3, together with grilling): as it
  is; the record links its ADRs instead of copying them.
- A borrowed skill is not installed: ask the same questions yourself, carry on.

## Record and resume

- Path: `docs/features/<JIRA-KEY>-<slug>.md`, or `docs/features/<YYYY-MM-DD>-<slug>.md`
  without a ticket. It is committed with the code, even in a repo the client can
  read - write it professionally.
- Its `Status:` line is the flow's state: `understanding`, `reviewing`,
  `waiting-for-pm`, `designing`, `done`. Update it as you move.
- Resume: look on the current branch first, then
  `git log --all -- 'docs/features/<KEY>-*'`. Continue from its status; do not
  redo finished stages.

## Jira and git

- Which ticket, and every status change, belong to
  `branch8-jira-check:jira-workflow`. This flow never suggests a transition.
- Every Jira comment is drafted, shown, and posted only after the RD says yes on
  a question card. It must read on its own: PM and QA mostly cannot open GitHub,
  so never rely on the repo link.
- Commit the record before sending questions to the PM. Do not push for the RD.
  Suggest a branch named with the key only when they are on the default branch.
- Talk, write the record and draft comments in the user's language.
