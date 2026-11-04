# Stage 2: Health-check the requirement

Record status: `reviewing`.

You check the confirmed requirement for defects; the RD rules on what you
find. The yardstick is always the purpose the ticket states, not its wording.

1. **No scenarios in the PRD?** First write them with the RD in
   Given/When/Then ("given a situation, when the user does something, then
   they should see a result"), and mark each "written by RD, pending PM
   confirmation". The check below works on these scenarios.
2. **Check it yourself**, scenario by scenario and as a whole. This pass is
   yours; the RD does not have to go line by line. Look at:
   - **completeness** - missing information or scenarios; acceptance criteria
     that are vague or cannot be tested;
   - **contradictions** - within the ticket, against the PRD, against other
     tickets or the existing system;
   - **logic** - flows that do not hold together, gaps in state changes;
   - **flexibility** - hard-coded assumptions that will hurt when things change;
   - **impact on use** - effects on other roles, permissions, who can see what;
   - **edge cases** - error paths, empty or huge inputs, concurrent actions;
   - **scope and dependencies** - the line between this ticket and others,
     preconditions;
   - **non-functional** - performance, security, personal data, data migration.
   Include anything the RD flagged in stage 1.
3. **Nothing found:** say so in one line
   ("the requirement is complete; no defects found"), note it in the record,
   set status `designing` and read `design.md` next to this file.
4. **Issue map.** Otherwise list each issue on one line: type (one of the
   aspects above), severity (blocks work / important / minor), and which other
   issues it depends on. Show it and write it into the record.
5. **Discuss in rounds**, working the map like a grilling design tree
   (`mattpocock-skills:grilling`, with the overrides in SKILL.md):
   - Each round asks only the issues whose premises are settled - never one
     whose answer depends on an issue still open. One question card per round,
     up to 4 questions, the most blocking first.
   - Each question: 2-3 options plus "Ask the PM"; the RD can write their own
     in "Other". Do not mark a recommended option - the RD thinks first; if
     they ask for your view in "Other", give it.
   - After each round, recompute: issues whose premises are now settled join
     the next round; issues an answer made moot are struck out, with the reason.
   - An issue that needs a new approach rather than a choice: open a short
     brainstorm on it (`superpowers:brainstorming`, same overrides), then
     come back to the map.
   - Record each answer and who gave it.
   - The requirement as a whole cannot or should not be done (infeasible, or it
     works against the purpose): with the RD's agreement, draft a comment that
     proposes to send the requirement back - what blocks it, and what could
     reach the purpose instead - and handle it like the PM questions below.
6. **Questions for the PM.** Collect the "Ask the PM" issues into one Jira
   comment. It must stand on its own: for each question, the scenario, why it
   matters, and the options you see - PM and QA mostly cannot open GitHub.
   Show the draft, then ask with a question card how to get the answers:
   - **"Post to Jira for the PM"** - step 7.
   - **"Discuss now"** - the PM is at hand, or the user is the PM (they wrote
     the PRD or opened the ticket; then mark this option recommended). Go
     through the questions here, one at a time; record each answer and who gave
     it, post nothing, and carry on with stage 3 - no waiting.
   - **"Go on with assumptions"** - as in the note under step 7.
7. **Pause.** Write the findings and the questions into the record, set status
   `waiting-for-pm`, and commit the record (that file only; do not push).
   Then post it - the comment - so a session that ends here leaves a record
   that already says what was asked. The RD resumes in any session once the
   PM answers.
   - The RD may go on before the answers come back when the open questions do
     not change the solution's direction. Mark each such point as an
     assumption in the record.

When the PM has answered (record each answer against its question) or the RD
proceeds on assumptions: set status `designing` and read `design.md` next to
this file.
