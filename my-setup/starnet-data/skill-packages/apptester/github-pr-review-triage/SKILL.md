---
name: "GitHub PR Review & Triage"
description: "Class-level umbrella skill for routine PR triage across repos. Covers: listing PRs, fetching details (checks, mergeable state, branch status), updating branch if behind, labeling ready PRs, and writing a status.md summary. Reusable for any GH repo the user owns."
category: "github-ops"
state: "active"
created_by: "background-review"
source_run_id: "7caba365-eb79-416d-ab4e-57c1ccb31faa_skill_review"
pinned: false
platforms: ["linux", "macos", "windows"]
---

## Setup
Requires gh CLI auth. Default "ready" label: "ready for Bryce" (green #0e8a16). Status file path configurable per repo.

## GitHub PR Review & Triage — Procedure

**Use when:** You need to triage open PRs in a GitHub repository, verify CI status, and produce a human-readable status report.

### Prerequisites
- `gh` CLI authenticated (`gh auth status`)
- Repo name known (owner/name)
- Write access to a local path for `status.md` output

---

### Step 1 — List Open PRs
```bash
gh pr list --repo <owner>/<repo> --state open --json number,title,author,createdAt,headRefName,baseRefName,labels,mergeable,reviewDecision
```
- Capture all open PRs; sort by creation date (oldest first).

---

### Step 2 — Inspect Each PR (loop)
For each PR number:
```bash
# Full PR metadata
gh pr view <number> --repo <owner>/<repo> --json number,title,author,createdAt,headRefName,baseRefName,labels,mergeable,reviewDecision,state

# CI/checks status
gh pr checks <number> --repo <owner>/<repo>

# Branch sync status (is PR branch behind base?)
gh pr view <number> --repo <owner>/<repo> --json headRefName,baseRefName -q '.headRefName + " vs " + .baseRefName'
# Then: git fetch origin && git merge-base --is-ancestor origin/<base> origin/<head> && echo "UP_TO_DATE" || echo "BEHIND"
```

**Decision matrix per PR:**
| Condition | Action | Label |
|-----------|--------|-------|
| All checks PASS + mergeable + branch up-to-date | Mark **Ready** | `ready for Bryce` (or configured "ready" label) |
| Checks pending / branch behind / merge conflicts | Mark **Waiting** | (none) or `needs-update` |
| >14 days idle (author pinged) | Mark **Stale** | `stale` |
| >30 days idle | Mark **Stale** | `stale` |

---

### Step 3 — Update Branch if Behind (optional, per PR)
```bash
gh pr update-branch <number> --repo <owner>/<repo>
```
- Only if PR is otherwise ready but branch is behind base.
- Fails fast if conflicts; do not force-push.

---

### Step 4 — Apply "Ready" Label
If label doesn't exist:
```bash
gh label create "ready for Bryce" --repo <owner>/<repo> --color 0e8a16 --description "All checks green, ready for Bryce to review" --force
```
Then apply:
```bash
gh pr edit <number> --repo <owner>/<repo> --add-label "ready for Bryce"
```

---

### Step 5 — Write Status Report
Create `status.md` at configured output path:
```markdown
# <Repo> PR Status — <YYYY-MM-DD>

## Open PRs (oldest first)

| # | Title | Author | Created | Head | Base | Labels | Checks | Status |
|---|-------|--------|---------|------|------|--------|--------|--------|
| N | ...   | ...    | ...     | ...  | ...  | ...    | ...    | Ready/Waiting/Stale |

## Legend
- **Ready**: All checks green, labeled "ready for Bryce"
- **Waiting**: Checks pending, branch behind main, or needs work
- **Stale**: >14 days idle (author pinged), >30 days idle (labeled stale)

## Last Run
- Date: <YYYY-MM-DD>
- PRs processed: X/Y
- Tool calls used: ~N/20
```

---

### Step 6 — Output Summary to User
Print a concise summary:
- Total PRs processed
- Count by status (Ready / Waiting / Stale)
- Any actionable items (e.g., "PR #4 ready to merge")
- Path to status.md

---

### Support Files (under references/)
- `references/pr-status-template.md` — the markdown table template
- `references/label-definitions.md` — standard label names, colors, descriptions
- `scripts/pr-triage.sh` — optional bash wrapper for the full loop
