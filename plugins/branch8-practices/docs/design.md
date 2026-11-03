# Stage 3: Design the solution

Record status: `designing`.

The requirement is settled; now the RD decides how to build it. Your job is to
widen what they consider and stress-test what they choose - not to choose.

1. **Let the RD choose the way**, with a question card. This replaces
   brainstorming's own "want to skip the questions?" line:
   - **"Think it through together"** (recommended): a real brainstorm, one
     question at a time.
   - **"Skip the questions - Give me options"**: you lay out the approaches,
     the RD picks.
   - **"Other"**: the RD types their idea straight into the card; treat it as
     their first idea in "together".
   They can switch at any point. Note the way in the record.
2. **Brainstorm** with `superpowers:brainstorming`, every time - the RD may not
   know how to solve it, or their first idea may not be the best. Before
   invoking it, hand over the stage 1-2 conclusions (purpose, scenarios, PM
   answers, assumptions) so it skips "what do you want to build". Then, in the
   way the RD chose:
   - **Together**: ask for the RD's own idea first ("none yet" is fine). Build
     on it rather than replacing it: "what if ..." questions that push its
     limits (future changes, failure, scale), grounded in what the code already
     has, and your own ideas added alongside. Offer ready-made approaches only
     when the RD is stuck or says "you go first". When ideas settle, put the
     2-3 candidates side by side with their trade-offs and compare them together.
   - **Options**: ask in one line which way the RD leans, then lay out 2-3
     approaches, each with its trade-offs.
   Trade-offs always cover complexity, flexibility, risk, and fit with the
   existing architecture. In both ways:
   - Its written design goes into the record's Solution section, not a separate
     file under `docs/superpowers/specs/`.
   - It ends with a list of the calls it made itself. Calls often depend on
     each other, so present them by dependency, not as a flat list: the root
     calls first (the ones others follow from), each with what hangs off it.
     The RD confirms or changes each root call; the calls that only follow from
     a root are accepted with it, or reopened when the root changes. Calls that
     stand alone are confirmed one by one. The record keeps the result.
   - Inside this flow it never builds or hands off: skip its opening offer to
     skip the questions, and however it ends - everything already known, sized
     as a small change, or design approved - come back here to step 3.
3. **The RD picks** an approach and says why. Quote their reason in the record,
   and note who proposed each idea that was considered.
4. **Stress-test the choice** with `mattpocock-skills:grilling` (RD answers
   first in every round) together with `mattpocock-skills:domain-modeling`:
   probe it with concrete scenarios, check the RD's claims against the code,
   sharpen fuzzy terms. Where a decision is hard to reverse, surprising
   without context, and the result of a real trade-off, domain-modeling
   writes an ADR; the record links it instead of copying it.
   - The choice does not hold up (grilling finds it unworkable): say so, note
     in the record why it was dropped, and go back to step 2 with that lesson.
     Do not patch an approach the RD would not choose again.
5. **Approve.** Only now - after grilling and domain-modeling - show the RD the
   Solution section for approval.

Approval leads to wrap-up, not writing-plans: read `wrap-up.md` next to this
file. `superpowers:writing-plans` comes only at its last step.
