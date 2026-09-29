## Which repos belong to a Jira project (config issue)

Each Jira project may have one **config issue**: an issue carrying the config
label above, whose description lists the project's repositories, one per line:

```
repo: https://github.com/branch8/hs-web
repo: https://github.com/branch8/hs-api
```

The mapping is kept in Jira (and not in the plugin's public repository)
because Jira project names often include client names.

- Look it up only when a task needs code for a Jira project and no matching
  repo is present locally: `searchJiraIssuesUsingJql` with
  `project = <KEY> AND labels = <config label>`, then read the description.
- Repo listed but not on this machine: offer with one AskUserQuestion card to
  clone it into the project's folder (`<workspace root>/<KEY>/<repo name>`),
  or to skip.
- No config issue: ask with one card for the repo URL (options: type it / "no
  repo, docs only"). When a URL is given, offer - as a separate card, because
  it writes to Jira for everyone - to create the config issue: summary
  `[Claude] 專案設定`, label as above, description in the format above.
- PMs and other non-developers usually need no repo: never push a clone on a
  task that does not touch code.
