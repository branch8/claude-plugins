<!-- Gemini key steps (branch8-auth-check). -->

# Gemini (`GEMINI_API_KEY`)

Only ui-ux-pro-max's image generation (logos, icons, brand mock-ups) needs it.
Everything else in that plugin works without it. Never in the status line;
only when such a task is about to run and the "GEMINI_API_KEY" fact says not set.

"Sign in" here means getting a key:

1. Ask the admin first (`bash "<helper>" config`) - the company may provide one.
2. Otherwise create one at https://aistudio.google.com/apikey with a
   @branch8.com Google account.
3. Put it in the `env` block of their own `~/.claude/settings.json`
   (`"GEMINI_API_KEY": "..."`), then restart Claude Code. Never ask them to
   paste the key into the chat.

Until then, offer what works without it (design direction, palettes, layout,
HTML/SVG mock-ups).
