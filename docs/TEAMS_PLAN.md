# TEAMS — managers lead agent teams, Ultron hands them projects

**Goal (Commander, 2026-10-23):** agent teams in Agent OS. Ultron briefs a team's manager on a project; the manager
splits it across its team, content-checks what comes back, and reports to Ultron when it is all done. The Commander
adds and customizes teams in a section of the app.

## How it works (Phase 1, this PR)

```
Commander -> ULTRON --team.dispatch--> MANAGER --team.dispatch--> MEMBERS
                ^                         |  content check (rework once, report gaps as unfinished)
                +--- one consolidated report (the manager's final message) ---+
```

- `teams.json` beside the roster: `{ teams: [{ id, name, managerId, memberIds }] }`. Seeded for the Commander's six
  teams in `my-setup/starnet-data/teams.json` (Product, Design, Engineering, QA, Growth, Support).
- Dispatching a **manager** lends it the `teamlead` kit (`CAP_REGISTRY.teamlead`: `team.dispatch` + `team.subagents`
  only — no summon, spawn, routines or station control), cuts its roster to its members, and appends the manager brief
  (split, content check, report back). Same lend pattern as the builder.
- Depth is capped at two by construction: a manager's own dispatches lend nothing, so a member cannot delegate again and
  teams cannot nest. The old "workers never re-delegate" invariant still holds for everyone but a manager.
- Reporting back needs no new plumbing: a worker's final message is what the dispatcher receives.
- Ultron's "YOUR TEAM" briefing marks each manager so a whole project goes to one agent.
- Code: `sidecar/teams.js` (pure), `orchestration.js` (kit, scope, brief), `index.js` (`loadTeams`, briefing).
  Tests: `test/teams.test.js`.

## Next

- **Phase 2 — the TEAMS section.** `/api/teams` (GET/PUT, validated by `normalizeTeams`, atomic write like the other
  stores) and a window to add, rename and delete teams, pick the manager, tick members. Until then edit `teams.json`.
- **Phase 3 — projects.** Ultron hands a team a named project; the manager is notified, the team shows as one card on the
  station with its members' progress, and the report lands on Ultron's thread. Background manager runs (a resumed manager
  currently comes back without the lent kit: persist the team on the background record).
- **Cost.** A team multiplies runs: each manager run and each member run carries the per-worker cap. Before wide use, give
  a team one shared cap (manager cap split across members) and a max members per dispatch.

## Known limits of Phase 1

- Members still show in Ultron's list, so Ultron may dispatch one directly (kept: flexible, the manager marker steers it).
- No UI yet. `teams.json` is read per use; a missing or invalid file means no teams, never an error.
