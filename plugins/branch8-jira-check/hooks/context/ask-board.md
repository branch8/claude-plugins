No Jira board is recorded for this project yet. Once Jira is connected (and
only then), ask the user once which Jira project/board this project uses:

1. Call `getVisibleJiraProjects` (with the `cloudId` from
   `getAccessibleAtlassianResources`) and offer the likely matches as choices
   via AskUserQuestion, e.g. 「這個專案對應的 Jira 板是哪一個？」. Include an
   option for "this project does not use Jira".
2. Write the answer to the mapping file path above (create the parent
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
3. Confirm in one line, and tell them `/jira-board` changes it later.
