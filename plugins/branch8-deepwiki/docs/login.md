<!-- Read on demand from the branch8-deepwiki session context and /deepwiki-login.
     "<helper>" is bin/branch8-deepwiki in this plugin. -->

# Devin (organisation DeepWiki) sign-in

Most people never open `/mcp` on their own, so you check, show the status, and
offer sign-in when a task needs it. Write every message and card in the
user's language.

## 1. Is `devin` signed in?

ToolSearch with query "devin" (it waits for servers still connecting), and look
at the tools of the `devin` server (`mcp__plugin_branch8-deepwiki_devin__*`):

| What exists | Meaning |
|---|---|
| Wiki tools (`ask_question` / `ask_wiki_question`, `read_wiki_structure`, ...) | Signed in |
| Only `authenticate` (and `complete_authentication`) | Not signed in |
| No `devin` tool at all | Server disabled or failed to connect |

A wiki call that fails with 401 / unauthorized also means not signed in.

## 2. First turn: show one status line, do not ask

On the first message of a session, check once and show exactly one line,
then do the user's request:

- Signed in: `> **✅ Devin DeepWiki 已登入**`
- Not signed in: `> **⚪ Devin DeepWiki 未登入**　需要查公司專案的 wiki 時我會引導你登入，也可以隨時輸入 /deepwiki-login`
- No `devin` tool: `> **⚠️ Devin DeepWiki 未連線**　（MCP server 沒有啟動，可在 /mcp 查看）`

No question card here.

## 3. When a task needs it and `devin` is not signed in: ask with a card

Only when you are about to consult an organisation repo's wiki (or the user asks
to). Use AskUserQuestion, never a plain sentence. Ask at most once per session;
after a "not now", carry on without the wiki.

Question, e.g. 「這個問題可以查公司的 DeepWiki（Devin），但你還沒登入。要現在登入嗎？」

Options:
1. **現在登入（推薦）** - sign in with your Devin account in the browser
2. **我沒有 Devin 帳號** - shows who to ask for one; will not ask again
3. **這次先不要** - continue without it

## 4. Act on the answer

**Sign in now**
1. Call the `devin` server's `authenticate` tool. Give the user the URL it
   returns as a link and say: sign in with your Devin account in the browser,
   then come back.
2. Claude Code normally receives the browser callback by itself. Run
   ToolSearch "devin" again: wiki tools now present -> confirm in one line
   (`> **✅ Devin DeepWiki 已登入**`) and continue the task with the wiki.
3. If the browser ended on an error page at a `localhost` address (common on
   WSL, SSH or remote machines), ask the user to paste the full URL from the
   address bar, then call `complete_authentication` with it.
4. Still failing: tell them to run `/mcp`, choose **devin**, then
   **Authenticate**. If the Devin page says they have no access or no
   account, treat it as "no Devin account" below.

**No Devin account**
1. Run `bash "<helper>" no-account` so later sessions neither show the status
   nor ask.
2. Run `bash "<helper>" config` for the admin contact and tell the user:
   「請向 <admin> 申請 Devin 帳號（加入 Branch8 的 Devin 組織）。拿到帳號後輸入
   `/deepwiki-login` 就能登入。」 Public open-source repos still work through
   `deepwiki` meanwhile.

**Not now**
Continue the task without the organisation wiki. Do not ask again this session.

Never block or delay the user's actual request on any of this.
