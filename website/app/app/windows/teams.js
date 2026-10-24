/* AGENT OS — windows/teams.js : the TEAMS window. Loads AFTER stationui.js (see index.html) and registers itself via
   StationUI.registerWindow.

   A team is a manager plus members the Commander picks from the crew: Ultron hands the manager a whole project, the
   manager splits it across the members, content-checks their work and reports back (sidecar/teams.js, docs/TEAMS_PLAN.md).
   The whole list is read from and saved to /api/teams; the sidecar refuses a team that cannot work and says why, and this
   window shows that reason verbatim. An agent may sit on any number of teams; a manager leads one. */
'use strict';
(() => {
  if (typeof StationUI === 'undefined' || !StationUI.registerWindow) return;
  const esc = StationUI.h.esc;
  const HEX = /^#[0-9a-f]{6}$/i;
  const LEAD_ID = 'agent';   // Ultron hands out projects; never a manager or a member

  const slug = (name, taken) => {
    const base = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'team';
    let id = base, n = 2;
    while (taken.has(id)) id = base + '-' + (n++);
    return id;
  };

  function buildTeams(body) {
    let teams = [], editing = null, loading = true, msg = '', busy = false;   // editing: null | { team?, draft }

    const crew = () => (StationUI.h.present || []).filter(a => a && a.id && a.id !== LEAD_ID);
    const nameOf = id => { const a = (StationUI.h.present || []).find(x => x && x.id === id); return a ? (a.name || id) : id; };
    const onCrew = id => (StationUI.h.present || []).some(x => x && x.id === id);

    const badge = t => '<span class="tm-badge" style="display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:26px;padding:0 4px;border-radius:6px;'
      + (HEX.test(t.color) ? 'background:' + t.color + '33;border:1px solid ' + t.color + ';' : 'border:1px solid var(--ph-dim);') + '">' + esc(t.emoji || '◈') + '</span>';

    const chip = id => '<span class="gx-tag" style="margin:2px 4px 2px 0;' + (onCrew(id) ? '' : 'opacity:.55;') + '">' + esc(nameOf(id)) + (onCrew(id) ? '' : ' (gone)') + '</span>';

    const teamCard = t =>
      '<div class="gx-tro on" data-team="' + esc(t.id) + '">'
      + '<div class="tro-hd">' + badge(t) + '<span class="nm" style="margin-left:8px;">' + esc(t.name) + '</span>'
      + '<span class="gx-tag">' + (t.memberIds.length + 1) + ' AGENTS</span>'
      + (t.budgetUsd > 0 ? '<span class="gx-tag">$' + esc(t.budgetUsd) + ' LIMIT</span>' : '') + '</div>'
      + '<div class="sub" style="margin:6px 0 2px;">MANAGER &middot; ' + chip(t.managerId) + '</div>'
      + '<div class="sub" style="margin:2px 0;">MEMBERS &middot; ' + t.memberIds.map(chip).join('') + '</div>'
      + (t.instructions ? '<div class="sub dim" style="margin:4px 0;white-space:pre-wrap;">' + esc(t.instructions.length > 160 ? t.instructions.slice(0, 160) + '…' : t.instructions) + '</div>' : '')
      + '<div style="margin-top:8px;display:flex;gap:8px;"><button type="button" class="bb xs" data-edit="' + esc(t.id) + '">EDIT</button>'
      + '<button type="button" class="bb xs" data-del="' + esc(t.id) + '">DELETE</button></div></div>';

    function formHtml() {
      const d = editing.draft, c = crew();
      const mgr = c.map(a => '<option value="' + esc(a.id) + '"' + (a.id === d.managerId ? ' selected' : '') + '>' + esc(a.name || a.id) + '</option>').join('');
      const mem = c.map(a => '<label style="display:flex;align-items:center;gap:8px;margin:3px 0;"><input type="checkbox" data-member="' + esc(a.id) + '"'
        + (d.memberIds.includes(a.id) && a.id !== d.managerId ? ' checked' : '') + (a.id === d.managerId ? ' disabled' : '') + '> ' + esc(a.name || a.id) + '</label>').join('');
      return '<div class="gx-sec"><span class="gx-title">' + (editing.team ? 'EDIT TEAM' : 'NEW TEAM') + '</span></div>'
        + '<div id="tm-form">'
        + '<label class="sn-menu-field">Name<input id="tm-name" class="key-input" maxlength="60" autocomplete="off" placeholder="e.g. Launch crew" value="' + esc(d.name) + '"></label>'
        + '<div style="display:flex;gap:12px;flex-wrap:wrap;">'
        + '<label class="sn-menu-field">Emoji<input id="tm-emoji" class="key-input" maxlength="8" autocomplete="off" placeholder="🚀" style="width:90px;" value="' + esc(d.emoji) + '"></label>'
        + '<label class="sn-menu-field">Color<input id="tm-color" type="color" value="' + esc(HEX.test(d.color) ? d.color : '#ffaa33') + '" style="width:64px;height:40px;"></label>'
        + '<label class="sn-menu-field">Spend limit per project ($)<input id="tm-budget" class="key-input" type="number" min="0" max="1000" step="0.5" placeholder="none" style="width:130px;" value="' + (d.budgetUsd > 0 ? esc(d.budgetUsd) : '') + '"></label>'
        + '</div>'
        + '<label class="sn-menu-field">Manager<select id="tm-manager" class="key-input"><option value="">— pick a manager —</option>' + mgr + '</select></label>'
        + '<div class="sn-menu-field">Members<div id="tm-members" style="max-height:220px;overflow:auto;">' + (mem || '<span class="dim">no agents yet — recruit one below</span>') + '</div></div>'
        + '<label class="sn-menu-field">Team instructions<textarea id="tm-instr" class="key-input" rows="4" maxlength="2000" placeholder="Standing orders the manager follows for every project: tone, rules, what done means.">' + esc(d.instructions) + '</textarea></label>'
        + '<div id="tm-err" class="dim" style="color:var(--bad);min-height:18px;">' + esc(msg) + '</div>'
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">'
        + '<button type="button" class="bb" id="tm-save"' + (busy ? ' disabled' : '') + '>' + (busy ? 'SAVING…' : 'SAVE TEAM') + '</button>'
        + '<button type="button" class="bb" id="tm-cancel">CANCEL</button>'
        + '<button type="button" class="bb" id="tm-recruit">＋ RECRUIT A NEW AGENT</button></div></div>';
    }

    function paint() {
      const list = loading ? '<p class="dim">loading teams…</p>'
        : teams.length ? '<div class="gx-tros">' + teams.map(teamCard).join('') + '</div>'
        : '<p class="dim" style="font-style:italic;">no teams yet — make one and Ultron can hand it a whole project.</p>';
      body.innerHTML = '<div class="gx">'
        + '<div class="dim" style="margin:2px 0 10px;">Ultron briefs a team&rsquo;s manager on a project. The manager splits it across the team, checks the work, and reports back to Ultron when it is all done. An agent can be on any number of teams; a manager leads one.</div>'
        + (editing ? formHtml()
          : '<div class="gx-sec"><span class="gx-title">TEAMS</span> <span class="gx-tag">' + teams.length + '</span>'
            + ' <button type="button" class="bb xs" id="tm-new" style="margin-left:auto;">＋ NEW TEAM</button></div>' + (msg ? '<div class="dim" style="color:var(--bad);margin:4px 0;">' + esc(msg) + '</div>' : '') + list)
        + '</div>';
    }

    const api = async (method, payload) => {
      const r = await fetch('/api/teams', { method, headers: { 'Content-Type': 'application/json' }, body: payload ? JSON.stringify(payload) : undefined });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.ok === false) throw new Error(j.error || 'could not save teams');
      return j;
    };
    const saveAll = async next => { const j = await api('POST', { teams: next }); teams = j.teams || next; };

    function readDraft() {
      const q = id => body.querySelector(id);
      const memberIds = [...body.querySelectorAll('[data-member]')].filter(x => x.checked && !x.disabled).map(x => x.dataset.member);
      return {
        name: (q('#tm-name').value || '').trim(), emoji: (q('#tm-emoji').value || '').trim(), color: q('#tm-color').value,
        budgetUsd: q('#tm-budget').value === '' ? 0 : Number(q('#tm-budget').value), managerId: q('#tm-manager').value, memberIds,
        instructions: (q('#tm-instr').value || '').trim()
      };
    }

    body.onclick = async ev => {
      const t = ev.target && ev.target.closest && ev.target.closest('button');
      if (!t || busy) return;
      if (t.id === 'tm-new') { msg = ''; editing = { team: null, draft: { name: '', emoji: '', color: '', budgetUsd: 0, managerId: '', memberIds: [], instructions: '' } }; return paint(); }
      if (t.dataset.edit) { const team = teams.find(x => x.id === t.dataset.edit); if (!team) return; msg = ''; editing = { team, draft: Object.assign({}, team, { memberIds: team.memberIds.slice() }) }; return paint(); }
      if (t.id === 'tm-cancel') { msg = ''; editing = null; return paint(); }
      if (t.id === 'tm-recruit') { if (editing) editing.draft = readDraft(); if (typeof App !== 'undefined' && App.openSummonBay) { try { App.openSummonBay(); } catch (_) {} } return; }
      if (t.dataset.del) {
        const team = teams.find(x => x.id === t.dataset.del); if (!team) return;
        if (t.dataset.armed !== '1') { t.dataset.armed = '1'; t.textContent = 'DELETE ' + team.name.toUpperCase() + '?'; return; }   // two clicks: nothing is removed by one stray tap
        busy = true;
        try { await saveAll(teams.filter(x => x.id !== team.id)); msg = ''; } catch (e) { msg = e.message; }
        busy = false; return paint();
      }
      if (t.id === 'tm-save') {
        const d = readDraft();
        const taken = new Set(teams.filter(x => !editing.team || x.id !== editing.team.id).map(x => x.id));
        const next = Object.assign({}, editing.team || {}, d, { id: editing.team ? editing.team.id : slug(d.name, taken) });
        const all = editing.team ? teams.map(x => x.id === editing.team.id ? next : x) : teams.concat(next);
        editing.draft = d; busy = true; msg = ''; paint();
        try { await saveAll(all); editing = null; msg = ''; } catch (e) { msg = e.message; }
        busy = false; return paint();
      }
    };
    // choosing a manager takes them off the member list (a manager is never its own member)
    body.onchange = ev => {
      const t = ev.target;
      if (!t || t.id !== 'tm-manager') return;
      body.querySelectorAll('[data-member]').forEach(x => { const isMgr = x.dataset.member === t.value; x.disabled = isMgr; if (isMgr) x.checked = false; });
    };

    paint();
    fetch('/api/teams').then(r => { if (!r.ok) throw new Error('teams unavailable'); return r.json(); }).then(j => { teams = Array.isArray(j.teams) ? j.teams : []; })
      .catch(() => { msg = 'could not load teams'; })
      .finally(() => { loading = false; if (!editing) paint(); });
  }

  StationUI.registerWindow('teams', 'TEAMS', buildTeams, {});
})();
