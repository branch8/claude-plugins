---
description: Show or change which Jira project this folder is recorded against
---

The branch8-jira-check plugin records which Jira project a folder belongs to,
in a local file on this machine; a folder inherits the nearest record above
it. Always get paths from the helper, never build them by hand:

    bash "${CLAUDE_PLUGIN_ROOT}/bin/branch8-jira" lookup <folder>
    bash "${CLAUDE_PLUGIN_ROOT}/bin/branch8-jira" record-path <folder>

1. Run `lookup` for the current folder (the repo root when inside a git repo)
   and show the record in effect and which folder it was recorded for, or say
   none is recorded.
2. Make sure Jira is connected (see `/jira-check`), infer the likely project
   from ticket keys in folder and file names, branch names, commit messages
   and earlier work, then call `getVisibleJiraProjects` and ask with the
   AskUserQuestion tool which project to use: the inferred one first as
   "(Recommended)" with its evidence, up to two other candidates, and
   "no Jira for this folder". Also ask whether it applies to this folder only
   or to the parent that currently holds the record.
3. Write the file from `record-path` for the chosen folder with the fields
   `folder`, `site`, `cloudId`, `projectKey`, `projectName`, `board`,
   `defaultIssueType`, `company`, `recordedAt` - or
   `{"folder": "...", "jira": "none"}`.
4. Confirm the change in one line.
