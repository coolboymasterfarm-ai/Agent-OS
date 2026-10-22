# Setup A: Updater Fix (TokenForge)

Fix the TokenForge updater. One job: make update-from-github.bat
tell the truth about whether an update worked.

Files: C:\Users\bryce\Downloads\tokenforge\update-from-github.bat
and C:\Users\bryce\Downloads\tokenforge\TokenForge\build.ps1
Logs: C:\Users\bryce\Downloads\tokenforge\logs\

Exact errors from my logs:
1. The summary always prints "Commit  : ~0,8". The commit SHA is empty.
2. "'Building' is not recognized as an internal or external command,
   operable program or batch file."
3. "build.ps1 exited with code -196608" and "exited with code 1",
   then "UPDATE COMPLETE" anyway.
4. "Copy-Item : The process cannot access the file
   '...\tokenforge\TokenForge.exe' because it is being used by another
   process." The app was still running during the build.
5. One run printed "Branch  : does-not-exist" and "fatal: not a git
   repository", then "UPDATE COMPLETE".

What I need:
- Reproduce each error first and show me the log line. Don't assume
  the cause. For each one, finish the sentence "It broke because ___"
  with the file and line.
- Fix only the updater and build.ps1. Change one thing at a time.
- "UPDATE COMPLETE" may only print when: the pull succeeded, the build
  exited 0, dist\TokenForge.exe exists and is newer than the start of
  the run, and the installed exe matches it byte for byte. Anything else
  prints "UPDATE FAILED: [reason]" and restores the backup.
- The app must be fully closed before the build, and the updater must
  check that it is.
- Keep only the 3 newest backups in backups\.

Rules:
- Never touch %APPDATA%\TokenForge (my keys and data live there).
- Never force-push, reset or delete branches. Never delete my local
  edits; stash them like the updater already does.
- Same fix fails twice: stop and tell me.
- Not done until verified: run the updater 3 times and paste the end of
  each log: (a) a normal update, (b) --force with no new commits,
  (c) with TokenForge left open on purpose. (c) must print UPDATE FAILED
  or close the app first, never UPDATE COMPLETE with an old exe.

Report: the root cause of each of the 5 errors, what you changed, and
the 3 test logs.
