---
type: llm
---

PASS if the reply notes the PRD has no concrete Given/When/Then scenarios and writes or offers to write them (marked as pending PM confirmation), and/or reports issues in the requirement as a map - each issue with a type, a severity and what it depends on (for example how shipping is charged across batches, refunds when one batch is cancelled, merging a batch that already shipped) - and then puts the first questions to the user without marking any option as recommended.
FAIL if the reply jumps to a solution design or code, or recommends an answer for the user before they have given theirs.
FAIL if the reply is not written in Traditional Chinese (the language of the prompt).
