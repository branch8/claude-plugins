---
description: Move this work into a dedicated folder for its Jira project, bringing the related files along
---

Follow the "Suggest a dedicated folder" and "Migrate" sections of this
session's Branch8 Jira context, starting now rather than waiting for a task.

1. Work out the Jira project (record from `lookup`, otherwise ask as in the
   board question) and the target folder `<workspace root>/<PROJECT KEY>`
   (`bash "<helper>" config` shows the workspace root).
2. Create the folder and write its record (`record-path`).
3. Offer the files to bring along, copy the chosen ones, verify, and only then
   ask about deleting the originals.
4. End with the `/cd <new folder>` line for the user to type.

If the session context is missing (plugin hook did not run), run
`bash "${CLAUDE_PLUGIN_ROOT}/bin/branch8-jira" config` to get the paths.
