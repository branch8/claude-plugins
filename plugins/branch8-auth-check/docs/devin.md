<!-- Devin DeepWiki sign-in steps (branch8-auth-check). -->

# Devin DeepWiki (`devin` MCP, from branch8-deepwiki)

The organisation's repositories are indexed in Devin's DeepWiki. The `devin`
server signs in with the person's own **personal access token**, read from two
environment variables in their settings.json: `DEVIN_API_KEY` (the token) and
`DEVIN_ORG_ID` (Branch8's Devin organisation id - a personal token needs it).

Do not start the OAuth flow (`authenticate` / `login devin`): Devin answers
"Claude Code isn't available yet ... use a personal access token instead" for
every account, including the Branch8 Teams one (2026-11-06).

## Set-up (the user pastes the token; you write the settings)

Company decision (2026-11-06): the user may paste this token into the chat, so
set-up is one paste. It is the only token you accept this way.

1. Tell them, in their language, roughly:
   「到 Devin（https://app.devin.ai）→ 帳號設定 → 建立 Personal Access Token
   （`cog_` 開頭），複製後直接貼給我，我幫你設定。token 跟密碼一樣，別貼到其他地方。」
2. When they paste it: run `bash "<helper>" config` for `settings_file` and
   `devin_org_id`. If `devin_org_id` is "not set", also ask for the
   organisation id (top of **Settings > Devin API** in Devin, Branch8 org).
3. Write both into the `env` block of `settings_file` (create the block or the
   file if missing; keep everything else; replace old values):
   `"DEVIN_API_KEY": "<token>"`, `"DEVIN_ORG_ID": "<org id>"`. Never repeat the
   token back in your reply, and do not show the edited lines. If the file is
   a symbolic link (ccs links each account's settings.json), edit its target.
4. Run `bash "<helper>" check devin` (it reads the file when this session does
   not have the variables yet):
   - `ok` -> 「✅ Devin 已設定好，開新 session 後就能查公司 repo 的 wiki」
     (the MCP reads the token at start-up, so this session cannot use it yet).
   - `rejected` -> token copied wrong, expired, or wrong org id: ask them to
     re-create / re-copy; repeat from step 2.
   - `unknown` -> could not reach Devin; say so and suggest trying again later.

## Later problems

- **Status shows only `authenticate` though the variables are set**: they did
  not reach Claude Code (another config folder, or set only in a shell
  profile). Re-run set-up so they land in `settings_file`.
- **"Devin token check" says REJECTED, or calls fail** (401 / "Error fetching
  available repositories"): a bad token still connects and lists the tools, so
  only a real call tells. Run `check devin` once more (a Devin outage looks the
  same); still rejected -> set-up again with a new token.
- **The Devin page says they have no access or no account**: "no account"
  (`card.md`).

Without Devin, public open-source repos still work through the `deepwiki` server.
