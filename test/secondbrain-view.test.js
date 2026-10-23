/* node test/secondbrain-view.test.js — THE BRAIN'S ANATOMY: every crew member gets a lobe, and every seat is inside it.
   The view itself is canvas; what can be wrong without a browser is the mapping and the geometry, so that is what this
   pins: the stock 25-agent crew lands on real teams (none dumped into CREW), Ultron is the core, each team has its
   lead, and placeAgents() never seats a neuron outside the skull. */
'use strict';
const assert = require('assert');
const SB = require('../frontend/app/secondbrain.js');
const A = SB._anatomy;

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };

// every anchor sits inside the volume it claims
for (const [k, T] of Object.entries(A.TEAMS)) ok(A.inside(T.anchor[0], T.anchor[1], T.anchor[2]), k + ' anchor is inside the brain');
ok(A.inCerebellum(A.KNOWLEDGE.anchor[0], A.KNOWLEDGE.anchor[1], A.KNOWLEDGE.anchor[2]), 'knowledge anchor is inside the cerebellum');
ok(!A.inside(2, 0, 0) && !A.inside(0, 2, 0) && !A.inside(0, 0, 2), 'far points are outside');

// the stock crew (ids as the roster stores them)
const crew = {
  agent: 'ultron', strategist: 'product', drafter: 'product', researcher: 'product',
  foreman: 'engineering', engineer: 'engineering', 'engineer-2': 'engineering', 'engineer-3': 'engineering', 'engineer-4': 'engineering', 'engineer-5': 'engineering', 'engineer-6': 'engineering',
  webdesigner: 'design', 'webdesigner-2': 'design', 'webdesigner-3': 'design',
  apptester: 'qa', 'apptester-2': 'qa', 'apptester-3': 'qa', 'apptester-4': 'qa',
  marketer: 'growth', copywriter: 'growth', 'copywriter-2': 'growth', 'copywriter-3': 'growth', writer: 'growth',
  support: 'support', 'support-2': 'support'
};
ok(Object.keys(crew).length === 25, 'the stock crew is 25 agents');
for (const [id, team] of Object.entries(crew)) ok(A.teamOf(id, id === 'agent' ? 'ULTRON' : id.toUpperCase()) === team, id + ' → ' + team);
ok(A.teamOf('agent', 'SOMEONE') === 'ultron', 'the stock core id is Ultron whatever it is named');
ok(A.teamOf('my-custom-bot', 'Custom') === 'crew', 'an unknown agent lands in CREW, never lost');
ok(A.teamOf('x', 'Ultron Prime') === 'ultron', 'a renamed Ultron is still the core');
const leads = Object.keys(crew).filter(A.isLead);
ok(leads.length === 6, 'six team leads');
ok(new Set(leads.map(id => crew[id])).size === 6, 'one lead per team');

// placement: every seat inside, Ultron and each lead on their anchor
const agents = Object.keys(crew).map(id => ({ agentId: id, team: crew[id], lead: A.isLead(id) || crew[id] === 'ultron', x: 0, y: 0, z: 0 }));
A.placeAgents(agents);
for (const a of agents) ok(A.inside(a.x, a.y, a.z), a.agentId + ' is seated inside the brain');
for (const a of agents.filter(x => x.lead)) {
  const anc = A.TEAMS[a.team].anchor;
  ok(Math.hypot(a.x - anc[0], a.y - anc[1], a.z - anc[2]) < 1e-9, a.agentId + ' sits at the heart of its lobe');
}
const seats = new Set(agents.map(a => a.x.toFixed(4) + ',' + a.y.toFixed(4) + ',' + a.z.toFixed(4)));
ok(seats.size === agents.length, 'no two agents share a seat');

console.log('secondbrain-view.test: OK (' + n + ' assertions)');
