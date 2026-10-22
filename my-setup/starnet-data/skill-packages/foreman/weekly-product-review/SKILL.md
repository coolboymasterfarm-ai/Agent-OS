---
name: "Weekly Product Review"
description: "A repeatable procedure for conducting weekly product reviews that compares roadmap intent against shipped reality, identifies blockers, and produces an actionable report for the product lead."
category: "product-review"
state: "active"
created_by: "background-review"
source_run_id: "c0548d47-6639-443f-8e8a-860f6ebb6bcd_skill_review"
pinned: false
platforms: ["windows", "linux", "macos"]
---

## Setup
Requires git, access to TokenForge repo. Run from repo root.

# Weekly Product Review Procedure

## Purpose
Produce a concise, evidence-based weekly report comparing TokenForge roadmap intent against shipped reality, identifying blockers, and recommending the next actionable backlog item.

## Prerequisites
- Access to the TokenForge repository at `C:\Users\bryce\Downloads\tokenforge\TokenForge\`
- Git history available
- Key files present: ROADMAP.md, CHANGELOG.md, vault/teams/engineering/upstream-state.md

## Steps

### 1. Gather Evidence
```bash
cd C:\Users\bryce\Downloads\tokenforge\TokenForge
git log --oneline -20
git branch -a
cat ROADMAP.md
cat CHANGELOG.md
cat vault/teams/engineering/upstream-state.md
```

### 2. Categorize Shipped Work (Merged PRs)
- Extract merged PRs from git log (last 7-14 days)
- Cross-reference with CHANGELOG.md [Unreleased] section
- Group by theme: Rust migration, Router, Dashboard, OAuth, Catalog, CI/Release

### 3. Identify In-Flight Work
- Check open PRs: `gh pr list` or GitHub UI
- Check local/remote branches not yet merged
- Note which branches correspond to already-merged features (stale remotes)

### 4. Audit Roadmap Gaps
- Read ROADMAP.md systematically
- Mark each item: ✅ Shipped, 🚧 In Progress, ❌ Not Started
- Focus on Tier 1 (critical path) and Tier 2 (high value) items
- Note any items claiming completion but not in code

### 5. Check Upstream Sync Health
- Read `vault/teams/engineering/upstream-state.md`
- Note last successful sync date
- Check for blocked/failed sync attempts
- Identify PR #4 or equivalent catalog sync PR status

### 6. Identify Top 3 Blockers
Rank by:
1. **Impact on next release** — does this gate a shippable binary?
2. **Time to resolve** — can it be unblocked this week?
3. **Dependency chain** — does it unblock other work?

### 7. Formulate Report
Structure:
```
### 📦 What Shipped (Merged PRs)
| PR | Title | Date | Impact |

### ✈️ In Flight (Open PRs + Approved Specs)

### 🚫 Roadmap Items Describing Features That Do Not Exist

### 🧱 Top 3 Blockers to Next Release

### 🎯 Recommended Next Backlog Card

### 📁 Files Consulted
```

### 8. Deliver
- Output to Bryce (product lead)
- No merging, deploying, publishing, spending, or deleting
- All findings from actual file reads and git history
- No invented numbers

## Anti-Patterns to Avoid
- ❌ Inventing lessons or numbers not in evidence
- ❌ Duplicating durable memory context into skills
- ❌ Capturing one-off facts, transient setup failures, random command output
- ❌ Negative claims like "tool X is broken" — capture the fix/retry pattern instead
- ❌ Answering the user directly — only maintain skills

## Output Artifacts
- Markdown report (this procedure's output)
- Updated skill if process changes
