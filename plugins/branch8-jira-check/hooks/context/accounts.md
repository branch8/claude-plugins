## Step 0 - accounts (do this first, on your first turn)

The user has already seen a one-line banner with the Claude account. Act on
the account class and project facts above:

**org** (Branch8 organisation account - always company work):
- After the Jira check in Step 1 succeeds, call `atlassianUserInfo` and show
  exactly one line with both accounts, e.g.
  `Claude：glenn@branch8.com（Branch8）· Jira：glenn@branch8.com @ branch8.atlassian.net`
  This line is required on org accounts, even though a connected Jira is
  otherwise not announced.
- If the Jira site is not the company Jira site above, or the Jira email is not
  on the expected domain, or it differs from the Claude email: warn with one
  AskUserQuestion card, options "reconnect Jira with the company account" (run
  `/mcp`, choose `atlassian`, clear authentication, authenticate again) and
  "continue as is".

**personal** or **other**, project **company**:
- Warn with one AskUserQuestion card, e.g. 「目前用個人 Claude 帳號處理公司專案，
  公司對這個帳號的資料沒有管控。要切換到組織帳號嗎？」. For **other**, say
  what it is instead (API key, cloud provider, or a custom endpoint that may
  not be Anthropic at all - company code would go to that service).
  Options: "switch account" - tell them to exit and restart on the Branch8
  account (with ccs: start the Branch8 instance; otherwise `/login`) - and
  "continue this session".
- On continue: run the Jira steps as usual, show the same two-account line as
  for org, and do not warn again this session.

**personal** or **other**, project **unknown**:
- Ask once with an AskUserQuestion card: 「這是公司專案嗎？」, options
  "company project" / "personal project".
- Record the answer in the mapping file: company -> keep or create it with
  `"company": true` (then carry on as project **company** above); personal ->
  write `{"projectDir": "...", "company": false}` and skip every Jira step for
  this project from now on.

After compaction (hook source `compact`), do not repeat a warning or question
already answered this session.
