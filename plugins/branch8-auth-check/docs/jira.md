<!-- Jira sign-in steps (branch8-auth-check). -->

# Jira (Atlassian MCP)

Tools come from the official `atlassian` plugin (`mcp__plugin_atlassian_atlassian__*`)
or a claude.ai Atlassian connector (named `claude_ai_Atlassian*` or by a UUID).
Either one signed in is enough.

1. An `authenticate` tool exists for the Atlassian server: call it and give the
   user the sign-in link it returns. They sign in with their @branch8.com
   Atlassian account in the browser; Claude Code picks up the callback.
   ToolSearch "atlassian jira" again - working tools now present = done.
2. No `authenticate` tool (Claude Desktop, and wherever the session does not
   offer it): run `bash "<helper>" login jira` **in the background**
   (it waits up to 5 minutes for the browser). Details in `mcp-login.md`.
3. The browser ended on an error page at a `localhost` address (common on SSH
   or remote machines): ask for the full URL from the address bar and call
   `complete_authentication` with it, if that tool exists.
4. The steps above fail: tell them to run `/mcp`, choose `atlassian`, then
   **Authenticate**.
5. No Atlassian server at all (`server jira` exits 4):
   `/plugin install atlassian@claude-plugins-official`, then step 1.

After sign-in, branch8-jira-check (if present) shows the Jira account block and
continues its own steps.
