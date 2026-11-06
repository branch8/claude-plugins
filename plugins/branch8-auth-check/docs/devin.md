<!-- Devin DeepWiki sign-in steps (branch8-auth-check). -->

# Devin DeepWiki (`devin` MCP, from branch8-deepwiki)

The organisation's repositories are indexed in Devin's DeepWiki. The `devin`
server signs in with the person's own **personal access token**, read from two
environment variables: `DEVIN_API_KEY` (the token) and `DEVIN_ORG_ID` (the
Devin organisation id - a personal token needs it).

Do not start the OAuth flow (`authenticate` / `login devin`): Devin answers
"Claude Code isn't available yet ... use a personal access token instead" for
every account, including the Branch8 Teams one (2026-11-06).

Check the "DEVIN_API_KEY" and "DEVIN_ORG_ID" facts first:

1. **Either is not set**: the user does it themselves - never ask them to paste
   the token into the chat.
   1. In Devin (https://app.devin.ai), account settings: create a personal
      access token (it starts with `cog_`).
   2. The organisation id is at the top of **Settings > Devin API** in Devin
      (the Branch8 organisation).
   3. Add both to the `env` block of their own `~/.claude/settings.json`
      (with CCS or another `CLAUDE_CONFIG_DIR`, that folder's settings.json):

          "env": { "DEVIN_API_KEY": "cog_...", "DEVIN_ORG_ID": "..." }

   4. Start a new Claude Code session (MCP headers are read at start-up).
      ToolSearch "devin" - wiki tools present = done.
2. **Both set, but `devin` shows only `authenticate`**: the server got an empty
   token - the variables did not reach Claude Code (set in a shell profile that
   this app does not read, or a different config folder). Move them to the
   settings.json `env` block, as above.
3. **Both set, wiki tools present, but calls fail** (401 / unauthorized / not
   found for an org repo): the token is wrong, expired, or the organisation id
   is not Branch8's - the server accepts a bad token at connect time and only
   fails on the call. Re-create the token, re-check the id, new session.
4. **The Devin page says they have no access or no account**: "no account"
   (`card.md`).

Without Devin, public open-source repos still work through the `deepwiki` server.
