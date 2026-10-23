/* node test/teams.http.test.js — TEAMS end to end on the REAL sidecar with a scripted model (no network).

   Proves what the unit test cannot: that the run host really lends a dispatched manager its team kit (and only that),
   that the manager really delegates to a member and is refused for someone outside its team, that the member can never
   delegate again, and that the manager's report is what Ultron receives. Also the /api/teams route: validation with a
   readable reason, persistence across a restart.

   NOT in test:fast (a child-process boot test); run via `npm run test:http`. */
'use strict';
const A = require('./_assert.js');
const http = require('http');
const { SidecarFixture } = require('./helpers/sidecar-fixture.js');
const HOST = '127.0.0.1';

const REPORT = 'TEAM REPORT: login form built by E1, checked against the brief, nothing unfinished.';

/* The scripted model. Which agent a request is for is read off the request itself:
   the MEMBER has no team_dispatch tool; the MANAGER has it and its system prompt carries the [TEAM MANAGER] brief; the LEAD
   has it without the brief. Each level dispatches on its first request and wraps up once a tool result is in its history. */
function startMock() {
  const requests = [];
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      if (req.url.indexOf('/models') >= 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ data: [{ id: 'test/model', context_length: 8000, pricing: { prompt: '0', completion: '0' }, supported_parameters: ['tools'] }] }));
      }
      if (req.url.indexOf('/chat/completions') < 0) { res.writeHead(404); return res.end(); }
      let raw = ''; req.on('data', d => { raw += d; }); req.on('end', () => {
        let b = {}; try { b = JSON.parse(raw); } catch (_) {}
        const tools = (b.tools || []).map(t => t.function && t.function.name);
        const sys = JSON.stringify((b.messages || []).filter(m => m.role === 'system'));
        const hasResult = (b.messages || []).some(m => m.role === 'tool');
        const level = tools.includes('team_dispatch') ? (sys.includes('[TEAM MANAGER]') ? 'manager' : 'lead') : 'member';
        requests.push({ level, tools, sys, messages: b.messages || [], hasResult });
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
        const call = (id, args) => {
          res.write('data: ' + JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id, type: 'function', function: { name: 'team_dispatch', arguments: JSON.stringify(args) } }] } }] }) + '\n\n');
          res.write('data: ' + JSON.stringify({ choices: [{ finish_reason: 'tool_calls', delta: {} }], usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 } }) + '\n\n');
        };
        const say = text => {
          res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: text } }] }) + '\n\n');
          res.write('data: ' + JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 } }) + '\n\n');
        };
        if (level === 'lead') hasResult ? say('Report received from the manager.') : call('c_lead', { workers: [{ agentId: 'foreman', prompt: 'Ship the login page.' }] });
        else if (level === 'manager') hasResult ? say(REPORT) : call('c_mgr', { workers: [{ agentId: 'e1', prompt: 'Build the login form.' }, { agentId: 'outsider', prompt: 'Not on this team.' }] });
        else say('login form built');
        res.write('data: [DONE]\n\n'); res.end();
      });
    });
    server.listen(0, HOST, () => resolve({ server, requests, base: 'http://' + HOST + ':' + server.address().port + '/api/v1' }));
  });
}

(async () => {
  const mock = await startMock();
  const fixture = SidecarFixture.create({ prefix: 'sk-teams-', env: {
    SKYNET_OPENROUTER_BASE: mock.base, STARNET_OPENROUTER_BASE: mock.base,
    SKYNET_OPENROUTER_KEY: 'sk-or-v1-local-proof', STARNET_OPENROUTER_KEY: 'sk-or-v1-local-proof',
    SKYNET_DEFAULT_MODEL: 'test/model', STARNET_DEFAULT_MODEL: 'test/model',
    SKYNET_FULL_ACCESS: '1', STARNET_FULL_ACCESS: '1'
  } });
  try {
    await fixture.start();
    // the fixture may come back on another port or token after a restart, so read both fresh on every call
    const hdr = () => ({ 'Content-Type': 'application/json', 'X-StarNet-Token': fixture.token, Origin: fixture.baseUrl });
    const get = p => fetch(fixture.baseUrl + p, { headers: hdr() });
    const post = (p, body) => fetch(fixture.baseUrl + p, { method: 'POST', headers: hdr(), body: JSON.stringify(body) });
    const agent = (agentId, name) => ({ agentId, system: 'You are ' + name + '.', name, model: 'test/model' });
    A.eq((await post('/api/roster', { agents: [agent('agent', 'ULTRON'), agent('foreman', 'FOREMAN'), agent('e1', 'E1'), agent('e2', 'E2'), agent('outsider', 'OUTSIDER')] })).status, 200, 'the crew is on the roster');

    // ---- /api/teams: refuses with a reason, accepts a good list, survives a restart ----
    A.eq((await (await get('/api/teams')).json()).teams, [], 'no teams to start');
    const bad = await post('/api/teams', { teams: [{ id: 'eng', name: 'Engineering', managerId: 'foreman', memberIds: ['ghost'] }] });
    const badJson = await bad.json();
    A.ok(bad.status === 400 && /ghost is not on your crew/.test(badJson.error), 'a member who is not on the crew is refused with the reason');
    const twice = await post('/api/teams', { teams: [{ id: 'a', name: 'A', managerId: 'foreman', memberIds: ['e1'] }, { id: 'b', name: 'B', managerId: 'foreman', memberIds: ['e2'] }] });
    A.ok(twice.status === 400 && /already leads/.test((await twice.json()).error), 'a manager leads one team');
    const ultron = await post('/api/teams', { teams: [{ id: 'u', name: 'U', managerId: 'agent', memberIds: ['e1'] }] });
    A.ok(ultron.status === 400 && /Ultron/.test((await ultron.json()).error), 'Ultron cannot manage a team');
    const good = await post('/api/teams', { teams: [{ id: 'eng', name: 'Engineering', managerId: 'foreman', memberIds: ['e1', 'e2'], emoji: '🛠', color: '#33aaff', instructions: 'Always write tests first.', budgetUsd: 3 }] });
    const goodJson = await good.json();
    A.ok(good.status === 200 && goodJson.ok && goodJson.teams[0].budgetUsd === 3 && goodJson.teams[0].color === '#33aaff', 'a good team saves with its look, orders and spend limit');
    await fixture.restart();
    const after = await (await get('/api/teams')).json();
    A.eq(after.teams.map(t => t.id), ['eng'], 'teams survive a sidecar restart');
    await post('/api/roster', { agents: [agent('agent', 'ULTRON'), agent('foreman', 'FOREMAN'), agent('e1', 'E1'), agent('e2', 'E2'), agent('outsider', 'OUTSIDER')] });

    // ---- Ultron -> manager -> member -> back up ----
    const res = await post('/api/run', { key: 'sk-or-v1-fake', model: 'test/model', agentId: 'agent', isTask: true, messages: [{ role: 'user', content: 'Have the engineering team ship the login page.' }] });
    A.eq(res.status, 200, 'POST /api/run streams');
    const events = (await res.text()).trim().split('\n').filter(Boolean).map(s => { try { return JSON.parse(s); } catch (_) { return null; } }).filter(Boolean);
    const leadEnd = events.filter(e => e.name === 'agent.run.end' && e.payload && e.payload.agentId === 'agent').pop();
    A.ok(leadEnd && leadEnd.payload.reason === 'done', 'Ultron\'s run completes');

    const by = lvl => mock.requests.filter(r => r.level === lvl);
    const lead = by('lead'), mgr = by('manager'), mem = by('member');
    A.ok(lead.length >= 2 && mgr.length >= 2 && mem.length >= 1, 'all three levels ran (lead ' + lead.length + ', manager ' + mgr.length + ', member ' + mem.length + ')');
    A.ok(/MANAGER of the Engineering team/.test(lead[0].sys), 'Ultron\'s briefing marks the Engineering manager');
    if (mgr.length) {
      A.ok(mgr[0].tools.includes('team_dispatch'), 'the manager was lent team.dispatch');
      A.ok(!mgr[0].tools.some(n => /summon|spawn|routine/.test(String(n))), 'the manager was lent nothing else of the orchestrator (no summon, spawn or routines)');
      A.ok(/Always write tests first/.test(mgr[0].sys) && /CONTENT CHECK/.test(mgr[0].sys), 'the manager carries the team\'s standing orders and the content-check brief');
      A.ok(/e1/.test(mgr[0].sys) && !/outsider/.test(mgr[0].sys), 'the manager\'s crew list is its own members only');
      const toolText = JSON.stringify(mgr[mgr.length - 1].messages.filter(m => m.role === 'tool'));
      A.ok(/outsider/.test(toolText) && /no such live worker/.test(toolText), 'dispatching outside the team was refused');
      A.ok(/login form built/.test(toolText), 'the member\'s work came back to the manager');
    }
    if (mem.length) A.ok(!mem[0].tools.includes('team_dispatch'), 'a member can never delegate again');
    const leadBack = JSON.stringify(lead[lead.length - 1].messages.filter(m => m.role === 'tool'));
    A.ok(leadBack.includes('TEAM REPORT'), 'the manager\'s report is what Ultron receives');
  } catch (e) {
    e.message += '\nsidecar output:\n' + fixture.output();
    throw e;
  } finally {
    await fixture.dispose();
    if (mock.server.closeAllConnections) mock.server.closeAllConnections();
    await new Promise(r => mock.server.close(r));
  }
  A.report();
})().catch(e => { console.error(e); process.exit(1); });
