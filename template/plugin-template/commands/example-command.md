---
description: REPLACE THIS. One line shown in the slash-command list.
---

Write the prompt that runs when someone types `/example-command`.

This file *is* the prompt - it is injected as a user message, so address Claude
directly and be specific about the expected output.

A command usually does one of two things:

1. Gathers context, then hands off to a skill:
   "Run `git diff HEAD`, then apply the `example-skill` skill."
2. Performs a small fixed task on its own, with no skill involved.

Arguments the user types after the command name are appended to this text, so
say how to interpret them - for example: "Treat any argument as the target path;
if none is given, use the current directory."
