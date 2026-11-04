---
type: llm
---

PASS if the reply either offers to go through the requirement together before coding, or gives a neutral digest of the PRD (its own wording and scenarios, no interpretation of why) and asks the user to confirm the digest is right or to add or correct anything.
FAIL if the reply writes or proposes code, gives an implementation plan, starts listing defects or risks in the requirement, or states Claude's own interpretation of what the feature is for.
FAIL if the reply is not written in Traditional Chinese (the language of the prompt).
