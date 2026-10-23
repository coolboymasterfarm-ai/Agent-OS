/* node test/teams.test.js — TEAMS: Ultron -> manager -> members -> back up. Drives team.dispatch against a FAKE runOnce:
   dispatching a manager lends it ONLY the teamlead kit and its member scope; a manager's own dispatches reach members only,
   lend nothing on (depth two); the registry slice stays narrow; the shipped seed file is a valid set of teams. */
'use strict';
const A = require('./_assert.js');
const fs = require('fs');
const path = require('path');
const T = require('../sidecar/teams.js');
const { makeOrchestrationTools } = require('../sidecar/tools/builtin/orchestration.js');
const { CAP_REGISTRY } = require('../sidecar/capability/registry.js');
const { resolveTools } = require('../sidecar/capability/resolve.js');
const IDX = fs.readFileSync(path.join(__dirname, '..', 'sidecar', 'index.js'), 'utf8');

/* ---------- pure helpers ---------- */
const teams = T.normalizeTeams({ teams: [
  { id: 'eng', name: 'Engineering', managerId: 'foreman', memberIds: ['e1', 'e2', 'foreman', 'agent', 'bad id', 'e1'] },
  { id: 'eng', managerId: 'other', memberIds: ['x'] },            // duplicate team id
  { id: 'qa', managerId: 'foreman', memberIds: ['q1'] },          // second team for the same manager
  { id: 'ult', managerId: 'agent', memberIds: ['x'] },            // Ultron is never a manager
  { id: 'empty', managerId: 'm', memberIds: [] },                 // no members
  { id: 'ok', managerId: 'lead2', memberIds: ['y'] }, null, 'junk'
] });
A.eq(teams.map(t => t.id), ['eng', 'ok'], 'bad, duplicate, Ultron-managed and memberless teams are dropped');
A.eq(teams[0].memberIds, ['e1', 'e2'], 'a manager is not its own member, Ultron is never a member, bad ids and repeats drop');
A.eq(T.normalizeTeams(undefined), [], 'no file -> no teams');
A.eq(T.teamOfManager(teams, 'foreman').id, 'eng', 'teamOfManager finds the team by its manager');
A.eq(T.teamOfManager(teams, 'e1'), null, 'a member is not a manager');
A.eq([...T.scopeRoster(new Map([['e1', {}], ['e2', {}], ['zzz', {}]]), ['e1', 'e2'])].map(r => r[0]), ['e1', 'e2'], 'scopeRoster keeps members only');
A.ok(/CONTENT CHECK/.test(T.managerBrief(teams[0])) && /Engineering team/.test(T.managerBrief(teams[0])), 'the manager brief names the team and the content check');

/* ---------- checkTeams: the strict gate for a save from the TEAMS window ---------- */
{
  const known = new Set(['foreman', 'e1', 'e2', 'q1']);
  const t = o => Object.assign({ id: 'eng', name: 'Engineering', managerId: 'foreman', memberIds: ['e1'] }, o);
  const why = (list, k) => { const r = T.checkTeams(list, k || known); return r.ok ? 'OK' : r.error; };
  A.eq(why([t()]), 'OK', 'a good team passes');
  A.eq(why([]), 'OK', 'no teams is a legitimate list');
  A.ok(/needs a name/.test(why([t({ name: ' ' })])), 'a nameless team is refused');
  A.ok(/needs a manager/.test(why([t({ managerId: '' })])), 'a team with no manager is refused');
  A.ok(/Ultron/.test(why([t({ managerId: 'agent' })])), 'Ultron cannot manage');
  A.ok(/manager is not on your crew/.test(why([t({ managerId: 'ghost' })])), 'an unknown manager is refused');
  A.ok(/ghost is not on your crew/.test(why([t({ memberIds: ['e1', 'ghost'] })])), 'an unknown member is refused by name');
  A.ok(/at least one member/.test(why([t({ memberIds: ['foreman'] })])), 'a manager alone is not a team');
  A.ok(/already leads/.test(why([t(), t({ id: 'qa', name: 'QA', memberIds: ['q1'] })])), 'a manager leads one team');
  A.eq(why([t(), t({ id: 'qa', name: 'QA', managerId: 'e2', memberIds: ['e1'] })]), 'OK', 'an agent may be on several teams');
  A.ok(/share the id/.test(why([t(), t({ managerId: 'e2' })])), 'two teams cannot share an id');
  A.ok(/spend limit/.test(why([t({ budgetUsd: -1 })])) && /spend limit/.test(why([t({ budgetUsd: 5000 })])), 'a spend limit outside 0-1000 is refused');
  A.ok(/must be a list/.test(why(null)), 'a non-list is refused');
  const full = T.normalizeTeams([t({ emoji: '🛠', color: '#33AAFF', instructions: ' tests first ', budgetUsd: '4.256' })])[0];
  A.eq([full.emoji, full.color, full.instructions, full.budgetUsd], ['🛠', '#33aaff', 'tests first', 4.26], 'look, orders and spend limit are normalized');
  A.eq(T.normalizeTeams([t({ color: 'red', budgetUsd: 'x' })])[0].color + '|' + T.normalizeTeams([t({ budgetUsd: 'x' })])[0].budgetUsd, '|0', 'a bad color or limit falls back to none');
  A.eq(T.perRunUsd({ budgetUsd: 3, memberIds: ['a', 'b'] }), 1, 'a team limit is split evenly over the manager and each member');
  A.eq(T.perRunUsd({ budgetUsd: 0, memberIds: ['a'] }), 0, 'no team limit means no team cap');
  A.ok(/TEAM STANDING ORDERS[\s\S]*tests first/.test(T.managerBrief(full)) && !/STANDING ORDERS/.test(T.managerBrief(Object.assign({}, full, { instructions: '' }))), 'the standing orders ride the manager brief only when set');
}

/* ---------- the TEAMS window is wired in ---------- */
{
  const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  const html = rd('frontend/index.html'), win = rd('frontend/app/windows/teams.js');
  A.ok(/registerWindow\('teams', 'TEAMS'/.test(win), 'the TEAMS window registers itself');
  A.ok(html.includes('<script src="app/windows/teams.js">') && html.indexOf('app/windows/teams.js') > html.indexOf('app/stationui.js'), 'the window loads after stationui.js');
  A.ok(/data-term="teams"/.test(html), 'the menu has a TEAMS door');
  A.ok(/fetch\('\/api\/teams'/.test(win) && /App\.openSummonBay/.test(win), 'the window reads and saves /api/teams and can open the recruiting bay');
  A.ok(/\{ m: \['GET', 'POST'\], exact: '\/api\/teams'/.test(IDX), 'the sidecar serves /api/teams');
  A.ok(!/\.innerHTML\s*=\s*[^;]*\+\s*(msg|t\.name|d\.name)\b[^;]*;/.test(win.replace(/esc\([^)]*\)/g, '')), 'no unescaped name or message reaches innerHTML');
}

/* ---------- registry slice is narrow and never swept in ---------- */
A.eq(CAP_REGISTRY.teamlead.map(g => g.tool), ['team.dispatch', 'team.subagents'], 'teamlead lends dispatch + status and nothing else');
A.ok(CAP_REGISTRY.teamlead.every(g => g.capId === 'orchestrator'), 'teamlead shares the orchestrator capId so the TASK DELEGATION switch covers it');
const lent = resolveTools('foreman', { agents: { foreman: { id: 'foreman', room: 'r' } }, rooms: { r: { id: 'r', objects: [{ instanceId: 't', objectType: 'teamlead' }] } } }).tools;
A.ok(lent.includes('team.dispatch') && !lent.some(t => /summon|spawn|routine|station\./.test(t)), 'a lent team lead can dispatch but not summon, spawn, schedule or run the station');
A.ok(/objectType !== 'builder' && objectType !== 'teamlead'/.test(IDX), 'the full-power sweep never confers teamlead on everyone');

/* ---------- team.dispatch: Ultron -> manager -> members ---------- */
const fakeRunOnce = () => { const calls = []; const fn = async o => { calls.push(o); return { reason: 'done', messages: [{ role: 'assistant', content: 'out:' + o.agentId }], usd: 0.1 }; }; fn.calls = calls; return fn; };
const roster = new Map([['foreman', { system: 'F', name: 'FOREMAN' }], ['e1', { system: 'E1', name: 'E1' }], ['e2', { system: 'E2', name: 'E2' }], ['outsider', { system: 'O', name: 'OUTSIDER' }]]);
const teamsFn = () => [{ id: 'eng', name: 'Engineering', managerId: 'foreman', memberIds: ['e1', 'e2'] }];
const ctx = { agentId: 'agent', signal: { aborted: false }, emit() {}, consent: {} };
const objTypes = c => (c.extraObjects || []).map(x => x.objectType);

(async () => {
  // Ultron dispatches the manager: kit + scope + brief
  {
    const ro = fakeRunOnce();
    const { dispatchTool } = makeOrchestrationTools({ runOnce: ro, roster: () => roster, key: 'k', model: 'm', perWorker: 1, newId: (() => { let n = 0; return () => 'r' + (++n); })(), teams: teamsFn });
    await dispatchTool.run({ workers: [{ agentId: 'foreman', prompt: 'ship the login page' }, { agentId: 'outsider', prompt: 'x' }] }, ctx);
    const mgr = ro.calls.find(c => c.agentId === 'foreman'), plain = ro.calls.find(c => c.agentId === 'outsider');
    A.ok(mgr && objTypes(mgr).includes('teamlead') && objTypes(mgr).includes('workbench'), 'a dispatched manager is lent the team lead kit on top of the worker kit');
    A.eq(mgr.teamScope, ['e1', 'e2'], 'the manager run carries its member scope');
    A.ok(/TEAM MANAGER/.test(mgr.system) && /CONTENT CHECK/.test(mgr.system), 'the manager run gets the manager brief (content check, report back)');
    A.ok(plain && !objTypes(plain).includes('teamlead') && plain.teamScope === undefined && !/TEAM MANAGER/.test(plain.system), 'a plain worker is untouched');
  }
  // the manager's own dispatch: members only, nothing lent on
  {
    const ro = fakeRunOnce();
    const { dispatchTool } = makeOrchestrationTools({ runOnce: ro, roster: () => roster, key: 'k', model: 'm', perWorker: 1, newId: (() => { let n = 0; return () => 'r' + (++n); })(), teams: teamsFn, teamScope: ['e1', 'e2'] });
    const out = await dispatchTool.run({ workers: [{ agentId: 'e1', prompt: 'build it' }, { agentId: 'outsider', prompt: 'not mine' }, { agentId: 'agent', prompt: 'up' }] }, Object.assign({}, ctx, { agentId: 'foreman' }));
    A.eq(ro.calls.map(c => c.agentId), ['e1'], 'a manager reaches its own members and nobody else');
    A.ok(!objTypes(ro.calls[0]).includes('teamlead') && ro.calls[0].teamScope === undefined, 'a member is lent nothing: depth stays at two');
    const text = typeof out === 'string' ? out : JSON.stringify(out);
    A.ok(/outsider/.test(text) && /no such live worker/.test(text), 'dispatching outside the team is refused with the roster hint');
  }
  // a manager that is somehow dispatched by a manager is not lent the kit
  {
    const ro = fakeRunOnce();
    const nested = () => [{ id: 'a', name: 'A', managerId: 'foreman', memberIds: ['e1'] }, { id: 'b', name: 'B', managerId: 'e1', memberIds: ['e2'] }];
    const { dispatchTool } = makeOrchestrationTools({ runOnce: ro, roster: () => roster, key: 'k', model: 'm', perWorker: 1, newId: () => 'n', teams: nested, teamScope: ['e1'] });
    await dispatchTool.run({ workers: [{ agentId: 'e1', prompt: 'x' }] }, Object.assign({}, ctx, { agentId: 'foreman' }));
    A.ok(!objTypes(ro.calls[0]).includes('teamlead'), 'teams can never nest: a manager dispatching another manager lends no kit');
  }
  // no teams wired -> byte-identical behaviour
  {
    const ro = fakeRunOnce();
    const { dispatchTool } = makeOrchestrationTools({ runOnce: ro, roster: () => roster, key: 'k', model: 'm', perWorker: 1, newId: () => 'n' });
    await dispatchTool.run({ workers: [{ agentId: 'foreman', prompt: 'x' }] }, ctx);
    A.ok(!objTypes(ro.calls[0]).includes('teamlead') && ro.calls[0].teamScope === undefined, 'with no teams wired the dispatch is unchanged');
  }
  // a team spend limit: the manager's run and every member run each get an equal slice
  {
    const ro = fakeRunOnce();
    const budgeted = () => [{ id: 'eng', name: 'Engineering', managerId: 'foreman', memberIds: ['e1', 'e2'], budgetUsd: 3, instructions: 'tests first' }];
    const { dispatchTool } = makeOrchestrationTools({ runOnce: ro, roster: () => roster, key: 'k', model: 'm', perWorker: 9, newId: () => 'n', teams: budgeted });
    await dispatchTool.run({ workers: [{ agentId: 'foreman', prompt: 'x' }] }, ctx);
    A.eq(ro.calls[0].maxCostUsd, 1, 'the manager run is capped at its slice of the team limit');
    A.eq(ro.calls[0].teamPerRunUsd, 1, 'and its members are told the same slice');
    A.ok(/tests first/.test(ro.calls[0].system), 'the team standing orders reach the manager run');
    const ro2 = fakeRunOnce();
    const { dispatchTool: d2 } = makeOrchestrationTools({ runOnce: ro2, roster: () => roster, key: 'k', model: 'm', perWorker: 1, newId: () => 'n', teams: budgeted, teamScope: ['e1', 'e2'] });
    await d2.run({ workers: [{ agentId: 'e1', prompt: 'x' }] }, Object.assign({}, ctx, { agentId: 'foreman' }));
    A.eq(ro2.calls[0].maxCostUsd, 1, 'a member run carries the per-run slice the host passes down (perWorker)');
  }
  // the shipped seed
  {
    const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'my-setup', 'starnet-data', 'teams.json'), 'utf8'));
    const rosterFile = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'my-setup', 'starnet-data', 'agent.roster.json'), 'utf8'));
    const ids = new Set(rosterFile.agents.map(a => a.agentId));
    const norm = T.normalizeTeams(seed);
    A.eq(norm.length, seed.teams.length, 'every team in the seed is valid');
    A.ok(norm.every(t => ids.has(t.managerId) && t.memberIds.every(m => ids.has(m))), 'every manager and member in the seed is a real roster agent');
  }
  A.report();
})();
