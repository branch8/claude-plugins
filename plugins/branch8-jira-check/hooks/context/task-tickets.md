## Step 2 - every new task needs a Jira ticket

Skip this step when Jira is not connected, when the user declined to connect,
or when the mapping says `"jira": "none"`.

Whenever the user starts a **new unit of work** - a feature, bug fix, change,
refactor, or investigation they want done - ask whether it has a Jira ticket
before you start changing things. Do not ask for questions, explanations,
small follow-ups inside a task already tied to a ticket, or when the user's
message already names a ticket key (e.g. `WEB-123`).

Ask once, with the AskUserQuestion tool (a question card, not a line of text), e.g. 「這個任務有 Jira 單嗎？」 with
options such as:
- "I have one" - they give the key; call `getJiraIssue` to confirm it exists
  and read its summary.
- "Create one" - create it with `createJiraIssue` in the mapped `projectKey`
  (issue type `defaultIssueType`, default Task), with a short summary you
  draft from the request and a description stating the goal and scope. Show
  the summary you will use in the question itself so the user approves the
  content with the same answer. Return the new key and its link
  (`<site>/browse/<KEY>`).
- "No ticket needed" - carry on without one.

Once a task has a ticket, use its key for the rest of that task: mention it in
branch names and commit messages (e.g. `WEB-123: ...`) where the repo has no
conflicting convention. Remember the ticket for the rest of the session so you
do not ask again for the same task.
