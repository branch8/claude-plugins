No Jira board is recorded for this project yet. Once Jira is connected (and
only then), ask the user once which Jira project/board this project uses:

1. Work out the most likely project first, from evidence already at hand:
   ticket keys in memory or earlier conversation, branch names, recent commit
   messages (`git log --oneline -30`), PR titles. A key such as `HS-113`
   points to project `HS`.
2. Call `getVisibleJiraProjects` (with the `cloudId` from
   `getAccessibleAtlassianResources`) to confirm that key exists and to get
   the other candidates.
3. Ask with the AskUserQuestion tool - a question card, never a sentence in
   the middle of a status summary - e.g. 「這個專案對應的 Jira 板是哪一個？」:
   - first option: the inferred project, labelled "(Recommended)", with the
     evidence in its description (e.g. "past work used HS-87, HS-113");
   - then up to two other likely projects from the list;
   - last: "this project does not use Jira".
   The user can still type any other project key.
4. Write the answer to the mapping file path above (create the parent
   directories; this file is on the user's machine, never inside the project):

   ```json
   {
     "projectDir": "<project directory above>",
     "site": "<site URL, e.g. https://branch8.atlassian.net>",
     "cloudId": "<cloudId>",
     "projectKey": "<Jira project key, e.g. WEB>",
     "projectName": "<Jira project name>",
     "board": "<board name, if the user named one>",
     "defaultIssueType": "Task",
     "recordedAt": "<YYYY-MM-DD>"
   }
   ```

   If the project does not use Jira, write `{"projectDir": "...", "jira": "none"}`
   instead - that stops the question and the ticket step below for good.
5. Confirm in one line, and tell them `/jira-board` changes it later.
