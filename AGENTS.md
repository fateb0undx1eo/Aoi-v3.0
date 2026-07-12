# CRITICAL RULES — READ BEFORE EVERY SESSION

## NEVER COMMIT OR PUSH UNLESS EXPLICITLY TOLD

- NEVER run `git commit`, `git push`, `git add`, or any git staging command unless the user says "commit and push" or equivalent.
- NEVER ask "should I commit and push" or "want me to commit". Wait for the user to tell you.
- Stage only the files that were part of the task when committing.

## NEVER RUN DESTRUCTIVE COMMANDS WITHOUT EXPLICIT PERMISSION

- NEVER run `git reset`, `git checkout --`, `git restore`, `git clean`, or any command that destroys uncommitted work.
- NEVER run `git stash` without first warning the user and getting explicit approval.
- NEVER modify, revert, or discard the user's local changes for any reason.
- NEVER use `rm`, `del`, `Remove-Item`, or any file deletion command without explicit permission.
- NEVER run `bun next build` without first checking with the user if the dev server is running.
- NEVER dispatch a Task agent to modify files without user approval.

## ALWAYS ASK FIRST

- Before running ANY git command, ask the user.
- Before running ANY command that could modify or delete files, ask the user.
- Before running `bun next build`, `npm run build`, or similar, check if user wants it.
- If you're unsure whether a command is destructive, ASK.

## WHAT TO DO IF YOU FUCK UP

If you accidentally destroy the user's work:
1. Stop immediately.
2. Tell the user what happened and what command caused it.
3. Check `git reflog` and `git stash list` for recovery options.
4. Present recovery options to the user and let them choose.
5. Do NOT run recovery commands without permission.

## THE USER'S WORK COMES FIRST

- The user's uncommitted changes are sacred. Never touch them unless explicitly asked.
- Read files with `read` tool before editing. Never assume file contents.
- If an edit might conflict with user's work, verify with the user first.
