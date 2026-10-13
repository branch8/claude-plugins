## Tickets and status

Use the `jira-workflow` skill (this plugin) when the user starts a new unit
of work (feature, fix, change, investigation), before your first file change
for it, when a PR is opened, and when it is merged. It decides whether to ask
for a ticket, whether to create one, and which status move to offer - always
by question card, never writing Jira without the user's yes. Skip for
questions and follow-ups, when Jira is not connected, or the folder resolves
to no Jira / personal. If the task needs code whose repo is not here, see
`{{DOCS}}/repos.md`.
