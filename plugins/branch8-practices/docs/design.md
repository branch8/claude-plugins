# Stage 3: Design the solution

Record status: `designing`.

The requirement is settled; now the RD decides how to build it. Your job is to
widen what they consider and stress-test what they choose - not to choose.

1. **Ask the RD first** which approach they lean to, or whether they have none
   yet. Wait.
2. **Brainstorm** with `superpowers:brainstorming`, every time - the RD may not
   know how to solve it, or their first idea may not be the best. Before
   invoking it, hand over the stage 1-2 conclusions (purpose, scenarios, PM
   answers, assumptions) so it skips "what do you want to build". Lay out 2-3
   approaches, each with its trade-offs: complexity, flexibility, risk, fit with
   the existing architecture.
   - Its written design goes into the record's Solution section, not a separate
     file under `docs/superpowers/specs/`.
   - It ends with a list of the calls it made itself; the RD confirms or changes
     each one, and the record keeps the result.
   - Inside this flow it never builds or hands off: skip its opening offer to
     skip the questions, and however it ends - everything already known, sized
     as a small change, or design approved - come back here to step 3.
3. **The RD picks** an approach and says why. Quote their reason in the record.
4. **Stress-test the choice** with `mattpocock-skills:grilling` (RD answers
   first in every round) together with `mattpocock-skills:domain-modeling`:
   probe it with concrete scenarios, check the RD's claims against the code,
   sharpen fuzzy terms. Where a decision is hard to reverse, surprising
   without context, and the result of a real trade-off, domain-modeling
   writes an ADR; the record links it instead of copying it.
5. **Approve.** Only now - after grilling and domain-modeling - show the RD the
   Solution section for approval.

Approval leads to wrap-up, not writing-plans: read `wrap-up.md` next to this
file. `superpowers:writing-plans` comes only at its last step.
