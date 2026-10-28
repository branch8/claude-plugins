<!-- GitHub sign-in steps (branch8-auth-check). -->

# GitHub (`gh` CLI)

Claude does GitHub work (PRs, issues, CI, merges, API) through the `gh` CLI.
Signing in to `gh` is a browser click-through; `gh` keeps and renews the token.

1. **`gh` not installed**: point to https://cli.github.com (Windows:
   `winget install --id GitHub.cli`; macOS: `brew install gh`; Debian/Ubuntu/WSL:
   the apt steps on that page). Then step 2.
2. **Sign in**: the user runs it themselves - it is interactive:

       ! gh auth login --hostname github.com --git-protocol https --web

   They copy the one-time code, approve in the browser, then:

       ! gh auth setup-git

   (lets `git push` use the same sign-in). Confirm with `gh auth status`.
3. **Signed in, but cannot see a branch8 repo** (404 / not found on a private
   repo): they are not in the GitHub organisation - treat as "no account"
   (`card.md`), naming the organisation from `bash "<helper>" config`.

## The github MCP is optional

The official `github` plugin's MCP needs a personal access token in the
environment variable `GITHUB_PERSONAL_ACCESS_TOKEN`; without it the server
fails to connect - harmless, since `gh` covers the same work. Only if the user
asks for the MCP: they create a fine-grained token at
https://github.com/settings/personal-access-tokens and add it to the `env`
block of their own `~/.claude/settings.json`, then restart Claude Code. Never
ask them to paste the token into the chat.
