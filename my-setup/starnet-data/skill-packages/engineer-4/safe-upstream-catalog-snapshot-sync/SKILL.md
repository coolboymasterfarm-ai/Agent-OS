---
name: "Safe upstream catalog snapshot sync"
description: "Class-level procedure for syncing a generated catalog/registry from upstream sources, including the accept-or-ship-tools decision gate."
category: "data pipelines"
state: "active"
created_by: "background-review"
source_run_id: "565b1922-3185-474f-9a2b-b07b1106ff34_skill_review"
pinned: false
---

## Setup
Applies when a repo derives a large catalog (providers/models/free lists) from upstream snapshots, has a generator plus a diff tool against the committed catalog, and the user forbids silently removing providers or gutting model lists. Windows/cmd host; `fs_edit` requires `fs_read` of the target file in the same run.

## When to use
A catalog/snapshot sync task where upstream URLs, layouts, or file shapes may have moved, and correctness means **no unexplained shrinking** of the derived artifact (providers, models, free entries, tracked ids).

## Core invariant (the whole task hinges on this)
A regenerated catalog is only acceptable if every removal is *proven* to be a real upstream change, not a parsing/rebuild artifact. **Lossy parse == removing a provider.** Big `→ 0` / big drops are evidence about your parser, not about upstream.

## Procedure

1. **Orient before fetching.** Read the sync README, the generator, the state note, and the committed artifact to learn: last-sync date, expected snapshot shapes, the add/remove rule, and the current baseline counts.
2. **Probe upstream, cheaply, first.** Commits since last-sync per repo, plus a targeted check for policy-relevant edits (e.g. `LICENSE` touch counts) so a "stop on license change" style rule gets an explicit verdict. Record the delta (commits, releases).
3. **Rebuild the fetch step only if needed.** If snapshot URLs 404, don't conclude "no upstream data": write a fetcher against current source files (registries split into per-module files, TS data literals, server-side provider indexes) and emit a `.new` snapshot per source. Fix parser bugs you find (e.g. single-quoted strings, scans matching wrapper code). Log the parser's **known gaps**.
4. **Normalize additively, never destructively.** Reshape snapshots to the generator's input shape with these rules:
   - tracked provider never dropped, even if absent upstream (keep last-known entry);
   - ids tracked-only-in-catalog preserved (diff the id sets both ways);
   - junk/placeholder ids filtered (e.g. `nan`, bare `custom`, duplicates);
   - `base_url`/metadata drift from upstream is **reported, not applied** (a moved URL needs a provider-doc check first).
5. **Run the diff gate before committing.** `node tools/diff-catalog.cjs` style check against HEAD: providers, models, free models, `ADDED`/`REMOVED`, adapter resolution, null `base_url`s, and required custom/free id coverage. Read `references/accept-or-restore-gate.md`.
6. **Decide.** PASS (counts match baseline, `REMOVED (0)`, all required ids present) → regenerate → `git checkout` only the artifact churn you didn't intend → run the local test-all → commit artifact + tools. FAIL → `git checkout -- <generator inputs and artifact>` back to HEAD, re-verify byte-identical regeneration (**providers/models/free unchanged, ADDED 0 / REMOVED 0, required ids present**) and tests green, then ship the **tooling + evidence only**, artifact left unchanged, in the commit and PR titles.
7. **Ship as a reviewed PR, not a merge.** Branch, commit tools + state note, push, open PR, then verify CI and parse the PR JSON for `mergeable`/`state`. Leave merging to the user.
8. **Persist sorted signal for the next run.** One durable note with the command sequence, and the drift split into three buckets: **adopt**, **needs provider-doc / pricing check**, **must NOT adopt (parse loss)**.
9. **State the "assumed, not run"** for anything behavioral you skipped because the artifact is byte-identical, plus any pre-existing dirty file you deliberately left untouched.

## Gotchas (this host / this family of repos)
- `fs_edit` refuses without a same-run `fs_read` of that exact file; `fs_append` is a fine alternative for adding sections.
- `git status --cached` is not a thing on this git — use `git diff --cached --stat`.
- `gh pr checks` can fail with "Input redirection is not supported" (exit 8) when piped on cmd — run it unpiped and re-check.
- Upstream snapshot URLs go stale silently; always verify with a live fetch, and treat "404" as "layout moved".
- After a `git checkout` recovery, prove recovery with counts, not with the exit code.
