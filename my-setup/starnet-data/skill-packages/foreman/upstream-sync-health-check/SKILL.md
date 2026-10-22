---
name: "Upstream Sync Health Check"
description: "Procedure to validate upstream catalog sync health by reading status files, checking git history, and identifying the sync PR status."
category: "catalog-sync"
state: "active"
created_by: "background-review"
source_run_id: "c0548d47-6639-443f-8e8a-860f6ebb6bcd_skill_review"
pinned: false
platforms: ["windows", "linux", "macos"]
---

## Setup
Run from TokenForge repo root. Requires git and access to vault/teams/engineering/upstream-state.md

# Upstream Sync Health Check

## Purpose
Validate that the TokenForge catalog is fresh by checking upstream sync status, identifying blocked sync attempts, and confirming the ready-to-merge sync PR.

## Prerequisites
- TokenForge repo at `C:\Users\bryce\Downloads\tokenforge\TokenForge\`
- Access to `vault/teams/engineering/upstream-state.md`

## Steps

### 1. Read Upstream State File
```bash
cat C:\Users\bryce\Downloads\tokenforge\TokenForge\vault\teams\engineering\upstream-state.md
```

### 2. Extract Key Signals
- **Last successful sync date** — should be within 7 days for freshness
- **Blocked/failed attempts** — note dates and reasons
- **Current sync PR** — usually PR #4 for catalog/sync-2026-10-18
- **Model count** — should be ~3,159 models (per 16fdf6f commit)

### 3. Check Git for Sync Branches
```bash
cd C:\Users\bryce\Downloads\tokenforge\TokenForge
git branch -a | grep catalog/sync
git log --oneline --all --grep="catalog" -10
```

### 4. Verify PR #4 Status
- Tests passing (should show PASS in CI)
- `catalog.json` unchanged (pure data update)
- Ready for merge label or equivalent

### 5. Decision Matrix
| Signal | Action |
|--------|--------|
| Last sync > 7 days ago | **Blocker** — escalate PR #4 merge |
| Sync PR tests failing | **Fix CI** — investigate failures |
| No sync PR open | **Create one** — run sync script |
| Sync PR ready + tests pass | **Merge immediately** — low risk, high signal |

### 6. Report
Include in weekly product review:
- Last successful sync date
- Days since last sync
- PR #4 status (ready/blocked/missing)
- Recommended action

## Anti-Patterns
- ❌ Assuming sync is healthy without reading upstream-state.md
- ❌ Merging sync PR without verifying tests pass
- ❌ Inventing model counts — read from git log (16fdf6f = 3,159 models)
