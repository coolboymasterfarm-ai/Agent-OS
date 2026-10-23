---
name: "TokenForge Free Tier Monitor"
description: "Recurring monitoring task for TokenForge to track free-tier changes across AI providers. Reads paid-refusals.md and free-tier-state.md from vault/product/research/, fetches provider pricing pages, detects changes, and updates the state file. No signups or code changes. Tested via"
category: "monitoring"
state: "active"
created_by: "background-review"
source_run_id: "873776a3-0ca9-4074-8943-9a9074373346_skill_review"
pinned: false
platforms: ["windows", "linux", "mac"]
---

## Setup
Requires vault/product/research/ directory structure. No external API keys. Test on port 4100 via dev/run-side-instance.bat.

## TokenForge Free Tier Monitor

### Purpose
Periodically check AI provider pricing pages for free-tier changes and maintain a tracked state file.

### Prerequisites
- Workspace has `vault/product/research/` directory
- Two source files expected (create if missing):
  - `paid-refusals.md` — list of providers that returned paid-model errors this week
  - `free-tier-state.md` — master tracker with columns: provider, url, last_checked, status, notes
- No API keys required; only public pricing pages
- Test via `dev/run-side-instance.bat` on port 4100 (never 4000)

### Procedure

#### 1. Initialize Research Directory
```
If vault/product/research/ does not exist:
  Create it
If paid-refusals.md does not exist:
  Create empty file with header "# Paid-Model Refusals This Week"
If free-tier-state.md does not exist:
  Create with header:
  ```
  # Free Tier State Tracker
  | Provider | URL | Last Checked | Status | Notes |
  |---|---|---|---|---|
  ```
```

#### 2. Load Source Lists
- Read `vault/product/research/paid-refusals.md` → list of providers to prioritize
- Read `vault/product/research/free-tier-state.md` → parse table rows
- Identify 10 least recently checked providers (oldest `Last Checked` timestamps)

#### 3. Build Check List
- Combine: paid-refusals providers + 10 least-recently-checked
- Deduplicate by provider name
- For each, extract or infer the pricing page URL (from state file or known patterns)

#### 4. Check Each Provider
For each provider in the check list:
- Fetch the pricing page URL (use web fetch)
- Compare current page content against known free-tier indicators:
  - "Free tier", "Free plan", "$0/month", "Free forever"
  - Model names listed under free tier
  - Rate limits, token limits, request limits
- Detect changes:
  - **Went paid**: previously free tier now requires payment
  - **Limits cut**: free tier exists but limits reduced
  - **New free model**: new model added to free tier
  - **Shut down**: service discontinued / pricing page returns 404/redirect to shutdown notice
  - **URL moved**: pricing page redirected to new URL
- Classify evidence:
  - **VERIFIED**: explicit statement on pricing page or changelog
  - **ESTIMATE**: inferred from missing elements, unclear wording, or indirect signals

#### 5. Report Changes
Output ONLY changes detected (no unchanged providers). Format per change:
```
- **Provider Name** — [Change Type] — [VERIFIED|ESTIMATE] — [URL]
  Details: [specifics]
```

If no changes across all checked providers:
```
No free-tier changes across N providers.
```

#### 6. Update free-tier-state.md
- For each checked provider: update `Last Checked` to today (ISO date)
- For each change: update `Status` and `Notes` columns
- For URL moved: update `URL` column
- Preserve table format and sort by Provider name

#### 7. Save and Exit
- Write updated `free-tier-state.md`
- No git commits, no code changes, no signups

### Error Handling
- If source files missing → create empty templates (step 1) and report "No free-tier changes across 0 providers"
- If web fetch fails for a provider → mark as ESTIMATE with "fetch failed" note, continue
- If parsing fails → skip provider, log error, continue
- Never exceed 15 tool calls per run

### Testing
Run via `dev/run-side-instance.bat` (launches on port 4100). Verify:
- State file updates correctly
- Change detection works on known test cases
- Output format matches specification
