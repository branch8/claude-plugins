---
name: pr-review
description: Review a pull request against our internal engineering conventions and produce comments using our severity rubric. Use this whenever the user asks to review a PR, review a diff, look over changes before merging, or asks "does this look OK to ship" - even if they do not say the word "review".
---

# PR Review

Apply the house rubric below instead of generic review advice. The point of this
skill is that two reviewers on different teams reach the same verdict on the same diff.

## Severity rubric

Every comment gets exactly one label. Do not invent new ones.

| Label | Meaning | Blocks merge |
|---|---|---|
| `blocking` | Correctness bug, data loss, security issue, or breaking API change | Yes |
| `should-fix` | Real problem, but shipping it is recoverable | Author decides |
| `nit` | Style or taste. Author may ignore without replying | No |
| `question` | Reviewer does not understand something yet | No |

If you cannot decide between `blocking` and `should-fix`, ask whether a rollback
would be needed. If yes, it is `blocking`.

## Review order

Work through these in order and stop early only if something `blocking` appears:

1. **Does it do what the PR description says?** Mismatches between the description
   and the diff are `blocking` - reviewers downstream trust the description.
2. **Failure modes.** What happens on network error, empty input, concurrent calls?
3. **Data and migrations.** Any schema change without a rollback path is `blocking`.
4. **Tests.** New behaviour without a test that fails before the change is `should-fix`.
5. **Readability.** Only after the above.

## Comment format

    [severity] path/to/file.ts:42
    <one sentence on what is wrong>
    <one sentence on why it matters, or the concrete fix>

Keep it to two sentences. Long review comments get skimmed.

## What not to do

- Do not comment on formatting the linter already handles.
- Do not suggest a refactor that is out of scope for the PR; open a follow-up issue.
- Do not approve with unresolved `blocking` comments.
