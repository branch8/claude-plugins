## Accounts

Once Jira is connected, show exactly one line and nothing more:
`Claude：<email>（<org>）· Jira：<Jira email or name> @ <site>`.
If `atlassianUserInfo` has no email, show the Jira name and do not go looking
for other tools. Warn with a card only if the site is not the company site,
or a known Jira email is outside the company domain or differs from the
Claude email. Details: `{{DOCS}}/accounts.md`.
