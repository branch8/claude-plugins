---
description: Check whether Jira (Atlassian MCP) is connected, and offer to connect if it is not
---

Check which accounts this session uses and whether Jira is connected, and
report the result in the user's language.

0. Run `claude auth status` (it honours CLAUDE_CONFIG_DIR, so it reports this
   session's account even under ccs). Compare `orgId` with `BRANCH8_ORG_ID` in
   this plugin's `config.env` (an environment variable of the same name wins).
   If it is not the Branch8 organisation account, say so plainly.

1. Find the Atlassian tools: `mcp__plugin_atlassian_atlassian__*` from the
   `atlassian` plugin, or a claude.ai Atlassian connector such as
   `mcp__Atlassian_Rovo__*`. Load deferred tools with ToolSearch
   (query "atlassian jira").
2. Call a read-only tool such as `getAccessibleAtlassianResources` or
   `atlassianUserInfo` once.
   - Success: get the Jira name and email (`atlassianUserInfo` if it returns
     them, otherwise `executeRead` `getJiraCurrentUser`; never show a bare
     accountId) and report a short block:
     `> **✅ Claude** <email>（<org>）` and `> **✅ Jira** <name>（<email>）@ <site>`.
     Use ⚠️ with the reason for a site other than `BRANCH8_JIRA_SITE`, an email
     outside `BRANCH8_EMAIL_DOMAIN`, or a non-organisation Claude account.
   - Auth error, only an `authenticate` tool, or no Atlassian tool: Jira is not
     connected - ask whether to connect now, with the AskUserQuestion tool.
3. If the user wants to connect:
   - an `authenticate` tool exists: call it and hand over the sign-in link;
   - the server exists without one: run `/mcp`, choose `atlassian`, Authenticate;
   - no Atlassian server at all: `/plugin install atlassian@claude-plugins-official`,
     then `/mcp`.
