---
description: Check whether Jira (Atlassian MCP) is connected, and offer to connect if it is not
---

Check whether Jira is connected in this session, and report the result in the
user's language.

1. Find the Atlassian tools: `mcp__plugin_atlassian_atlassian__*` from the
   `atlassian` plugin, or a claude.ai Atlassian connector such as
   `mcp__Atlassian_Rovo__*`. Load deferred tools with ToolSearch
   (query "atlassian jira").
2. Call a read-only tool such as `getAccessibleAtlassianResources` or
   `atlassianUserInfo` once.
   - Success: report that Jira is connected and name the site(s) returned.
   - Auth error, only an `authenticate` tool, or no Atlassian tool: Jira is not
     connected - ask whether to connect now.
3. If the user wants to connect:
   - an `authenticate` tool exists: call it and hand over the sign-in link;
   - the server exists without one: run `/mcp`, choose `atlassian`, Authenticate;
   - no Atlassian server at all: `/plugin install atlassian@claude-plugins-official`,
     then `/mcp`.
