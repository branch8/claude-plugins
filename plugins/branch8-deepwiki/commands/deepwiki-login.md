---
description: Check whether the organisation DeepWiki (Devin) is signed in, and sign in if it is not
---

The user asked to check or sign in to Devin's DeepWiki. They may have said
earlier that they had no Devin account, so first run
`bash "${CLAUDE_PLUGIN_ROOT}/bin/branch8-deepwiki" clear`.

Then follow `${CLAUDE_PLUGIN_ROOT}/docs/login.md` (helper:
`${CLAUDE_PLUGIN_ROOT}/bin/branch8-deepwiki`), with one difference: if `devin`
is already signed in, say so in one line (「✅ 已登入 Devin DeepWiki」) instead of
staying silent, and skip the card.
