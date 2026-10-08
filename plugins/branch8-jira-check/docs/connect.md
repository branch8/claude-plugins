<!-- Read on demand from the branch8-jira-check session context. "<helper>" is
     bin/branch8-jira in this plugin; its `config` prints the workspace root,
     the config-issue label, the company Jira site and email domain. -->

## Step 1 - is Jira connected?

MCP servers are still connecting when this hook runs, so the hook cannot tell
whether Jira is reachable. Check once, on your first turn of this session,
before or alongside whatever the user asked for.

1. Find the Atlassian tools. They come from the `atlassian` plugin
   (`mcp__plugin_atlassian_atlassian__*`) or a claude.ai Atlassian connector
   (for example `mcp__Atlassian_Rovo__*`). If they are deferred, load them with
   ToolSearch (query "atlassian jira"); it waits for servers still connecting.
2. If a read-only tool such as `getAccessibleAtlassianResources` or
   `atlassianUserInfo` exists, call it once.
   - It succeeds: Jira is connected. Do not announce it on its own (Step 0
     shows the account line where one is required). Carry on.
   - It fails with an auth error, only an `authenticate` tool exists for the
     server, or no Atlassian tool exists at all: Jira is NOT connected.
3. When Jira is not connected, ask whether they want to connect now, e.g.
   「目前沒有連上 Jira，要現在連線嗎？」, in the user's language (Facts above). Ask with the AskUserQuestion tool (a
   question card), never as a sentence inside a longer reply - plain-text
   questions get skipped over. Options: connect now / not this session. Then:
   - Yes, and an `authenticate` tool exists: call it and give the user the
     sign-in link it returns.
   - Yes, the server exists but has no such tool: tell them to run `/mcp`,
     choose `atlassian`, then Authenticate, and finish the browser sign-in.
   - Yes, but no Atlassian server is installed at all: tell them to run
     `/plugin install atlassian@claude-plugins-official`, then `/mcp`.
   - No: accept it, do not ask again this session, and mention they can run
     `/jira-check` any time later. Skip the board and ticket steps below for
     this session.

Never block or delay the user's actual request on this, and never ask when
Jira is already connected.
