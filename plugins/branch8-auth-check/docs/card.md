<!-- Read when a task needs a service that is not signed in (branch8-auth-check). -->

# Sign-in card

Ask with AskUserQuestion, never a plain sentence. Ask each time a task needs the
service, until the user picks "stop asking this session" for it. Write in the
user's language.

Question, e.g. 「這個步驟需要 <服務>，但你還沒登入。要現在登入嗎？」 - say in a few
words what you wanted it for.

Options (exactly these four; Jira has no fourth - everyone at Branch8 has one):

1. **現在登入（推薦）** - follow `<service>.md`
2. **這次先跳過** - continue without it; ask again the next time it is needed
3. **此 session 不再詢問** - continue without it for the rest of this session;
   mention once that `/auth-check` signs in any time
4. **我沒有帳號** - `bash "<helper>" no-account <service>`, then
   `bash "<helper>" config` and tell them who to ask:
   「請向 <admin> 申請 <服務> 帳號。拿到後輸入 /auth-check 就能登入。」
   Later sessions neither show nor ask about that service.

Skipping a service never fails the task: do what you can without it and say
what was left out (e.g. "did not check the wiki", "PR not opened").

After a successful sign-in, confirm in one line (「✅ <服務> 已登入」) and carry on
with the task.
