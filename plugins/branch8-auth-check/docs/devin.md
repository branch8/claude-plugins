<!-- Devin DeepWiki sign-in steps (branch8-auth-check). -->

# Devin DeepWiki (`devin` MCP, from branch8-deepwiki)

The organisation's repositories are indexed in Devin's DeepWiki. Signing in uses
the person's own Devin account (OAuth); no API key.

1. Call the `devin` server's `authenticate` tool. Give the user the URL it
   returns as a link: sign in with your Devin account in the browser, then come
   back. ToolSearch "devin" again - wiki tools now present = done.
2. The browser ended on an error page at a `localhost` address (common on WSL,
   SSH or remote machines): ask for the full URL from the address bar and call
   `complete_authentication` with it.
3. Still failing: `/mcp` -> **devin** -> **Authenticate**.
4. The Devin page says they have no access or no account: "no account"
   (`card.md`).

Without Devin, public open-source repos still work through the `deepwiki` server.
