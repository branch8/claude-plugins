<!-- Read when the session-start facts say a hand-added Devin/DeepWiki MCP was found (branch8-auth-check). -->

# Hand-added Devin / DeepWiki MCP

Claude Code hides a plugin's MCP server when a hand-added one (`claude mcp add`,
a vendor's install snippet) has the same URL - URL variants do not help
(2026-11-06 test). A hand-added `devin` usually has no Branch8 token, so the
company wiki is lost; most people do not know they installed it, or that it
collides. Fix it for them by **moving** it to a personal-account config dir
(nothing is lost), unless they say otherwise. Write in the user's language.

## 1. Confirm

Run `claude mcp list` (slow - once). A duplicate is a server whose URL host is
`mcp.devin.ai` or `mcp.deepwiki.com` and whose name does not start with
`plugin:branch8-deepwiki:`. For each, `claude mcp get <name>` gives its scope.

- None found (the plugin's `devin` / `deepwiki` are listed): nothing to do.
- **Project scope** (`.mcp.json` in the repo, shared with the team): do not
  move or edit it. Tell the user it comes from the repo, and that they can turn
  it off for themselves in `/mcp`; the repo owner should remove it.
- **claude.ai connector** (`claude.ai Devin` / `claude.ai DeepWiki`, or tools
  named `mcp__claude_ai_Devin...`): cannot be moved from here; suggest
  disconnecting it at claude.ai > Settings > Connectors. (Whether a connector
  also hides the plugin's server is not verified.)
- **User or local scope**: continue.

## 2. Ask (one card; one question per duplicate, up to four)

「你另外裝了 `<name>`（<整台電腦都會用 / 只在這個資料夾>），它會擋掉公司的 Devin
wiki。要怎麼處理？」 Options:

1. **搬到個人帳號專用的設定（推薦）** - keeps it for a personal account; the
   company account gets the plugin's back. Step 3.
2. **直接刪除** - `claude mcp remove <name> -s <scope>`.
3. **這次先跳過** - ask again next session.
4. **保留，不要再問** - `bash "<helper>" keep-duplicate`; say the company wiki
   stays hidden in this account, and that `/auth-check devin` checks again
   (it clears this answer).

## 3. Move to the personal config dir

1. Target dir: `bash "<helper>" personal-dir` (default `~/.claude-personal`).
   If `CLAUDE_CONFIG_DIR` points into `~/.ccs/instances/`, they use ccs: ask
   which ccs instance is their personal one and use its folder instead (no
   alias needed - they already switch with ccs).
2. Read the server's definition from `.claude.json` (`bash "<helper>" config`
   has no path for it - it is `$CLAUDE_CONFIG_DIR/.claude.json`, or
   `~/.claude.json` when that is unset): user scope = top-level
   `mcpServers.<name>`, local scope = `projects["<folder>"].mcpServers.<name>`.
   It may carry a token in `headers`: never show or repeat it.
3. Add it there, then remove it here:

       CLAUDE_CONFIG_DIR="<target>" claude mcp add-json -s user <name> '<json>'
       claude mcp remove <name> -s <scope>

   Check with `CLAUDE_CONFIG_DIR="<target>" claude mcp get <name>` before
   removing; if the add failed, stop and leave it in place.
4. Switch command (skip for ccs): add once, if not already there -
   - bash / zsh (`$SHELL`), to `~/.bashrc` or `~/.zshrc`:
     `alias claude-me='CLAUDE_CONFIG_DIR="$HOME/.claude-personal" claude'`
   - Windows PowerShell, to `$PROFILE`:
     `function claude-me { $env:CLAUDE_CONFIG_DIR="$HOME\.claude-personal"; claude @args; Remove-Item Env:CLAUDE_CONFIG_DIR }`
5. Tell them: 公司帳號照常用 `claude`；個人帳號改用 `claude-me`（第一次要
   `/login` 個人帳號，plugin 與設定也要在那邊另外裝）。開新 session 後公司的
   Devin wiki 就會回來。

Afterwards, if the "DEVIN_API_KEY" fact is not set, continue with `devin.md`
set-up.
