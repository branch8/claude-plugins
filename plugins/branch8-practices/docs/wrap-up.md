# Stage 4: Wrap up

1. **Finish the record** (format: `record-template.md` next to this file).
   Go through the Collaboration section's "RD thought / decided" items with the
   RD one by one - confirm or correct each. Never accept the whole section with
   a single "ok": that is the failure this flow exists to prevent.
2. **Jira summary.** Draft one comment that reads on its own, without the repo
   link: purpose, the scenarios with their confirmation state, the main
   decisions with their reasons, and what is still open. Add the repo path of
   the record as a pointer for RDs. Say that the comment is a snapshot and the
   record in the repo is the source of truth if they ever differ. Post only
   after the RD's yes on a question card.
3. **Scenarios to the PM.** Scenarios the RD wrote or changed go to the PM for
   confirmation - in the summary comment or a separate one, whichever reads
   better.
4. Set status `done` and commit the record.
5. **Hand off.** Next is `superpowers:writing-plans`; if brainstorming sized the
   work as a small change, implement directly instead. When the project has a
   test framework, the scenarios are the test list for TDD.
