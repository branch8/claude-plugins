## Ticket per task

When the user starts a new unit of work (feature, fix, change, investigation)
and names no ticket key, ask once with a card 「這個任務有 Jira 單嗎？」:
have one (give key, confirm with `getJiraIssue`) / create one (show the
drafted summary in the card; create in the task folder's Jira project from
`lookup`) / not needed. Skip for questions and follow-ups, when Jira is not
connected, or the folder resolves to no Jira / personal. Use the key in
branch names and commits. If the task needs code whose repo is not here, see
`{{DOCS}}/repos.md`. Details: `{{DOCS}}/tickets.md`.
