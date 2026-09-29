## Migrate: bringing existing work into a dedicated folder

When the user moves to a new per-project folder (see "Suggest a dedicated
folder"), or runs `/jira-migrate`, offer to bring the files that belong to
that Jira project:

1. Collect candidates, most certain first:
   - files created or modified in this session;
   - names or paths containing the project key or its ticket keys
     (`HS-113_spec.docx`, `hs-web/`);
   - documents whose content mentions its ticket keys (search only text
     files, only in the current folder tree, depth 3).
2. Show them in one AskUserQuestion card with `multiSelect: true`, most
   certain ones listed first and marked. If there are more than fit, group
   them by folder.
3. **Copy, do not move.** Never copy `node_modules`, `.venv`, build output,
   caches, `.env` files or keys/credentials - list secrets for the user to
   handle themselves.
4. A git repo moves only as a whole folder, never as individual files. If it
   has uncommitted changes or unpushed commits, say so before copying.
5. Verify the copies (count and sizes match), then ask with a second card
   whether to delete the originals. Only on an explicit yes, delete them and
   leave `moved-to-<KEY>.md` in the old place saying where they went.
6. Finish with the `/cd <new folder>` line for the user to type.
