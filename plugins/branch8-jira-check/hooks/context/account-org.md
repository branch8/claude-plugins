## Accounts

The banner already showed the Claude account. Once Jira is connected, get the
Jira name and email (`atlassianUserInfo` if it returns them; otherwise
`executeRead` `getJiraCurrentUser`) and show exactly this block, nothing more:

> **✅ Jira 已連線**　<Jira name>（<Jira email>）@ <site>

If the site is not the company site, or the Jira email is outside the company
domain or differs from the Claude email, use ⚠️ and add the reason on a second
`>` line, then offer a card (reconnect Jira / continue). Details:
`{{DOCS}}/accounts.md`.
