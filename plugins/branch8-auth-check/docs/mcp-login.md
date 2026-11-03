<!-- Signing in to an MCP server without an `authenticate` tool (branch8-auth-check). -->

# `branch8-auth login <service>`

For jira and devin. It runs `claude mcp login` on the server of that service
(official plugin first, then a claude.ai connector) under a pseudo-terminal,
and opens the sign-in page itself on WSL, where Claude Code cannot.

Run it in the background; read its output once for the `url:` line and give the
user that link in case no browser opened: 「瀏覽器開了 <服務> 的授權頁，按同意即可。
沒開的話點這裡：<url>」. Then wait for it to finish.

| Result | Then |
|---|---|
| exit 0, `Authenticated with ...` | 「✅ <服務> 已登入」, and: the tools reach this session only after `/mcp` -> the server -> **Reconnect**, or in a new session (2026-11-03: not picked up by the running session) |
| exit 3 (already connected) | the server is signed in for Claude Code; if this session still lacks its tools, same advice as above |
| exit 4 (no server) | the service's plugin is not installed (see `<service>.md`) |
| exit 5 (no `claude` CLI or no `script`) | fall back to `/mcp` |
| anything else, or timed out | fall back to `/mcp` |

Never ask the user to paste a token; the redirect URL (localhost) is fine.
