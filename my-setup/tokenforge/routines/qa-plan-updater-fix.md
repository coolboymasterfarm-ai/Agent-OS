[QA Lead] — QA plan for the TokenForge updater fix work line.

Scope under test: update-from-github.bat and build.ps1.
Acceptance source of truth: routines\setup-a-updater-fix.md
Evidence standard: only a failing test or a step failing 2 of 2 counts as a proven bug.
No merge, deploy, publish, spend, delete, or key-printing actions anywhere in this plan.

---

Piece 1 — UI Tester (apptester-2): live end-to-end run of the updater

Deliverable: three numbered logs plus a short evidence report, each labeled with the scenario:
  1. Normal update (app closed, new commit present on main).
  2. --force with no new commits.
  3. TokenForge left open on purpose.

Done means, all proven by the log text itself:
  - No log still contains "Commit  : ~0,8". The commit line must read as 7-40 lowercase hex characters.
  - No log contains "'Building' is not recognized as an internal or external command".
  - No log reports build exit code -196608 or 1 and then prints UPDATE COMPLETE.
  - Scenario 1 prints UPDATE COMPLETE only after the pull succeeded, build exited 0,
    dist\TokenForge.exe exists and is larger than 1,000,000 bytes, and the installed exe hash matches.
  - Scenario 2 prints "Nothing to do" or an equivalent no-build notice and does not modify the exe.
  - Scenario 3 either closes the app before the build and succeeds, or prints UPDATE FAILED -
    never UPDATE COMPLETE with the old exe still in place.
  - backups\ holds 3 or fewer TokenForge-*.exe files after every scenario.

---

Piece 2 — Test Automation Engineer (engineer-6): automated log-and-backup check

Deliverable: TokenForge\test\update-scripts.test.js, run with
  node test/update-scripts.test.js
from the TokenForge project folder, alongside a run of the existing 9 test files to catch regressions.

Done means:
  - The new test parses every logs\update-*.log from the last run and asserts:
    * the "Commit :" line matches ^[0-9a-f]{7,40}$
    * no log line after a successful pull contains "fatal: not a git repository"
    * no log contains a non-zero build exit code followed by "UPDATE COMPLETE"
    * step headers appear in order 1 -> 6
    * backup count <= 3
  - The test exits 0 only when every assertion passes; exits 1 with the exact failing
    line and file path otherwise.
  - All 9 existing test files still pass with no new failures introduced by the updater changes.

---

Piece 3 — Bug Hunter A (apptester-3): failure-path probes

Deliverable: a numbered report, each entry with the probe, the observed log line,
and a second independent run confirming the result (2 of 2).

Done means, each probe confirmed twice:
  Probe A1 - missing .git:
    Delete TokenForge\.git, run the updater.
    It must stop with a clear UPDATE STOPPED or UPDATE FAILED message naming the missing repo,
    and must not attempt the build or touch TokenForge.exe. Confirm 2 of 2.

  Probe A2 - locked exe:
    Launch TokenForge.exe, run the updater.
    The app must be detected and closed before build.ps1 runs, or the run must print
    UPDATE FAILED: [reason] - never UPDATE COMPLETE with the old exe. Confirm 2 of 2.

  Probe A3 - no internet:
    Disconnect or point REPO_URL at an unreachable host, run the updater.
    It must fail at the git fetch step with a clear message and leave TokenForge.exe
    byte-identical to before the run. Confirm 2 of 2.

  Probe A4 - deleted dist\TokenForge.exe before build:
    Delete the file, run build.ps1 directly.
    It must exit 0 only if a real exe is produced; a non-zero exit or missing file
    must never be treated as success by the updater. Confirm 2 of 2.

---

Piece 4 — Bug Hunter B (apptester-4): edge-case probes

Deliverable: a numbered report, each entry with the probe, the observed result,
and a second independent run (2 of 2).

Done means, each probe confirmed twice:
  Probe B1 - state file renamed:
    Rename .tf-last-update-sha to .tf-last-update-sha.bak, run the updater.
    It must detect a new commit when one exists and not silently no-op. Confirm 2 of 2.

  Probe B2 - build.ps1 missing:
    Delete TokenForge\build.ps1, run the updater.
    It must fail before touching the install and print a clear error. Confirm 2 of 2.

  Probe B3 - seed 7 old backups:
    Place 7 TokenForge-*.exe files in backups\, run the updater.
    After the run only the 3 newest remain; the 4 oldest are gone. Confirm 2 of 2.

  Probe B4 - two consecutive no-op runs:
    Run the updater twice in a row with no new commits.
    The second run must be a clean no-op with no file changes in TokenForge\
    or TokenForge.exe. Confirm 2 of 2.

---

Verdict rule

  PASS: every done-means item above is proven by a log line, test output, or screenshot.
        The verdict is written with numbered reasons and the evidence location for each.

  FAIL: any acceptance criterion is unmet, any of the 5 known errors from
        setup-a-updater-fix.md is reproduced 2 of 2, or the automated suite exits 1.
        The spec returns to Engineering with the numbered failing items and exact log lines.

  Two FAILs on the same fix: stop, document all evidence, escalate to the Overseer.

No QA agent merges, deploys, publishes, spends money, or deletes files without Commander approval.
No keys are printed at any step.
