# My StarNet setup

Snapshot of my customized StarNet taken 2026-10-22 from this PC.

- `starnet-data/` — from `%APPDATA%\ai.skynet.harness\workspaces`: workflow agents (`agent.save.json`, `agent.roster.json`), schedules (`cron.jobs.json`), briefs, routing plan, commander settings, and per-agent skill packages.
- `tokenforge/` — routines (`routines/`), the side-instance launcher (`dev/`), and `update-from-github.bat`.

Left out on purpose: `.secrets/`, `channels/secrets.json`, connector state, browser profile, chat/transcript history, run ledgers, `.bak` and save-conflict files.

Restore: quit StarNet completely (it overwrites these files while running), copy `starnet-data/` into `%APPDATA%\ai.skynet.harness\workspaces\`, then reopen StarNet and re-add your API keys.
