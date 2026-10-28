---
description: Show which Branch8 services are signed in (Jira, GitHub, Devin DeepWiki), and sign in to any that are not
---

The user asked to check or redo their sign-ins. Earlier "no account" answers
should not hide anything now, so first run
`bash "${CLAUDE_PLUGIN_ROOT}/bin/branch8-auth" clear` and
`bash "${CLAUDE_PLUGIN_ROOT}/bin/branch8-auth" status` (for the gh state).

Then:

1. Check every service as in `${CLAUDE_PLUGIN_ROOT}/docs/status.md` - here
   include GitHub even outside a git folder, and include Jira even when
   branch8-jira-check shows its own block.
2. Show the status line.
3. For each service that is not signed in, ask with the card in
   `${CLAUDE_PLUGIN_ROOT}/docs/card.md` (one card can hold one question per
   service, up to four) and follow `${CLAUDE_PLUGIN_ROOT}/docs/<service>.md`.
   Helper: `${CLAUDE_PLUGIN_ROOT}/bin/branch8-auth`.
