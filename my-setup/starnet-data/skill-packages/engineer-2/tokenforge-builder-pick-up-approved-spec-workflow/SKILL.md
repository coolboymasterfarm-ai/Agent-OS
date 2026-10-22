---
name: "TokenForge Builder - Pick up approved spec workflow"
description: "The TokenForge Builder agent workflow for picking up and executing approved specifications. Handles the complete loop from spec discovery through PR creation and CI verification."
category: "workflow"
state: "active"
created_by: "background-review"
source_run_id: "1ed621dc-dc9b-42fb-8b34-6cec89d7a18c_skill_review"
pinned: false
platforms: ["windows", "linux", "macos"]
---

## Setup
Requires: gh CLI authenticated, node tools/test-all.mjs, dev/run-side-instance.bat on port 4100. Specs live in /specs with status front-matter (Approved, NEEDS APPROVAL, etc.). Git branches follow feature/[n]-[name] pattern.

## TokenForge Builder — Pick Up Approved Spec Workflow

### 1. Discover Specs
- List files in `/specs` (use `fs_list` or shell `dir /specs`)
- Read each spec file to check front-matter `Status:` field
- **Only pick up specs with `Status: Approved`** — ignore `NEEDS APPROVAL`, `DRAFT`, `REJECTED`, etc.
- Select the **oldest** Approved spec (by date in front-matter or filename)
- If zero Approved specs: **reply "Nothing waiting" and stop** — report what you checked (folder contents, statuses found)

### 2. Prepare Feature Branch
- Extract spec number/name from filename (e.g., `disable-openai-provider.md` → feature branch `feature/1-disable-openai-provider`)
- Create branch: `git checkout -b feature/[n]-[name]`
- Verify clean working tree before starting

### 3. Implement the Spec
- Follow the spec's exact steps — **build only that spec**
- Do not add unrelated changes or refactors
- Write code, update tests, update documentation as specified

### 4. Run Tests Locally
- Execute: `node tools/test-all.mjs`
- If tests fail: fix and re-run (max 2 fix attempts per the budget rules)
- If tests pass: proceed to PR

### 5. Open Pull Request
- Commit changes with descriptive message referencing spec
- Push branch: `git push origin feature/[n]-[name]`
- Create PR: `gh pr create --title "[Spec] ..." --body "..."`
- **Never merge** — the tester handles merge after CI passes

### 6. Wait for CI (Tester Reruns Tests)
- The tester will rerun tests on the PR
- On pass: tester labels PR `ready for Bryce`
- **Monitor with `gh pr checks`** — a PR counts as done ONLY when every check shows green
- If any check stays red after 2 fix attempts: **report "CI FAILED" with the error** and stop

### 7. Final Reply (Outbox)
- Put the **full result** in the final reply — this is what shows in the outbox
- Include: what you did, what you found, file paths changed, PR link
- Never end with empty or one-line reply
- If nothing was waiting: say what you checked (folder, files, statuses)

---

### Key Rules (Budget & Constraints)
- **Max 20 tool calls** per run — stop at limit and report what you have
- **Read each file/page once** — big files/logs: search first, read only needed lines
- **A call fails twice → stop using it**
- **Test via `dev\run-side-instance.bat` on port 4100** — never 4000
- **No keys** in repo or specs
- **Get today's date from shell** (`date /t`) — never guess the year
- **No file/shell/GitHub access → stop** (hard constraint)

---

### "Nothing Waiting" Response Template
```
Nothing waiting. Checked /specs — found [N] file(s):
- [filename]: Status = [STATUS]
- [filename]: Status = [STATUS]
No specs with Status: Approved. Per standing orders, NEEDS APPROVAL specs are not mine to pick up.
```
