/* sidecar/teams.js — TEAMS: a manager agent leads a few specialists. Pure helpers, no I/O.

   Ultron hands a project to a MANAGER with team.dispatch. That manager (and only a manager) may then dispatch to
   its own members, check what comes back, and report one answer up to Ultron. Depth is capped at two by
   construction: orchestration.js grants a manager team.dispatch only when the dispatcher is not itself a manager,
   so a member can never delegate again and teams can never nest. */
'use strict';

const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const LEAD_ID = 'agent';   // Ultron: never a manager, never a member

/* normalizeTeams(raw) -> [{ id, name, managerId, memberIds }]
   Accepts the on-disk { teams: [...] } or a bare array. Drops what cannot work instead of throwing: bad ids,
   duplicate team ids, a second team for the same manager, a team with no members. A manager is never its own
   member, and Ultron is never on a team. */
function normalizeTeams(raw) {
  const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.teams) ? raw.teams : []);
  const out = [], ids = new Set(), managers = new Set();
  for (const t of list) {
    if (!t || typeof t !== 'object') continue;
    const id = String(t.id || '').trim(), managerId = String(t.managerId || '').trim();
    if (!ID_RE.test(id) || !ID_RE.test(managerId) || managerId === LEAD_ID || ids.has(id) || managers.has(managerId)) continue;
    const memberIds = [...new Set((Array.isArray(t.memberIds) ? t.memberIds : []).map(String)
      .filter(m => ID_RE.test(m) && m !== managerId && m !== LEAD_ID))].slice(0, 20);
    if (!memberIds.length) continue;
    ids.add(id); managers.add(managerId);
    out.push({ id, name: String(t.name || '').trim().slice(0, 60) || id, managerId, memberIds });
  }
  return out;
}

const teamOfManager = (teams, agentId) => (Array.isArray(teams) ? teams : []).find(t => t.managerId === agentId) || null;

// the roster a manager can see: its own members, nobody else
function scopeRoster(roster, memberIds) {
  const keep = new Set(memberIds || []);
  return new Map([...roster].filter(([id]) => keep.has(id)));
}

// appended to a manager's system prompt for the run Ultron hands it
function managerBrief(team) {
  return '[TEAM MANAGER] You lead the ' + team.name + ' team for the lead agent, who handed you this project; you answer for it end to end.\n'
    + '1. Split the project into separate pieces and give each to a member of YOUR TEAM with team.dispatch. Only your own members are reachable.\n'
    + '2. CONTENT CHECK before anything goes up: read every result against the brief. Work that is missing, off-target or unsourced goes back to that member once with specific fixes; whatever still falls short is reported as unfinished, never as done.\n'
    + '3. Your final message is the report to the lead: what was delivered and where the files are, what you checked, and anything unfinished.';
}

module.exports = { normalizeTeams, teamOfManager, scopeRoster, managerBrief, LEAD_ID };
