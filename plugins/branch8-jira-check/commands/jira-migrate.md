---
description: Move this work into a dedicated folder for its Jira project, bringing the related files along
---

Move the current work into a per-project folder now, rather than waiting for
a task. Read and follow, in order:

1. `${CLAUDE_PLUGIN_ROOT}/docs/folders.md` - "Suggest a dedicated folder"
2. `${CLAUDE_PLUGIN_ROOT}/docs/migrate.md`

Get the Jira project from `bash "${CLAUDE_PLUGIN_ROOT}/bin/branch8-jira" lookup .`
(if none, ask as in `${CLAUDE_PLUGIN_ROOT}/docs/board.md`), and the workspace
root and record paths from the same helper (`config`, `record-path`). End with
the `/cd <new folder>` line for the user to type.
