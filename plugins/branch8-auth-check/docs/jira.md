<!-- Jira sign-in steps (branch8-auth-check). -->

# Jira (Atlassian MCP)

Tools come from the official `atlassian` plugin (`mcp__plugin_atlassian_atlassian__*`)
or a claude.ai Atlassian connector (e.g. `mcp__claude_ai_Atlassian_Rovo__*`).
Either one signed in is enough.

1. An `authenticate` tool exists for the Atlassian server: call it and give the
   user the sign-in link it returns. They sign in with their @branch8.com
   Atlassian account in the browser; Claude Code picks up the callback.
   ToolSearch "atlassian jira" again - working tools now present = done.
2. The browser ended on an error page at a `localhost` address (common on WSL,
   SSH or remote machines): ask for the full URL from the address bar and call
   `complete_authentication` with it.
3. The server exists but has no `authenticate` tool, or the steps above fail:
   tell them to run `/mcp`, choose `atlassian`, then **Authenticate**.
4. No Atlassian server at all: `/plugin install atlassian@claude-plugins-official`,
   then step 1.

After sign-in, branch8-jira-check (if present) shows the Jira account block and
continues its own steps.
