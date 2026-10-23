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

/* ---------- the registry slice is narrow and never swept in ---------- */
A.eq(CAP_REGISTRY.teamlead.map(g => g.tool), ['team.dispatch', 'team.subagents'], 'teamlead lends dispatch + status and nothing else');
A.ok(CAP_REGISTRY.teamlead.every(g => g.capId === 'orchestrator'), 'teamlead shares the orchestrator capId so the TASK DELEGATION switch covers it');
const lent = resolveTools('foreman', { agents: { foreman: { id: 'foreman', room: 'r' } }, rooms: { r: { id: 'r', objects: [{ instanceId: 't', objectType: 'teamlead' }] } } }).tools;
A.ok(lent.includes('team.dispatch') && !lent.some(t => /summon|spawn|routine|station\./.test(t)), 'a lent team lead can dispatch but not summon, spawn, schedule or run the station');
const IDX = fs.readFileSync(path.join(__dirname, '..', 'sidecar', 'index.js'), 'utf8');
A.ok(/const LENT = \['builder', 'teamlead'\];/.test(IDX) && /!LENT\.includes\(objectType\)/.test(IDX), 'the full-power sweep never confers teamlead on everyone');

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
