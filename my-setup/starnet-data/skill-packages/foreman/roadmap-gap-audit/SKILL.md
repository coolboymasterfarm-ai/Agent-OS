---
name: "Roadmap Gap Audit"
description: "Procedure to verify each roadmap item against the actual codebase, producing a gap analysis table for the weekly review."
category: "product-review"
state: "active"
created_by: "background-review"
source_run_id: "c0548d47-6639-443f-8e8a-860f6ebb6bcd_skill_review"
pinned: false
platforms: ["windows", "linux", "macos"]
---

## Setup
Run from TokenForge repo root. Requires git, grep, access to ROADMAP.md and CHANGELOG.md

# Roadmap Gap Audit

## Purpose
Systematically compare TokenForge ROADMAP.md against shipped code to identify features claimed complete but not implemented, and track actual implementation status per tier.

## Prerequisites
- TokenForge repo with ROADMAP.md
- Access to git history for verification
- CHANGELOG.md for shipped features reference

## Steps

### 1. Load Reference Documents
```bash
cat C:\Users\bryce\Downloads\tokenforge\TokenForge\ROADMAP.md
cat C:\Users\bryce\Downloads\tokenforge\TokenForge\CHANGELOG.md
```

### 2. Parse ROADMAP.md Structure
ROADMAP.md uses tiered checkbox format:
```
## Tier 1 — Critical Path
- [ ] 1. Item description
- [x] 2. Shipped item
```

### 3. Verify Each Item Against Code
For each unchecked item, search codebase:
```bash
# Example: Check for SSE live panels (Tier 1 item 5)
grep -r "EventSource\|SSE\|Server-Sent" --include="*.rs" --include="*.ts" --include="*.js" .

# Example: Check for RPM/TPM enforcement (Tier 2 item 7)
grep -r "rpm\|tpm\|rate.limit" --include="*.rs" .

# Example: Check for Prometheus metrics (Tier 3 item 15)
grep -r "prometheus\|/metrics\|OTLP" --include="*.rs" .
```

### 4. Cross-Reference CHANGELOG
Match [Unreleased] and versioned entries to ROADMAP items:
- CHANGELOG mentions "Candidate caching (17 ms → <1 ms)" → maps to router performance
- CHANGELOG mentions "Self-tuning router" → maps to Tier 2 item 8/9
- CHANGELOG mentions "Circuit breaker" → maps to Tier 2 item 6

### 5. Produce Gap Table
| Tier | ROADMAP Item | Status | Evidence |
|------|-------------|--------|----------|
| 1 | 5. Push live panels over SSE | ❌ Not Started | No SSE/EventSource in codebase |
| 2 | 7. Enforce RPM/TPM limits | ❌ Not Started | Only tpd/monthly_tokens for display |
| 2 | 9. Request coalescing | ❌ Not Started | Opt-in Settings only mentioned |
| 3 | 12. Anthropic/OpenAI inbound | ❌ Not Started | Only /v1/chat/completions exposed |

### 6. Flag False Positives
Items that appear in CHANGELOG but map to no ROADMAP item:
- Windows auto-updater (88c8db6) → Tier 3 item 17 partially addressed
- Rust-only build (4787182) → Tier 4 cleanup

### 7. Report Format
Include in weekly review:
```
### 🚫 Roadmap Items Describing Features That Do Not Exist
| Tier | Item | Description | Evidence |
```

## Anti-Patterns
- ❌ Trusting checkboxes in ROADMAP.md without code verification
- ❌ Assuming CHANGELOG features map 1:1 to ROADMAP items
- ❌ Missing that some "shipped" features are only partial (e.g., auto-updater code exists but not verified live)
