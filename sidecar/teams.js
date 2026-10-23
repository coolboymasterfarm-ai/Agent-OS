/* sidecar/teams.js — TEAMS: a manager agent leads a few specialists. Pure helpers, no I/O.

   Ultron hands a project to a MANAGER with team.dispatch. That manager (and only a manager) may then dispatch to
   its own members, check what comes back, and report one answer up to Ultron. Depth is capped at two by
   construction: orchestration.js grants a manager team.dispatch only when the dispatcher is not itself a manager,
   so a member can never delegate again and teams can never nest.

   A team: { id, name, managerId, memberIds, emoji, color, instructions, budgetUsd }. An agent may sit on any number
   of teams; a manager leads exactly one. budgetUsd 0 = no team cap (the per-worker cap applies as always). */
'use strict';

const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const LEAD_ID = 'agent';   // Ultron: never a manager, never a member
const MAX_TEAMS = 24, MAX_MEMBERS = 20, MAX_BUDGET_USD = 1000;

const text = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
function budgetOf(v) { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.min(MAX_BUDGET_USD, Math.round(n * 100) / 100) : 0; }

/* normalizeTeams(raw) -> [team]
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
      .filter(m => ID_RE.test(m) && m !== managerId && m !== LEAD_ID))].slice(0, MAX_MEMBERS);
    if (!memberIds.length) continue;
    ids.add(id); managers.add(managerId);
    out.push({
      id, name: text(t.name, 60) || id, managerId, memberIds,
      emoji: text(t.emoji, 8), color: HEX_RE.test(String(t.color || '')) ? String(t.color).toLowerCase() : '',
      instructions: text(t.instructions, 2000), budgetUsd: budgetOf(t.budgetUsd)
    });
  }
  return out;
}

/* checkTeams(raw, knownIds) -> { ok: true, teams } | { ok: false, error }
   The strict gate for a save from the TEAMS window: where normalizeTeams quietly drops a team that cannot work, this says
   which one and why, so the Commander can fix it. knownIds: Set of live roster agent ids. */
function checkTeams(raw, knownIds) {
  if (!Array.isArray(raw)) return { ok: false, error: 'teams must be a list' };
  if (raw.length > MAX_TEAMS) return { ok: false, error: 'at most ' + MAX_TEAMS + ' teams' };
  const known = knownIds && typeof knownIds.has === 'function' ? knownIds : { has: () => true };
  const ids = new Set(), leads = new Map();
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i];
    if (!t || typeof t !== 'object') return { ok: false, error: 'team ' + (i + 1) + ' is not a team' };
    const label = text(t.name, 60) || 'team ' + (i + 1);
    if (!text(t.name, 60)) return { ok: false, error: 'team ' + (i + 1) + ' needs a name' };
    if (!ID_RE.test(String(t.id || ''))) return { ok: false, error: label + ' has a bad id' };
    if (ids.has(t.id)) return { ok: false, error: 'two teams share the id ' + t.id };
    ids.add(t.id);
    const m = String(t.managerId || '');
    if (!ID_RE.test(m)) return { ok: false, error: label + ' needs a manager' };
    if (m === LEAD_ID) return { ok: false, error: label + ': Ultron hands out projects and cannot manage a team' };
    if (!known.has(m)) return { ok: false, error: label + ': the manager is not on your crew' };
    if (leads.has(m)) return { ok: false, error: m + ' already leads the ' + leads.get(m) + ' team; a manager leads one team' };
    leads.set(m, label);
    const members = [...new Set((Array.isArray(t.memberIds) ? t.memberIds : []).map(String).filter(x => x !== m))];
    if (!members.length) return { ok: false, error: label + ' needs at least one member besides its manager' };
    if (members.length > MAX_MEMBERS) return { ok: false, error: label + ' has more than ' + MAX_MEMBERS + ' members' };
    for (const x of members) {
      if (!ID_RE.test(x) || x === LEAD_ID) return { ok: false, error: label + ' has an invalid member' };
      if (!known.has(x)) return { ok: false, error: label + ': ' + x + ' is not on your crew' };
    }
    if (t.budgetUsd != null && t.budgetUsd !== '' && !(Number(t.budgetUsd) >= 0 && Number(t.budgetUsd) <= MAX_BUDGET_USD)) return { ok: false, error: label + ': the spend limit must be between 0 and ' + MAX_BUDGET_USD + ' dollars' };
  }
  return { ok: true, teams: normalizeTeams(raw) };
}

const teamOfManager = (teams, agentId) => (Array.isArray(teams) ? teams : []).find(t => t.managerId === agentId) || null;

// the roster a manager can see: its own members, nobody else
function scopeRoster(roster, memberIds) {
  const keep = new Set(memberIds || []);
  return new Map([...roster].filter(([id]) => keep.has(id)));
}

/* A team's spend limit covers the manager and every member: each run gets an equal slice, so the worst case is the limit.
   0 = no team cap. */
const perRunUsd = team => (team && team.budgetUsd > 0 ? Math.round((team.budgetUsd / (team.memberIds.length + 1)) * 10000) / 10000 : 0);

// appended to a manager's system prompt for the run Ultron hands it
function managerBrief(team) {
  return '[TEAM MANAGER] You lead the ' + team.name + ' team for the lead agent, who handed you this project; you answer for it end to end.\n'
    + '1. Split the project into separate pieces and give each to a member of YOUR TEAM with team.dispatch. Only your own members are reachable.\n'
    + '2. CONTENT CHECK before anything goes up: read every result against the brief. Work that is missing, off-target or unsourced goes back to that member once with specific fixes; whatever still falls short is reported as unfinished, never as done.\n'
    + '3. Your final message is the report to the lead: what was delivered and where the files are, what you checked, and anything unfinished.'
    + (team.instructions ? '\n\nTEAM STANDING ORDERS (from the Commander, for every project this team takes):\n' + team.instructions : '');
}

module.exports = { normalizeTeams, checkTeams, teamOfManager, scopeRoster, perRunUsd, managerBrief, LEAD_ID };
