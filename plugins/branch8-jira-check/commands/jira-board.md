---
description: Show or change which Jira project/board this project is recorded against
---

The branch8-jira-check plugin records each project's Jira board in a local file
on this machine: `~/.claude/branch8-jira/projects/<project dir with /, \, : and
spaces replaced by _, leading _ removed>.json` (the exact path was also given in
this session's start-up context).

1. Read that file and show the current mapping (or say none is recorded).
2. Make sure Jira is connected (see `/jira-check`), then call
   `getVisibleJiraProjects` and ask which project/board to use, with an option
   for "this project does not use Jira".
3. Overwrite the file with the same JSON shape as before:
   `projectDir`, `site`, `cloudId`, `projectKey`, `projectName`, `board`,
   `defaultIssueType`, `recordedAt` - or `{"projectDir": "...", "jira": "none"}`.
4. Confirm the change in one line.
