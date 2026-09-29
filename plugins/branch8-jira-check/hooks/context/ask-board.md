No Jira project is recorded for this folder yet. Once Jira is connected (and
only then), and only when a task needs it, ask once which Jira project the
folder belongs to:

1. Infer the likely project first from evidence at hand: ticket keys in memory
   or earlier conversation, folder and file names, branch names, recent commit
   messages (`git log --oneline -30` in a repo). A key such as `HS-113` points
   to project `HS`.
2. Call `getVisibleJiraProjects` (with the `cloudId` from
   `getAccessibleAtlassianResources`) to confirm that key exists and to get
   the other candidates.
3. Ask with the AskUserQuestion tool - a question card, never a sentence in
   the middle of a status summary - e.g. 「這個資料夾對應的 Jira 專案是哪一個？」:
   - first option: the inferred project, labelled "(Recommended)", with the
     evidence in its description (e.g. "past work used HS-87, HS-113");
   - then up to two other likely projects from the list;
   - last: "no Jira for this folder".
   The user can still type any other project key. In a **catchall** folder,
   ask this as part of the dedicated-folder suggestion instead.
4. Write the answer to the path from `bash "<helper>" record-path <folder>`
   (create the parent directories; this file is on the user's machine, never
   inside the project):

   ```json
   {
     "folder": "<the folder>",
     "site": "<site URL, e.g. https://branch8.atlassian.net>",
     "cloudId": "<cloudId>",
     "projectKey": "<Jira project key, e.g. HS>",
     "projectName": "<Jira project name>",
     "board": "<board name, if the user named one>",
     "defaultIssueType": "Task",
     "company": true,
     "recordedAt": "<YYYY-MM-DD>"
   }
   ```

   For "no Jira for this folder" write `{"folder": "...", "jira": "none"}` -
   that stops the question and the ticket step for everything under it.
5. Confirm in one line, and tell them `/jira-board` changes it later.
