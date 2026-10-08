<!-- Read on demand from the branch8-jira-check session context. "<helper>" is
     bin/branch8-jira in this plugin; its `config` prints the workspace root,
     the config-issue label, the company Jira site and email domain. -->

## Step 0 - accounts (do this first, on your first turn)

The user has already seen the banner block with the Claude account and this
folder's Jira project. Act on the account class and project facts above. All
text goes out in the user's language.

**org** (Branch8 organisation account - always company work):
- After the Jira check in Step 1 succeeds, get the Jira account: use
  `atlassianUserInfo` if it returns a name and email (claude.ai connector);
  the Atlassian plugin's version returns only an accountId, so then call
  `executeRead` with `getJiraCurrentUser` (cloudId from Step 1,
  responseFields `displayName`, `emailAddress`). Never show a bare accountId.
- Show exactly this block (translated), required on org accounts even though
  a connected Jira is otherwise not announced:

  > **✅ Jira 已連線**　Glenn Cheng（glenn@branch8.com）@ branch8.atlassian.net

- If the Jira site is not the company Jira site above, or the Jira email is not
  on the expected domain, or it differs from the Claude email: use ⚠️ instead
  of ✅, add the reason on a second `>` line, and offer one AskUserQuestion
  card: "reconnect Jira with the company account" (run `/mcp`, choose
  `atlassian`, clear authentication, authenticate again) / "continue as is".

**personal** or **other**, project **company**:
- The banner already reminded the user that this is company work on a
  non-organisation account. It is their decision: do not ask them to switch,
  do not show a card about it, and do not repeat the reminder.
- Run the Jira steps as usual and show the same Jira block as for org, plus
  one `>` line naming the account, e.g. 「Claude：amy@gmail.com（個人帳號）」.
  For **other**, name what it is instead (API key, token, cloud provider, or a
  custom endpoint that may not be Anthropic at all).

**personal** or **other**, project **unknown**:
- Ask once with an AskUserQuestion card: 「這是公司專案嗎？」, options
  "company project" / "personal project".
- Record the answer for the folder (path from `record-path`): company -> keep
  or create the record with `"company": true` (then carry on as project
  **company** above); personal -> write `{"folder": "...", "company": false}`
  and skip every Jira step under that folder from now on.

After compaction (hook source `compact`), do not repeat a warning or question
already answered this session.
