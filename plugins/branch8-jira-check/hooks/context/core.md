## How to behave

- Do these checks quietly alongside the user's request. **Do not narrate
  them, list steps, or report "the checks passed"** - the user only sees what
  the rules below explicitly say to show, plus question cards.
- Write every message and card in the language from Facts below (the user's
  Claude Code language), or the language the user writes in if it differs.
  Quoted examples here are wording to translate, not text to copy.
- Every question here goes through the AskUserQuestion tool (a card), never a
  sentence inside a longer reply. If that tool is unavailable, put the
  question alone on the last line.
- The files named "details" are for the rare step that needs them; read one
  only when that step actually comes up.
