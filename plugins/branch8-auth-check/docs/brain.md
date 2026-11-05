<!-- Branch8 Brain sign-in steps (branch8-auth-check). -->

# Branch8 Brain (`branch8-brain` MCP, from the branch8-brain plugin)

Read-only search over Branch8's Jira, repos and GitHub issues / PRs. Everyone at
Branch8 may use it; sign-in is the company Google account (@branch8.com only).
One sign-in per computer.

1. Call the `branch8-brain` server's `authenticate` tool and give the user the
   link it returns. Tell them: 「用公司 Google 帳號（@branch8.com）登入，看到
   "Connect Claude to Branch8 Brain" 後按 **Connect**。」
2. The browser then returns to Claude Code. ToolSearch "branch8-brain" again -
   `query` / `search` present = done.
3. The link ends on an error page at a `localhost` address (session restarted,
   SSH or remote machine): ask for the full URL from the address bar and call
   `complete_authentication` with it, if that tool exists.
4. No `authenticate` tool: run `bash "<helper>" login brain` **in the
   background**, as in `mcp-login.md`; the `url:` it prints leads to the same
   Google sign-in.
5. The page says **"This request has expired"** (more than 10 minutes): start
   over from step 1.
6. Google refuses the account, or the page says **"Branch8 accounts only"**:
   they signed in with a personal Google account. Start over and pick the
   @branch8.com one.
7. Still failing: `/mcp` -> **plugin:branch8-brain:branch8-brain** ->
   **Authenticate**. If that fails too, or the page shows **"Almost connected"**
   with a code (a client the brain does not know), tell them to contact
   `brain_owner` (`bash "<helper>" config`).
8. No `branch8-brain` server at all (`server brain` exits 4):
   `/plugin install branch8-brain@branch8`, then step 1.
