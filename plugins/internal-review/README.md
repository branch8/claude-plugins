# internal-review

House PR review conventions, packaged so every engineer's Claude reviews the same way.

- `skills/pr-review` - the severity rubric and review order
- `commands/review.md` - `/internal-review:review` runs it on the current diff
- `.mcp.json` - internal docs MCP server, bundled so nobody configures it by hand

Bump `version` in `.claude-plugin/plugin.json` on every change. Organization
auto-sync only fires when a merged PR contains a version bump.
