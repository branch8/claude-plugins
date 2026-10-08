## Jira connection (first turn, before the task)

Load the Atlassian tools (`mcp__plugin_atlassian_atlassian__*` or a claude.ai
Atlassian connector; ToolSearch "atlassian jira" if deferred) and call
`atlassianUserInfo` or `getAccessibleAtlassianResources` once. Works ->
connected, say nothing by itself. Auth
error / only an `authenticate` tool / no tool -> ask with a card whether to
connect now. Details: `{{DOCS}}/connect.md`. If declined, skip every Jira
step this session.
