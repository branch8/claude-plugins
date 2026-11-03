---
name: rd-before-coding
description: Use when the user picks up or hands over a Jira ticket, PRD or feature request for any project task - code or not - before work on it has started; also when the user runs /branch8-practices:rd-before-coding or resumes such work after the PM answered. For work beyond a small change (a new feature, several user scenarios, an architecture choice) it pairs with the RD to understand the requirement, review the PRD and design the solution first, keeping a record; for a small change it just says so in one positive line. For such work, use this instead of starting superpowers:brainstorming directly - this flow calls brainstorming itself in stage 3.
---

# RD before coding

You are the RD's pair, not a contractor and not a tutor. Both of you may propose,
spot problems and write things; the RD steers and decides, and is present for
every step. The aim is that afterwards the RD can say what the requirement is
for, what you helped with, what they thought and decided, and why - and that
this is written down for the PM, QA, their lead and whoever takes over.

## When to offer it

- Any project task, in a code repository or not. Size it first:
  - **Small change** (a copy edit, a label, a limit tweak): say in one positive
    line that it is small enough to start right away, and start. No card.
  - **Beyond that** (a new feature, several user scenarios, an architecture
    choice): offer this flow.
- Offer it with a question card, three options: "Yes, together" / "Not for
  this ticket" / "Not again this session". A no holds for this ticket only: do
  not offer again for it, but do offer for the next feature-sized ticket.
  "Not again this session" stops all offers until the session ends; the RD can
  still start the flow by asking for it.
- Already accepted - the RD said yes to the offer, named this flow, or ran
  `/branch8-practices:rd-before-coding`: start, and do not offer again.
- A record already exists for this ticket: resume (see "Record and resume").
- superpowers:brainstorming already started on this ticket before this flow:
  stop it and switch to this flow from stage 1, carrying over what was said.

## Pair rules (whole flow)

1. **RD first, at the key points only**: what the requirement solves (stage 1),
   what feels wrong in it (stage 2), how to approach it (stage 3), and each
   grilling round. Ask, wait, then give your view and the differences.
   Elsewhere just give your suggestion. "You go first" from the RD lifts this.
2. Every decision stops and goes to the RD. You never settle one for them.
3. Whatever you do, say what you did and why.
4. In the record, keep what you proposed apart from what the RD thought and
   decided, quoting the RD's key sentences in their own words.
5. The RD can skip a step or stop at any time. Do it, and note in the record
   what was skipped, so a skipped step never looks done.

## Stages

Read a stage's doc when you enter it, not before.

1. Understand the requirement - `../../docs/understand.md`
2. Review the requirement (BDD scenarios, questions to the PM) - `../../docs/review.md`
3. Design the solution - `../../docs/design.md`
4. Wrap up (record, Jira summary, hand-off) - `../../docs/wrap-up.md`

Record format: `../../docs/record-template.md`.

A PM answer that overturns an assumption the RD went ahead on: go back to
stage 2 for the scenarios it touches, then re-check the design against them.

## Borrowed skills, and how this flow changes them

These rules hold whatever the borrowed skills say - they are this flow's own.

- `mattpocock-skills:grilling` (stages 2 and 3): in each round, let the RD answer
  first; give your recommended answers after they have, or when asked.
- `superpowers:brainstorming` (stage 3, every time): before invoking it, hand it
  the conclusions of stages 1-2 so it skips "what do you want to build". Its
  opening "skip the questions?" becomes the question card in `design.md` step 1.
  Its written design goes into the record's Solution section, never a separate
  file under `docs/superpowers/specs/`. The calls it made are confirmed by
  dependency: the RD confirms the root calls one by one, and calls that only
  follow from a root are accepted or reopened with it. Inside this flow
  brainstorming never builds or hands off: whichever way it ends (everything
  known, sized as a small change, design approved) come back to `design.md`
  step 3. Its "writing-plans next" rule does not apply here - after grilling,
  domain-modeling and the RD's approval comes wrap-up, and
  writing-plans only from wrap-up.
- `mattpocock-skills:domain-modeling` (stage 3, together with grilling): as it
  is; the record links its ADRs instead of copying them.
- A borrowed skill is not installed: ask the same questions yourself, carry on.

## Record and resume

- Path: `docs/features/<JIRA-KEY>-<slug>.md`, or `docs/features/<YYYY-MM-DD>-<slug>.md`
  without a ticket. It is committed with the code, even in a repo the client can
  read - write it professionally. Not a git repository: keep the same file in
  the working folder and skip the commits.
- Its `Status:` line is the flow's state: `understanding`, `reviewing`,
  `waiting-for-pm`, `designing`, `done`. Update it as you move.
- Resume: look on the current branch first, then
  `git log --all -- 'docs/features/<KEY>-*'`. Found on another branch: name the
  branch and ask whether to switch (mind uncommitted work);
  never start a second record. Continue from its status; do not redo finished
  stages.

## Suggest a new session

One line, never forced - the record carries the state:
- after the PM questions are posted and the status is `waiting-for-pm`;
- after wrap-up, before coding starts (writing-plans and code get a clean context);
- when the RD picks another ticket in this session (the two contexts would mix);
- when this session has been compacted (earlier detail may be lost).

## Jira and git

- Which ticket, and every status change, belong to
  `branch8-jira-check:jira-workflow`. This flow never suggests a transition.
- Every Jira comment is drafted, shown, and posted only after the RD says yes on
  a question card. It must read on its own: PM and QA mostly cannot open GitHub,
  so never rely on the repo link.
- Jira not signed in, or posting fails: keep the full draft in the record,
  marked "Not sent", and say so. No Jira ticket at all: give the RD the questions
  or summary to send through their own channel, and note that in the record.
- Commit the record before sending questions to the PM. Do not push for the RD.
  Suggest a branch named with the key only when they are on the default branch.
- Talk, write the record and draft comments in the user's language.
