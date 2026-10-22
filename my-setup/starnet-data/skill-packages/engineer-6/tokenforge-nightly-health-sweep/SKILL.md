---
name: "TokenForge Nightly Health Sweep"
description: "Standard operating procedure for the TokenForge nightly health sweep: execute sweep.js, persist output to dated markdown, diff against prior sweep, and emit the concise report (answered delta, new breaks with cause tags, fixes, 3-night issue rule, quiet-night line)."
category: "operations"
state: "active"
created_by: "background-review"
source_run_id: "47e418b5-2e10-4236-b081-74d9e05a18cb_skill_review"
pinned: false
platforms: ["windows"]
---

## Setup
Run from a shell with Node.js and access to the TokenForge checkout at C:\Users\bryce\Downloads\tokenforge\TokenForge. The side-instance launcher (dev\run-side-instance.bat) must be executable and bind to port 4100.

## TokenForge Nightly Health Sweep — SOP

**Purpose**: Run the provider health check, record results, compare to previous night, and emit the standardized report.

---

### 1. Prerequisites
- Repository: `C:\Users\bryce\Downloads\tokenforge\TokenForge`
- Node available on PATH
- Test instance launcher: `dev\run-side-instance.bat` (runs on port 4100, **never** 4000)
- No API keys required / read-only run
- Output directory: `vault/teams/qa/sweeps/` (create if missing)

---

### 2. Execute the Sweep
```bat
cd C:\Users\bryce\Downloads\tokenforge\TokenForge
node tools/sweep.js
```
- If the command times out (>300s), rerun with a longer timeout or `background:true`.
- Capture **stdout** and **stderr** in full.

---

### 3. Persist Output
- Date token: `YYYY-MM-DD` (local date of the run).
- Target file: `vault/teams/qa/sweeps/[date].md`
- Write the **entire raw sweep output** to that file (markdown code fence optional but recommended).

---

### 4. Compare with Previous Sweep
- Find the most recent `*.md` in `vault/teams/qa/sweeps/` **before** today.
- If none exists → first sweep; report "first sweep recorded (no prior sweep to compare)."
- Otherwise, parse both files for:
  - Total providers answered (the `X/Y answered` line)
  - Per-provider status: provider | model | HTTP code | error/message
- Compute:
  - `answered_now` vs `answered_before`
  - **Newly broken**: providers that answered before but now error (code + error)
  - **Fixed**: providers that errored before but now answer (code 200/OK)
  - **Persistent broken**: providers broken ≥3 consecutive nights (including tonight)

---

### 5. Tag Each Break by Cause
For every newly broken provider, add a **cause tag** (brief, one word) based on the error:
| Error pattern | Tag |
|---------------|-----|
| 429 / rate limit / quota | `rate-limit` |
| 402 / insufficient balance / credits | `billing` |
| 401 / 403 / invalid token / auth failed | `auth` |
| 404 / model not found / not supported | `model-missing` |
| 503 / unavailable / exhausted / capacity | `upstream` |
| 400 / invalid model / bad request | `bad-request` |
| fetch failed / network / timeout | `network` |
| NOT PORTED / not implemented | `not-ported` |
| other | `other` |

---

### 6. Emit Report (stdout only, no extra files)
Format exactly:
```
[answered_now]/[total] answered — [answered_now - answered_before] vs before
New breaks:
  [provider] | [model] | [code] | [error] — [tag]
  ...
Fixed:
  [provider] | [model] — was [old_code/error]
  ...
3+ nights broken → open Issue 'health':
  [provider] | [model] — [tag]
  ...
```
- If **no changes** (same answered count, no new breaks, no fixes):  
  `N/M answered, no changes.`
- If **first sweep**:  
  `N/M answered — first sweep recorded (no prior sweep to compare).`

---

### 7. Three-Night Rule
- Track consecutive broken nights per provider (use a simple sidecar file or re-scan last 3 sweep files).
- If a provider appears broken in **all of the last 3 sweeps**, include it in the "3+ nights broken" section and **open a GitHub Issue** labeled `health` (title: `[health] [provider] [model] broken 3+ nights`).
- Do **not** open duplicate issues; check existing open issues first.

---

### 8. Constraints & Guardrails
- **Read-only**: no writes to TokenForge repo, no commits, no PRs.
- **No shell/GitHub CLI** in this skill — issue creation is a manual handoff (or a separate automated skill).
- **Test only** via `dev\run-side-instance.bat` on port 4100.
- **No API keys** anywhere.
- **Quiet nights** emit the one-liner and exit.

---

### 9. Troubleshooting Patterns
| Symptom | Likely Cause | Retry / Fix |
|---------|--------------|-------------|
| Sweep times out (300s) | Slow provider responses | Re-run with `timeoutMs: 600000` or `background:true` |
| Zero providers answer | Side instance not running / wrong port | Verify `dev\run-side-instance.bat` started on 4100 |
| File write fails | Output dir missing | `mkdir -p vault/teams/qa/sweeps` before write |
| Diff logic errors | Prior sweep format changed | Re-parse with flexible regex; log raw lines for audit |

---

### 10. Related Skills / References
- `dev\run-side-instance.bat` — starts the test harness on port 4100
- `tools/sweep.js` — the sweep runner (Node script)
- `vault/teams/qa/sweeps/` — historical sweep archive
