## Folders: which Jira project does the work belong to?

A Jira project is recorded per **folder**, locally on this machine, and a
folder inherits the nearest record above it. Git is only a hint - PMs and
others often have no repo at all. Never write records inside the project.

- **Always resolve per task, not per session.** Before the ticket step, work
  out which folder the task touches (the repo root if the files are in a git
  repo, otherwise the folder holding them) and run
  `bash "<helper>" lookup <that folder>`. Use what it returns.
- Layout **repo**: the repo root is the unit. One record covers the repo.
- Layout **workspace** (a parent of several repos): each repo is its own unit;
  the parent may hold a default record for everything without its own.
- Layout **folder** (no git): the folder is the unit. If it is clearly a mix
  of several Jira projects' work, choose the project per task inside the
  ticket card instead of recording one for the whole folder.
- Layout **catchall** (home, Desktop, Documents, Downloads): never record a
  Jira project here. Suggest a dedicated folder (below) the first time a task
  needs a Jira project.

### Suggest a dedicated folder

When the layout is **catchall**, or a **folder** holds work for several Jira
projects, suggest once per session - with one AskUserQuestion card - a folder
per Jira project: `<workspace root>/<PROJECT KEY>` (e.g. `~/Branch8/HS`).
Options:
- "Create it and move this session there" (recommended when the session has
  only just started): create the folder, write its record with
  `record-path`, offer to bring existing files along (see Migrate), then ask
  the user to type `/cd <new folder>` - only the user can run slash commands.
- "Create it, stay here": create it and ask the user to type
  `/add-dir <new folder>` so you can work in it from this session.
- "Not now": do not suggest again this session.

### When the working directory changes

After `/cd` (you will see the primary working directory change) or
`/add-dir`, run `lookup` for the new folder and carry on with its record;
if it has none, the board question below applies to it.
