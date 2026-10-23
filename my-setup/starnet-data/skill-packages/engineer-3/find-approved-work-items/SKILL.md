---
name: "Find Approved Work Items"
description: "Standard procedure for discovering work that has been approved and is ready to build. Covers multiple source locations and fallback search patterns."
category: "workflow"
state: "active"
created_by: "background-review"
source_run_id: "4b71aa8a-8c8a-4b61-9fe6-6224334f08b6_skill_review"
pinned: false
platforms: ["windows", "linux", "macos"]
---

## Setup
Requires: shell access for file listing, gh CLI or GitHub API for issue queries. Works on Windows (PowerShell) and Unix-like shells.

## Procedure: Find Approved Work Items

### 1. Check Local Specs Directory (Primary)
- **Path**: `/specs` (repo root) or `C:\Users\bryce\Downloads\tokenforge\TokenForge\specs`
- **Action**: List all `.md` files in the directory
- **Filter**: Read each spec's frontmatter/status field
- **Accept**: Only specs with `Status: Approved` or equivalent approved state
- **Reject**: `Status: NEEDS APPROVAL`, `Status: Draft`, `Status: Rejected`

### 2. Check PR Status File
- **Path**: `/status/status.md` or equivalent status tracking file
- **Action**: Parse the markdown table for PRs
- **Filter**: Look for rows with `Status: Ready` and `Labels: ready for Bryce`
- **Extract**: PR number, title, head branch, base branch

### 3. Check GitHub Issues (Fallback)
- **Repositories**: 
  - `coolboymasterfarm-ai/tokenforge` (main repo)
  - `coolboymasterfarm-ai/tokenforge-src` (source repo if separate)
- **Query**: `label:approved state:open`
- **Action**: List issues matching the label
- **Accept**: Issues with `approved` label that are not closed

### 4. Check Secondary Specs Location
- **Path**: `C:\Users\bryce\Downloads\tokenforge\tokenforge-src\specs`
- **Action**: Same as step 1 if directory exists

### 5. Decision Logic
- If **multiple** approved items found → Present all, ask user to prioritize
- If **one** approved item found → Proceed with that item
- If **zero** approved items found → Report "Nothing waiting" with details of what was checked

### 6. Output Format
Report findings as:
```
## Approved Work Items Found
| Source | Identifier | Title | Status |
|--------|------------|-------|--------|
| /specs | SPEC-001   | ...   | Approved |
| GitHub | #42        | ...   | approved label |

## Checked Locations (No Approved Items)
- /specs — 1 file, status NEEDS APPROVAL
- /status/status.md — 0 ready PRs
- GitHub coolboymasterfarm-ai/tokenforge — 0 issues with approved label
- GitHub coolboymasterfarm-ai/tokenforge-src — 0 issues with approved label
```

### Edge Cases
- Specs directory missing → Log and continue to next source
- GitHub API rate limited → Note in output, continue with local sources
- Multiple repos with same issue numbers → Qualify with repo name
- Spec file without status frontmatter → Treat as unapproved, log warning
