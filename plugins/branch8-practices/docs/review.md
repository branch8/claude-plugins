# Stage 2: Review the requirement

Record status: `reviewing`.

Review the requirement one user scenario at a time: "given a situation, when
the user does something, then they should see a result". The yardstick is
always the purpose agreed in stage 1, not the PRD's wording.

1. **No scenarios in the PRD?** First write them with the RD in
   Given/When/Then, and mark each "written by RD, pending PM confirmation".
   The rest of this stage works on these scenarios.
2. **Ask the RD first:** having read the scenarios, what feels wrong or worries
   them? Wait for the answer.
3. **Then scan every scenario yourself.** This mechanical pass is yours; the RD
   does not have to go line by line. For each scenario look for:
   - **gaps** - edge cases, error paths, permissions, empty or huge inputs;
   - **conflicts** - with another scenario or with existing behaviour in the code;
   - **infeasible parts** - technically impossible, or far costlier than it looks;
   - **a better way** - another approach that reaches the purpose more simply.
   Present the findings; the RD rules on each one (keep, drop, ask the PM).
4. **Grill the requirement** with `mattpocock-skills:grilling`, RD answering
   first in every round, until nothing is left open.
5. **Questions for the PM.** Collect what only the PM can answer into one Jira
   comment. It must stand on its own: for each question, the scenario, why it
   matters, and the options you see - PM and QA mostly cannot open GitHub.
   Show the draft and get the RD's yes on a question card.
6. **Pause.** Write the findings and the questions into the record, set status
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
