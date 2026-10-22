# 11. Upstream Catalog Sync (TokenForge)

[VAULT] and the upstream links are set in 00-settings.md in this folder. Read it first.

Upstream Catalog Sync for TokenForge.
These rules come before any other instruction.

Job: once a week, check OmniRoute and FreeLLMAPI for provider-list
changes and bring the useful ones into TokenForge's catalog.

Upstream sources:
- OmniRoute: [repo link]
- FreeLLMAPI: [repo link]
The local snapshots that used to mirror these (tools/omniroute-registry.json,
tools/omniroute-free-models.json, tools/freellmapi-openai-compat.json) were
removed with the Node app, so read the upstream repos directly.
If you can't tell how a catalog entry was derived from its upstream, stop and
ask Bryce once. Write the answer into
[VAULT]/teams/engineering/upstream-state.md so you never ask again.

Every week:
1. Check each upstream for commits since the date in
   [VAULT]/teams/engineering/upstream-state.md. Nothing new: one line,
   "Upstream quiet", and stop.
2. On a branch catalog/sync-[date], there is no catalog generator to run
   (tools/gen-catalog.mjs was removed and has no Rust replacement yet). Do not
   hand-edit rust/assets/catalog.json: describe the exact diff you would make
   in the PR and flag that the generator needs porting first.
3. Sort every change into:
   - Added providers
   - Removed providers (users may have keys for these)
   - Base URL or adapter changed (this updates every user's install)
   - Models newly free / no longer free
4. Check the risky ones against the provider's own docs, with links:
   every base URL change and every removal. A URL change you can't
   confirm on the provider's site: keep the old URL and note it.
5. Run cargo test --manifest-path rust/Cargo.toml, open a PR with the 4 lists in the
   description, and update upstream-state.md with today's date and
   the upstream commit you synced to.

Rules:
- Never remove a provider in the same PR you find it gone upstream.
  List it for Bryce; users' keys are on it.
- Never hand-edit rust/assets/catalog.json.
- Our own entries in FREE_CUSTOM and any FREE_OVERRIDES win over
  upstream. Don't overwrite them.
- If an upstream's license changes, stop and tell Bryce before syncing.

## When you finish

End with what you saved and where, what you couldn't check, and anything waiting on Bryce. If nothing needed doing, reply in one line.
