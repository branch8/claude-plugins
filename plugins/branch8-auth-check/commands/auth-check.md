---
description: Show which Branch8 services are signed in (Jira, GitHub, Devin DeepWiki), and sign in to any that are not. `/auth-check jira` checks only Jira.
argument-hint: "[jira|github|devin|gemini ...]"
---

Services named after the command: `$ARGUMENTS`

The user asked to check or redo their sign-ins. Helper:
`bash "${CLAUDE_PLUGIN_ROOT}/bin/branch8-auth"`.

**Which services**: none named - every service. Otherwise only the named ones;
turn each word into a service with `branch8-auth service <word>` (aliases:
atlassian, gh, deepwiki). An unknown word: say which names are valid and go on
with the known ones. Leave every other service out of the line and the cards.

Earlier "no account" answers should not hide a service the user asked about, so
run `branch8-auth clear <service>` for each chosen service (`clear` alone when
none was named), then `branch8-auth status` (for the gh state).

Then:

1. Check each chosen service as in `${CLAUDE_PLUGIN_ROOT}/docs/status.md` - here
   include GitHub even outside a git folder, and include Jira even when
   branch8-jira-check shows its own block.
2. Show the status line, with only the chosen services.
3. For each chosen service that is not signed in, ask with the card in
   `${CLAUDE_PLUGIN_ROOT}/docs/card.md` (one card can hold one question per
   service, up to four) and follow `${CLAUDE_PLUGIN_ROOT}/docs/<service>.md`.
   A single service the user named on its own counts as their yes to "sign in
   now": skip the card and go straight to its steps.
