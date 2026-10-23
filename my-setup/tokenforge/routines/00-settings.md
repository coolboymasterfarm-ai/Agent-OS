# TokenForge routine settings

Every routine file in this folder reads this first. Bryce fills in the brackets once.

VAULT: [your StarNet vault folder, for example C:\Users\bryce\StarNet\vault]
REPO: github.com/coolboymasterfarm-ai/tokenforge
CODE: C:\Users\bryce\Downloads\tokenforge\TokenForge   (the agents' DEV copy)
LIVE: C:\Users\bryce\Downloads\tokenforge\live   (Bryce's running copy, StarNet runs on it. Agents never edit, build, run or close it.)
SIDE INSTANCE: dev\run-side-instance.bat [port] [name]   (default port 4100, own data folder; use it for every test)
OMNIROUTE REPO: [link to OmniRoute's GitHub repo]
FREELLMAPI REPO: [link to FreeLLMAPI's GitHub repo]

## The repo is Rust-only (since 2026-10-20)

The Node/JS app was removed. Do not look for it, run it, or re-add it.

- Code: `rust/src/*.rs` — api, catalog, crypto, db, desktop, formats, importer, main, oauth, state, ui, update, upstream
- Dashboard: `rust/assets/ui.html` (embedded at compile time)
- Provider catalog: `rust/assets/catalog.json` and `provider-links.json` (embedded at compile time)
- Build: `cargo build --release --manifest-path rust/Cargo.toml`, or `.\build.ps1` to also stage `dist\TokenForge.exe`
- Tests: `cargo test --manifest-path rust/Cargo.toml`. Tests live in `#[cfg(test)] mod tests` inside each module; there is no `test/` folder any more.
- Update an installed copy: `TokenForge.exe --update` pulls, rebuilds and swaps the exe for both copies. `--check` only reports, `--force` rebuilds when already current.

Gone with the Node app and not yet ported: `src/`, `test/`, `tools/` (catalog generator, provider sweeper,
benchmarks), `package.json`/npm, and every `node tools/...` command. Where a routine used to name one of
those, it now says what to do instead — never invent a replacement command, and never hand-edit
`rust/assets/catalog.json`.

Historical records, not instructions: `growth-plan-updater-fix.md`, `qa-plan-updater-fix.md`,
`setup-a-updater-fix.md` and `setup-b-github-ci.md` describe Node-era migration work that is already done.
Leave them alone; do not run them as current jobs.

`prompts-under-600.txt`, `starnet-step-briefs.txt` and `line-jobs.txt` are live prompt/job libraries and
have been updated for the Rust tree. Keep them in step when the code moves again.

Rules for every routine:
- Branches and PRs only. Never merge, push to main, publish a release or tag a real version.
- Never print, copy or commit an API key or anything from %APPDATA%\TokenForge.
- Official APIs and sign-ins only. No shared or leaked keys, no account creation.
- Same fix fails twice: stop and tell Bryce.
- If a file or folder named here is missing, stop and say which one. Don't guess.
- Test only on a side instance (port 4100+). Never use port 4000 or touch the live folder or its exe.
- Code reaches the live copy only by: your PR -> Bryce merges -> `TokenForge.exe --update` (or double-click update-from-github.bat).
