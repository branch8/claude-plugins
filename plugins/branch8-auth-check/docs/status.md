<!-- Read on the first turn of a session (branch8-auth-check). -->

# First-turn status line

Check once, then show **one** line, in the user's language. No card (except the
Jira case below). Do not narrate the check.

## How to tell each service's state

| Service | Signed in | Not signed in |
|---|---|---|
| jira | ToolSearch "atlassian jira" finds working tools (`atlassianUserInfo`, `getAccessibleAtlassianResources`, ...) | only an `authenticate` tool, or no Atlassian tool at all |
| devin | ToolSearch "devin" finds wiki tools (`ask_question` / `ask_wiki_question`, `read_wiki_structure`, ...) | only an `authenticate` tool |
| github | the "gh" fact says signed in | the fact says NOT signed in / NOT installed |

Gemini is never in the status line.

## Format

    > **登入狀態**　✅ Jira　✅ GitHub（<gh account>）　⚪ Devin DeepWiki

- ✅ signed in, ⚪ not signed in. If any item is ⚪, end the line with
  「（需要時我會引導登入，或輸入 /auth-check）」.
- Leave out: **github** when the fact says it is not a git folder; any service
  under "no account"; **devin** if there is no `devin` server at all (the
  branch8-deepwiki plugin is not installed); **jira** if there is no
  Atlassian server at all and branch8-jira-check is not in this session.
- If branch8-jira-check is in this session, it shows its own Jira account
  block (name, email, site). Then leave Jira out of this line when it is
  connected, so it is not shown twice.

## Jira exception: ask right away

Jira tracks every task, so when Jira is not signed in **and**
branch8-jira-check is in this session **and** this folder is company work -
mapped to a Jira project *or not yet mapped* - ask the Jira card now (`card.md`,
sign-in steps in `jira.md`). Only "no Jira for this folder" and personal
projects wait until a task needs Jira, like every other service.

Why "not yet mapped" counts: jira-check asks which Jira project a folder belongs
to only once Jira is connected, and its jira-workflow skill skips tickets while
Jira is not connected - so waiting would mean nobody asks at all.
