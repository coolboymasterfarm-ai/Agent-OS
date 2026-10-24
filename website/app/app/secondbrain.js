/* Agent OS — app/secondbrain.js : THE LIVE BRAIN.

   What this draws. Every agent on the station keeps a durable notebook, and recall ranks that notebook when its
   owner works. What nobody could SEE was the whole thing at once: which agent knows what, which beliefs the crew
   actually shares, which lessons are cold, and — live — the moment a run teaches the station something new or a
   belief is recalled into a prompt.

   This view is that window, drawn as one holographic brain you can orbit:
     · the WHOLE CREW is wired in — Ultron at the core, every team in its own lobe (product in the frontal lobe,
       engineering across the parietal, design at the back where vision lives, growth on the language side, QA on
       the other temporal lobe, support at the frontal base). Leads sit at the heart of their lobe, crew around them,
       and the chain of command is drawn as axons: Ultron → each lead → each crew member.
     · every BELIEF orbits the agent that holds it; a lesson two agents share is pulled toward the border between
       their lobes, and that cross-agent link is drawn as a bright fibre through the white matter.
     · imported graphify / basemode knowledge lives in the cerebellum — reference, visibly not belief.
     · projects and workstreams ring the core.

   It reads the unified graph (GET /api/secondbrain/graph) and rides the SAME EventSource the rest of the station
   listens to (world.js re-emits every server channel event onto U.bus). Nothing here invents telemetry: a spark on
   the canvas is a real memory.write / memory.used / memory.proposed / memory.forget / run event that arrived over
   SSE, a probe, or a reflect pass. The shell's slow breathing and the rotation are decoration and look like it.

   Self-contained on purpose: it injects its own CSS and owns its own canvas + RAF loop, so mounting it is one line
   and removing it leaves no residue. Pure Canvas 2D — no WebGL, no dependency. */
'use strict';

const SecondBrain = (() => {
  const MAX_NODES = 700;            // canvas budget: past this the view samples and SAYS it sampled
  const REFRESH_DEBOUNCE = 1200;    // a burst of writes repaints once, not per record
  const ICE = '#8fc8ff';            // the shell's base light
  const FONT = "VT323, 'Share Tech Mono', monospace";

  // ---- THE CREW → THE ANATOMY ---------------------------------------------------------------------------------
  // Brain space: X runs back(-) → front(+), Y down(-) → up(+), Z left(-) → right(+). The cerebrum is a deformed
  // ellipsoid with semi-axes ~(1, .72, .8). Every anchor below is inside it (test/secondbrain-view.test.js checks).
  const TEAMS = {
    ultron:      { label: 'ULTRON',      region: 'CORE · command',             color: '#ff3355', anchor: [0, 0.02, 0],       spread: 0 },
    product:     { label: 'PRODUCT',     region: 'FRONTAL LOBE · planning',     color: '#b48cff', anchor: [0.62, 0.3, 0],     spread: 0.2 },
    engineering: { label: 'ENGINEERING', region: 'PARIETAL LOBE · building',    color: '#2ee6ff', anchor: [-0.12, 0.44, 0],   spread: 0.27 },
    design:      { label: 'DESIGN',      region: 'OCCIPITAL LOBE · vision',     color: '#ff5fd2', anchor: [-0.72, 0.12, 0],   spread: 0.17 },
    qa:          { label: 'QA',          region: 'RIGHT TEMPORAL · detection',  color: '#9dff5c', anchor: [0.08, -0.2, 0.5],  spread: 0.19, flat: true },
    growth:      { label: 'GROWTH',      region: 'LEFT TEMPORAL · language',    color: '#ff9a3c', anchor: [0.08, -0.2, -0.5], spread: 0.21, flat: true },
    support:     { label: 'SUPPORT',     region: 'FRONTAL BASE · care',         color: '#3dffb5', anchor: [0.58, -0.17, 0],   spread: 0.13 },
    crew:        { label: 'CREW',        region: 'ASSOCIATION CORTEX',          color: '#9fb4d9', anchor: [-0.36, 0.04, 0],   spread: 0.22 }
  };
  const TEAM_ORDER = ['ultron', 'product', 'engineering', 'design', 'qa', 'growth', 'support', 'crew'];
  const KNOWLEDGE = { color: '#7c7bff', anchor: [-0.64, -0.5, 0], region: 'CEREBELLUM · graphify + basemode' };
  const CORE = [0, 0.02, 0];
  const PROJECT_COLOR = '#e6f0ff';
  // the station's stock crew ids → their team. A custom agent this table does not know lands in CREW, never lost.
  const BASE_TEAM = {
    agent: 'ultron', ultron: 'ultron',
    strategist: 'product', drafter: 'product', researcher: 'product',
    foreman: 'engineering', engineer: 'engineering',
    webdesigner: 'design', apptester: 'qa',
    marketer: 'growth', copywriter: 'growth', writer: 'growth',
    support: 'support'
  };
  const LEADS = { strategist: 1, foreman: 1, webdesigner: 1, apptester: 1, marketer: 1, support: 1 };
  function teamOf(agentId, label) {
    if (/\bultron\b/i.test(String(label || ''))) return 'ultron';
    const base = String(agentId || '').toLowerCase().replace(/-\d+$/, '');
    return BASE_TEAM[base] || 'crew';
  }
  function isLead(agentId) { return LEADS[String(agentId || '').toLowerCase()] === 1; }

  // ---- geometry (pure) ----
  const BA = 1.0, BB = 0.72, BC = 0.8;
  function cerebrumN(x, y, z) {
    const by = y < 0 ? BB * 0.8 : BB, cz = BC * (1 - 0.1 * x);
    return (x / BA) * (x / BA) + (y / by) * (y / by) + (z / cz) * (z / cz);
  }
  function cerebellumN(x, y, z) {
    const a = (x + 0.64) / 0.3, b = (y + 0.5) / 0.19, c = z / 0.46;
    return a * a + b * b + c * c;
  }
  function inside(x, y, z) { return cerebrumN(x, y, z) < 0.8 || cerebellumN(x, y, z) < 0.8; }
  function inCerebellum(x, y, z) { return cerebellumN(x, y, z) < 0.8; }
  // walk p toward home until it is inside the given volume (home is always inside)
  function contain(p, home, test) {
    for (let i = 0; i < 12 && !test(p.x, p.y, p.z); i++) {
      p.x += (home[0] - p.x) * 0.22; p.y += (home[1] - p.y) * 0.22; p.z += (home[2] - p.z) * 0.22;
    }
  }
  function fib(i, n) {     // evenly spread unit vectors (fibonacci sphere) — deterministic, no clumps
    const y = 1 - ((i + 0.5) / n) * 2, r = Math.sqrt(Math.max(0, 1 - y * y)), t = i * 2.399963229728653;
    return [Math.cos(t) * r, y, Math.sin(t) * r];
  }

  // seat every agent: Ultron at the core, each lead at the heart of its lobe, crew spread around their lead.
  function placeAgents(agents) {
    const byTeam = {};
    for (const a of agents) (byTeam[a.team] = byTeam[a.team] || []).push(a);
    for (const team of Object.keys(byTeam)) {
      const T = TEAMS[team] || TEAMS.crew, anc = T.anchor;
      const list = byTeam[team].slice().sort((a, b) => (b.lead - a.lead) || String(a.agentId).localeCompare(String(b.agentId)));
      const hasLead = list.length && list[0].lead;
      const crew = hasLead ? list.slice(1) : list;
      if (hasLead) { list[0].x = anc[0]; list[0].y = anc[1]; list[0].z = anc[2]; }
      const m = crew.length;
      crew.forEach((a, j) => {
        if (team === 'ultron' && j === 0 && !hasLead) { a.x = anc[0]; a.y = anc[1]; a.z = anc[2]; return; }
        const d = fib(j, Math.max(m, 2));
        const s = T.spread || 0.12;
        a.x = anc[0] + d[0] * s * 1.15;
        a.y = anc[1] + d[1] * s * 0.75;
        a.z = anc[2] + d[2] * s * (T.flat ? 0.45 : 1.25);
        contain(a, anc, inside);
      });
    }
  }

  // ---- colour helpers ----
  function rgb(hex) {
    const h = String(hex || '#ffffff').replace('#', '');
    const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    return [parseInt(v.slice(0, 2), 16) || 0, parseInt(v.slice(2, 4), 16) || 0, parseInt(v.slice(4, 6), 16) || 0];
  }
  function mix(a, b, t) {
    const x = rgb(a), y = rgb(b);
    return 'rgb(' + Math.round(x[0] + (y[0] - x[0]) * t) + ',' + Math.round(x[1] + (y[1] - x[1]) * t) + ',' + Math.round(x[2] + (y[2] - x[2]) * t) + ')';
  }
  function rgba(hex, a) { const c = rgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  // ---- the shell: a point-cloud brain, built once ----
  // regions index the colour each shell point takes: the lobe nearest to it (lit only if that team is on the station)
  const REGIONS = ['product', 'engineering', 'design', 'qa', 'growth', 'support', 'knowledge', 'stem'];
  let SHELL = null;
  function buildShell() {
    if (SHELL) return SHELL;
    const pts = [];
    const lobeAnchors = REGIONS.slice(0, 6).map(k => TEAMS[k].anchor);
    const nearestLobe = (x, y, z) => {
      let best = 0, bd = Infinity;
      lobeAnchors.forEach((a, i) => { const d = (x - a[0]) ** 2 + (y - a[1]) ** 2 + (z - a[2]) ** 2; if (d < bd) { bd = d; best = i; } });
      return best;
    };
    const N1 = 4400;
    for (let i = 0; i < N1; i++) {
      const u = fib(i, N1);
      const midline = Math.abs(u[2]);
      if (midline < 0.03 && u[1] > -0.3) continue;                       // the longitudinal fissure: a dark seam
      const by = u[1] < 0 ? BB * 0.8 : BB, cz = BC * (1 - 0.1 * u[0]);
      // gyri: layered sines give folds without noise tables, and stay identical frame to frame
      let g = 1 + 0.042 * Math.sin(u[0] * 9 + 1.3) * Math.sin(u[1] * 11 + 0.4) * Math.sin(u[2] * 10 + 2.2)
        + 0.02 * Math.sin(u[0] * 23 + u[1] * 17) + 0.012 * Math.sin(u[2] * 31 + u[0] * 7);
      if (midline < 0.1 && u[1] > -0.3) g *= 0.95;                      // hemispheres roll in toward the fissure
      const x = u[0] * BA * g, y = u[1] * by * g, z = u[2] * cz * g;
      if (cerebellumN(x, y, z) < 0.9) continue;                         // the cerebellum draws its own skin
      pts.push(x, y, z, x / (BA * BA), y / (by * by), z / (cz * cz), nearestLobe(x, y, z));
    }
    const N2 = 1000;
    for (let i = 0; i < N2; i++) {
      const u = fib(i, N2);
      const g = 1 + 0.07 * Math.sin(u[1] * 34);                          // folia: fine horizontal ridges
      const x = -0.64 + u[0] * 0.3 * g, y = -0.5 + u[1] * 0.19 * g, z = u[2] * 0.46 * g;
      if (cerebrumN(x, y, z) < 0.92) continue;
      pts.push(x, y, z, u[0] / 0.3, u[1] / 0.19, u[2] / 0.46, 6);
    }
    const N3 = 260;
    for (let i = 0; i < N3; i++) {
      const t = (i % 26) / 25, a = Math.floor(i / 26) / 10 * Math.PI * 2 + t * 0.6;
      const r = 0.12 - 0.03 * t;
      const cx = -0.28 - 0.08 * t, cy = -0.42 - 0.55 * t;
      pts.push(cx + Math.cos(a) * r * 0.8, cy, Math.sin(a) * r, Math.cos(a), 0, Math.sin(a), 7);
    }
    // normalise normals in place
    for (let i = 0; i < pts.length; i += 7) {
      const l = Math.hypot(pts[i + 3], pts[i + 4], pts[i + 5]) || 1;
      pts[i + 3] /= l; pts[i + 4] /= l; pts[i + 5] /= l;
    }
    SHELL = new Float32Array(pts);
    return SHELL;
  }

  // ---- glow sprites, one per colour, cached ----
  const SPRITES = {};
  function sprite(color) {
    if (SPRITES[color]) return SPRITES[color];
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.14, rgba(color, 0.95));
    gr.addColorStop(0.4, rgba(color, 0.26));
    gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    SPRITES[color] = c;
    return c;
  }

  // ---- tiny DOM helpers ----
  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function num(n) { return Number(n) || 0; }
  function ago(ms) {
    const d = Date.now() - num(ms);
    if (!num(ms)) return '—';
    if (d < 45000) return 'just now';
    if (d < 3600000) return Math.round(d / 60000) + 'm ago';
    if (d < 86400000) return Math.round(d / 3600000) + 'h ago';
    return Math.round(d / 86400000) + 'd ago';
  }
  function shortId(id) { return String(id || '').replace(/^mem:/, '').replace(/^agent:/, ''); }
  function nice(label) { return String(label || '').trim() || '—'; }

  // ---- CSS: injected once, prefixed sb- so it never leaks into the rest of the station ----
  const CSS = `
.term.brain-win{width:calc(96vw * var(--sn-unzoom,1));max-width:calc(96vw * var(--sn-unzoom,1));height:var(--term-band,calc(90vh * var(--sn-unzoom,1)))}
.term.brain-win .term-body{flex:1 1 auto;min-height:0;padding:0;display:flex;overflow:hidden}
.term.brain-win .sb-wrap{flex:1 1 auto;height:auto;border-radius:0 0 var(--r-lg,10px) var(--r-lg,10px)}
.sb-wrap{--sb-ice:#8fc8ff;--sb-ink:#dcecff;--sb-dim:#7f93b0;--sb-glass:rgba(6,10,22,.78);--sb-edge:rgba(130,180,255,.16);
  position:relative;height:100%;min-height:560px;overflow:hidden;background:#02040a;color:var(--sb-ink);font-family:${FONT};
  font-size:16px;line-height:1.25;outline:none;user-select:none;isolation:isolate}
.sb-wrap:fullscreen{min-height:100vh}
.sb-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:grab;touch-action:none}
.sb-canvas.drag{cursor:grabbing}.sb-canvas.hot{cursor:pointer}
.sb-glass{background:var(--sb-glass);border:1px solid var(--sb-edge);border-radius:9px;
  box-shadow:0 10px 40px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.04)}
.sb-top{position:absolute;left:14px;top:12px;right:14px;display:flex;align-items:flex-start;gap:12px;pointer-events:none;z-index:3}
.sb-title{pointer-events:auto;padding:8px 14px 9px}
.sb-title h3{margin:0;font-size:26px;font-weight:400;letter-spacing:.2em;color:#fff;text-shadow:0 0 18px rgba(143,200,255,.55)}
.sb-title p{margin:1px 0 0;font-size:14px;letter-spacing:.12em;color:var(--sb-dim);text-transform:uppercase}
.sb-live{display:inline-block;width:7px;height:7px;border-radius:50%;background:#3dffb5;box-shadow:0 0 8px #3dffb5;margin-right:7px;vertical-align:2px;animation:sb-blink 2.4s infinite}
@keyframes sb-blink{0%,100%{opacity:1}50%{opacity:.3}}
.sb-stats{pointer-events:auto;display:flex;flex-wrap:wrap;gap:6px;flex:1 1 auto;justify-content:center;padding-top:4px}
.sb-chip{padding:5px 11px 4px;min-width:74px;text-align:center}
.sb-chip b{display:block;font-size:24px;font-weight:400;color:#fff;font-variant-numeric:tabular-nums;line-height:1}
.sb-chip span{display:block;font-size:12px;letter-spacing:.14em;color:var(--sb-dim);text-transform:uppercase}
.sb-tools{pointer-events:auto;display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;max-width:360px}
.sb-btn{font:inherit;font-size:15px;letter-spacing:.12em;text-transform:uppercase;padding:6px 11px 5px;border-radius:6px;cursor:pointer;
  border:1px solid rgba(143,200,255,.32);background:rgba(10,20,40,.55);color:#cfe6ff;transition:background .15s,border-color .15s,box-shadow .15s}
.sb-btn:hover{background:rgba(40,80,140,.45);border-color:rgba(143,200,255,.6)}
.sb-btn:focus-visible{outline:none;box-shadow:0 0 0 2px rgba(143,200,255,.7)}
.sb-btn:disabled{opacity:.45;cursor:default}
.sb-btn.on{background:rgba(46,230,255,.16);border-color:rgba(46,230,255,.6);color:#bff7ff}
.sb-btn.hero{border-color:rgba(255,51,85,.55);background:linear-gradient(90deg,rgba(255,51,85,.22),rgba(46,230,255,.16));color:#fff;box-shadow:0 0 18px rgba(255,51,85,.18)}
.sb-btn.hero:hover{box-shadow:0 0 26px rgba(255,51,85,.35)}
.sb-panel{position:absolute;top:96px;bottom:92px;z-index:2;display:flex;flex-direction:column;min-height:0;transition:opacity .2s,transform .2s}
.sb-panel.off{opacity:0;pointer-events:none}
.sb-crew{left:14px;width:250px}.sb-crew.off{transform:translateX(-14px)}
.sb-side{right:14px;width:310px;gap:10px}
.sb-side.off{transform:translateX(14px)}
.sb-head{padding:9px 12px 6px;font-size:14px;letter-spacing:.18em;color:var(--sb-dim);text-transform:uppercase;display:flex;justify-content:space-between;align-items:center;gap:8px}
.sb-head b{color:#fff;font-weight:400}
.sb-scroll{overflow:auto;min-height:0;flex:1 1 auto;padding:0 6px 8px;scrollbar-width:thin;scrollbar-color:rgba(143,200,255,.25) transparent}
.sb-team{margin:4px 0 6px}
.sb-team-h{display:flex;align-items:center;gap:8px;padding:5px 6px 4px;border-radius:5px;cursor:pointer;font-size:15px;letter-spacing:.14em}
.sb-team-h:hover,.sb-team-h.on{background:rgba(143,200,255,.08)}
.sb-team-h:focus-visible{outline:none;box-shadow:inset 0 0 0 1px rgba(143,200,255,.6)}
.sb-team-h i{width:16px;height:3px;border-radius:2px;flex:none;box-shadow:0 0 8px currentColor}
.sb-team-h small{margin-left:auto;color:var(--sb-dim);font-size:13px}
.sb-team-r{font-size:12px;letter-spacing:.1em;color:#5f7290;padding:0 6px 3px 30px;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sb-agent{display:flex;align-items:center;gap:8px;width:100%;font:inherit;font-size:15px;color:#c8d8ee;background:none;border:0;
  padding:4px 6px 3px 12px;border-radius:5px;cursor:pointer;text-align:left}
.sb-agent:hover{background:rgba(143,200,255,.07);color:#fff}
.sb-agent.on{background:rgba(143,200,255,.13);color:#fff}
.sb-agent:focus-visible{outline:none;box-shadow:inset 0 0 0 1px rgba(143,200,255,.6)}
.sb-agent .d{width:8px;height:8px;border-radius:50%;flex:none}
.sb-agent .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sb-agent .c{color:var(--sb-dim);font-variant-numeric:tabular-nums}
.sb-agent .l{color:#fff;font-size:11px;letter-spacing:.12em;opacity:.55}
.sb-agent.cold .n{opacity:.6}
.sb-agent.run .d{animation:sb-blink .8s infinite}
.sb-card{display:flex;flex-direction:column;min-height:0}
.sb-card.grow{flex:1 1 auto}
.sb-detail{padding:0 12px 10px;font-size:15px;line-height:1.35;color:#c3d3e8;overflow:auto;min-height:0;scrollbar-width:thin;user-select:text}
.sb-detail h5{margin:0 0 4px;font-size:21px;font-weight:400;color:#fff;line-height:1.1}
.sb-detail .k{color:var(--sb-dim);letter-spacing:.06em}
.sb-detail .body{white-space:pre-wrap;margin:6px 0 8px;color:#e4eefb}
.sb-detail .meta{display:grid;grid-template-columns:auto 1fr;gap:1px 10px;margin:6px 0}
.sb-detail .tag{display:inline-block;padding:0 6px;border-radius:4px;border:1px solid currentColor;font-size:13px;letter-spacing:.1em;margin:0 4px 4px 0}
.sb-legend{display:flex;flex-direction:column;gap:2px;font-size:14px;color:#b8c9e0;margin:2px 0}
.sb-legend i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:8px;vertical-align:1px;box-shadow:0 0 6px currentColor}
.sb-legend i.ln{width:14px;height:2px;border-radius:1px;vertical-align:3px}
.sb-bar{height:4px;border-radius:3px;background:rgba(143,200,255,.12);overflow:hidden;margin:2px 0 6px}
.sb-bar i{display:block;height:100%;border-radius:3px}
.sb-link{display:block;width:100%;text-align:left;font:inherit;font-size:15px;color:#bcd2f0;background:none;border:0;padding:2px 0;cursor:pointer;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sb-link:hover{color:#fff}
.sb-link:focus-visible{outline:none;color:#fff;text-decoration:underline}
.sb-link em{font-style:normal;color:var(--sb-dim)}
.sb-feed{padding:0 10px 8px;font-size:14px;overflow:auto;min-height:0;max-height:210px;scrollbar-width:thin}
.sb-row{display:flex;gap:7px;padding:2px 0;border-bottom:1px solid rgba(143,200,255,.06);animation:sb-in .3s ease both}
@keyframes sb-in{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}
.sb-row time{color:#566a88;flex:0 0 40px}
.sb-row em{font-style:normal;flex:0 0 54px;letter-spacing:.08em}
.sb-row span{color:#b8c9e0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sb-w{color:#3dffb5}.sb-u{color:#2ee6ff}.sb-p{color:#ffd166}.sb-f{color:#ff5f7e}
.sb-dock{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:3;width:min(940px,max(560px,calc(100% - 620px)));padding:8px;display:flex;flex-direction:column;gap:6px}
.sb-dock-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.sb-ask{flex:1 1 260px;min-width:0;display:flex;align-items:center;gap:8px;padding:0 10px;border:1px solid rgba(143,200,255,.26);border-radius:6px;background:rgba(0,0,0,.35)}
.sb-ask:focus-within{border-color:rgba(46,230,255,.7);box-shadow:0 0 14px rgba(46,230,255,.18)}
.sb-ask span{color:#2ee6ff;font-size:18px}
.sb-wrap input,.sb-wrap select{font:inherit;font-size:16px;color:#fff;background:transparent;border:0;outline:none;padding:7px 0 6px;min-width:0}
.sb-ask input{flex:1}
.sb-wrap input::placeholder{color:#5f7290}
.sb-ingest{display:flex;gap:6px;align-items:center}
.sb-ingest[hidden]{display:none}
.sb-ingest select,.sb-ingest input{border:1px solid rgba(143,200,255,.26);border-radius:6px;background:rgba(0,0,0,.35);padding:6px 8px 5px}
.sb-ingest select option{background:#0a1224}
.sb-ingest input{flex:1}
.sb-note{flex:1 1 200px;min-width:0;font-size:14px;line-height:1.2;color:#8aa0bf;padding:0 4px;user-select:text;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.sb-note b{color:#fff;font-weight:400}
.sb-quiet{font-size:14px;line-height:1.25;color:#8aa0bf;padding:2px 0 4px}
.sb-hint{position:absolute;left:16px;bottom:16px;z-index:1;max-width:min(230px,calc(50% - 300px));font-size:13px;letter-spacing:.14em;color:#4c5e7a;text-transform:uppercase;pointer-events:none}
.sb-empty{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);margin-top:clamp(120px,24vh,230px);z-index:1;text-align:center;pointer-events:none;
  font-size:17px;letter-spacing:.08em;color:#8aa0bf;text-shadow:0 0 12px #000;max-width:520px;padding:0 20px}
.sb-empty b{color:#fff;font-weight:400}
.sb-tip{position:absolute;z-index:4;pointer-events:none;padding:6px 10px 5px;max-width:280px;font-size:15px;line-height:1.2;transform:translate(14px,14px);opacity:0;transition:opacity .12s}
.sb-tip.on{opacity:1}
.sb-tip b{color:#fff;font-weight:400;display:block}
.sb-tip small{color:var(--sb-dim);font-size:13px;letter-spacing:.08em;text-transform:uppercase}
.sb-wrap.compact .sb-stats{display:none}
.sb-wrap.compact .sb-panel{top:84px}
.sb-wrap.compact .sb-hint{display:none}
.sb-wrap.compact .sb-dock{width:calc(100% - 28px)}
@media (prefers-reduced-motion:reduce){.sb-live,.sb-agent.run .d{animation:none}.sb-row{animation:none}.sb-panel{transition:none}}
`;
  // The desktop app's CSP (Tauri hashes its inline <style>s, which switches 'unsafe-inline' off) silently blocks a
  // <style> element added at runtime. Without these rules the canvas is not absolutely positioned, it sizes its own
  // wrapper, and fit() grows it forever (518,784px tall on a real PC): the app froze and the window stayed blank.
  // A constructed stylesheet is not subject to style-src. The <style> stays as the fallback for old engines.
  let cssDone = false;
  function injectCss() {
    if (cssDone) return;
    cssDone = true;
    try {
      if (typeof CSSStyleSheet === 'function' && 'adoptedStyleSheets' in document) {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(CSS);
        document.adoptedStyleSheets = document.adoptedStyleSheets.concat(sheet);
        return;
      }
    } catch (_) { /* fall through to the <style> element */ }
    const s = document.createElement('style');
    s.id = 'sb-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  const api = () => (typeof Harness !== 'undefined' && Harness.api) ? Harness.api : null;
  async function fetchJson(url, body) {
    const r = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  const GET = url => (api() ? api().get(url) : fetchJson(url));
  const POST = (url, body) => (api() ? api().post(url, body || {}) : fetchJson(url, body || {}));

  // ================================================================================================================
  function mount(host, opts) {
    opts = opts || {};
    injectCss();
    host.innerHTML = '';
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const focusAgent = opts.agentId || null;   // mounted inside a dossier: open on that agent

    const state = {
      graph: null, records: {}, nodes: [], byId: {}, edges: [], springs: [], movers: [], agents: [], communities: [],
      feed: [], pulses: [], active: {}, crossScale: 1, cut: null, replay: null, selected: null, hover: null, focus: null, team: null, probe: null,
      loading: true, error: '', sampled: false, warm: 0, alive: true, raf: 0, t: 0, last: 0,
      w: 0, h: 0, dpr: 1, compact: false, panelsAuto: true, teamsPresent: {},
      cam: { yaw: Math.PI * 0.8, pitch: 0.2, zoom: 1, tx: 0, ty: -0.04, tz: 0 },
      goal: null, autoRotate: !reduced, lastInput: 0, drag: null, pointers: new Map()
    };

    // ---- DOM ----
    const wrap = el('div', 'sb-wrap');
    wrap.tabIndex = 0;
    wrap.setAttribute('role', 'application');
    wrap.setAttribute('aria-label', 'Second brain — every agent\'s memory as one brain. Drag to orbit, scroll to zoom.');
    const canvas = el('canvas', 'sb-canvas');
    canvas.setAttribute('aria-hidden', 'true');
    const ctx = canvas.getContext('2d');
    const bg = document.createElement('canvas');

    const top = el('div', 'sb-top');
    const title = el('div', 'sb-title sb-glass', '<h3>SECOND BRAIN</h3><p><span class="sb-live"></span><span class="sb-sub">reading every notebook…</span></p>');
    const sub = title.querySelector('.sb-sub');
    const stats = el('div', 'sb-stats');
    const tools = el('div', 'sb-tools');
    top.append(title, stats, tools);

    const tiles = {};
    for (const d of [['memories', 'beliefs'], ['knowledge', 'knowledge'], ['crossAgentLinks', 'cross-talk'], ['totalRecalls', 'recalls'], ['communities', 'neighbourhoods'], ['edges', 'links']]) {
      const t = el('div', 'sb-chip sb-glass', '<b>—</b><span>' + d[1] + '</span>');
      tiles[d[0]] = t.querySelector('b');
      stats.appendChild(t);
    }
    const mkBtn = (label, cls, aria) => { const b = el('button', 'sb-btn' + (cls ? ' ' + cls : ''), label); b.type = 'button'; if (aria) b.setAttribute('aria-label', aria); return b; };
    const crewBtn = mkBtn('crew', 'on', 'Show or hide the crew list');
    const sideBtn = mkBtn('inspect', 'on', 'Show or hide the inspector');
    const rotBtn = mkBtn('rotate', state.autoRotate ? 'on' : '', 'Toggle auto-rotate');
    const resetBtn = mkBtn('reset', '', 'Reset the view');
    const fullBtn = mkBtn('fullscreen', '', 'Fill the whole screen');
    const replayBtn = mkBtn('replay', '', 'Replay how the brain grew, belief by belief, in the order it was learned');
    tools.append(crewBtn, sideBtn, replayBtn, rotBtn, resetBtn, fullBtn);

    const crew = el('div', 'sb-panel sb-crew sb-glass');
    const crewHead = el('div', 'sb-head', 'the crew <b>—</b>');
    const crewList = el('div', 'sb-scroll');
    crew.append(crewHead, crewList);

    const side = el('div', 'sb-panel sb-side');
    const insCard = el('div', 'sb-card grow sb-glass');
    const insHead = el('div', 'sb-head', 'the mind');
    const insBox = el('div', 'sb-detail');
    insCard.append(insHead, insBox);
    const feedCard = el('div', 'sb-card sb-glass');
    const feedHead = el('div', 'sb-head', '<span><span class="sb-live"></span>live activity</span>');
    const feedBox = el('div', 'sb-feed');
    feedCard.append(feedHead, feedBox);
    side.append(insCard, feedCard);

    const dock = el('div', 'sb-dock sb-glass');
    const ingestRow = el('div', 'sb-ingest');
    ingestRow.hidden = true;
    const kindSel = el('select');
    kindSel.setAttribute('aria-label', 'Graph format');
    kindSel.innerHTML = '<option value="graphify">graphify · graph.json</option><option value="base">basemode · .base/graph.nq</option>';
    const pathIn = el('input');
    pathIn.type = 'text';
    pathIn.placeholder = 'path to the repo, or the graph file…';
    pathIn.setAttribute('aria-label', 'Path to the graph');
    const addBtn = mkBtn('fold in');
    ingestRow.append(kindSel, pathIn, addBtn);
    const row = el('div', 'sb-dock-row');
    const ask = el('label', 'sb-ask', '<span>›</span>');
    const probeIn = el('input');
    probeIn.type = 'text';
    probeIn.placeholder = 'ask the brain — type a task, watch what recall would surface…';
    probeIn.setAttribute('aria-label', 'Simulate recall for a piece of text');
    ask.appendChild(probeIn);
    const probeBtn = mkBtn('recall');
    const reflectBtn = mkBtn('reflect · auto-improve', 'hero');
    const exportBtn = mkBtn('export → obsidian');
    const ingestBtn = mkBtn('attach graph', '', 'Attach a graphify or basemode graph');
    const refreshBtn = mkBtn('↻', '', 'Reload the brain');
    row.append(ask, probeBtn);
    const row2 = el('div', 'sb-dock-row');
    const noteBox = el('div', 'sb-note', 'Nothing is written until you export — this is a live read of every notebook.');
    row2.append(reflectBtn, exportBtn, ingestBtn, refreshBtn, noteBox);
    dock.append(ingestRow, row, row2);

    const hint = el('div', 'sb-hint', 'drag · orbit &nbsp; scroll · zoom &nbsp; click · inspect &nbsp; double-click · fly');
    const empty = el('div', 'sb-empty');
    empty.hidden = true;
    const tip = el('div', 'sb-tip sb-glass');

    wrap.append(canvas, top, crew, side, dock, hint, empty, tip);
    host.appendChild(wrap);

    // ================================================================ graph → scene
    function applyGraph(payload) {
      const g = payload && payload.graph ? payload.graph : null;
      if (!g) { state.error = 'the sidecar did not return a graph'; return; }
      const prev = state.byId;
      const hadGraph = !!state.graph;
      state.graph = g;
      state.records = (payload && payload.records) || {};
      state.communities = g.communities || [];
      state.sampled = !!(g.stats && g.stats.sampled);
      const st = g.stats || {};
      for (const k of Object.keys(tiles)) tiles[k].textContent = String(num(st[k]));

      const nodes = [], byId = {};
      const all = g.nodes || [];
      // agents first, always all of them: the budget is spent on beliefs, never on hiding a crew member
      const agents = all.filter(n => n.type === 'agent');
      const rest = all.filter(n => n.type !== 'agent' && n.type !== 'concept');
      const budget = Math.max(0, MAX_NODES - agents.length);
      if (rest.length > budget) state.sampled = true;
      const add = (src, extra) => {
        const n = Object.assign({
          id: src.id, type: src.type, label: src.label, agentId: src.agentId || null, kind: src.kind || null,
          trust: num(src.trust), useCount: num(src.useCount), pinned: !!src.pinned, confirmation: src.confirmation || '',
          source: src.source || '', role: src.role || '', memories: num(src.memories), createdAt: num(src.createdAt),
          x: 0, y: 0, z: 0, sx: 0, sy: 0, sr: 0, depth: 0, glow: 0
        }, extra);
        nodes.push(n); byId[n.id] = n;
        return n;
      };
      state.teamsPresent = {};
      const agentNodes = agents.map(a => {
        const team = teamOf(a.agentId, a.label);
        state.teamsPresent[team] = true;
        return add(a, { team: team, lead: isLead(a.agentId) || team === 'ultron', color: (TEAMS[team] || TEAMS.crew).color });
      });
      placeAgents(agentNodes);
      state.agents = agentNodes;
      const agentById = {};
      for (const a of agentNodes) agentById[a.agentId] = a;

      const perAgent = {};
      let ki = 0, pi = 0;
      const kTotal = rest.filter(n => n.type === 'knowledge').length || 1;
      const pTotal = rest.filter(n => n.type === 'project' || n.type === 'stream').length || 1;
      for (const src of rest.slice(0, budget)) {
        if (src.type === 'memory') {
          const owner = agentById[src.agentId];
          const team = owner ? owner.team : 'crew';
          const n = add(src, { team: team, color: owner ? owner.color : TEAMS.crew.color, home: owner ? [owner.x, owner.y, owner.z] : TEAMS.crew.anchor });
          const k = perAgent[src.agentId] = (perAgent[src.agentId] || 0) + 1;
          const d = fib(k, 24 + k), r = 0.05 + 0.014 * Math.sqrt(k);
          const old = prev[n.id];
          if (old) { n.x = old.x; n.y = old.y; n.z = old.z; }   // a refresh keeps the brain where it was
          else { n.x = n.home[0] + d[0] * r; n.y = n.home[1] + d[1] * r; n.z = n.home[2] + d[2] * r; n.glow = hadGraph ? 1 : 0; }
          contain(n, n.home, inside);
        } else if (src.type === 'knowledge') {
          const a = KNOWLEDGE.anchor, d = fib(ki++, kTotal), r = 0.05 + 0.1 * Math.sqrt(ki / kTotal);
          const n = add(src, { team: 'knowledge', color: KNOWLEDGE.color, home: a, cb: true });
          n.x = a[0] + d[0] * r * 0.9; n.y = a[1] + d[1] * r * 0.55; n.z = a[2] + d[2] * r * 1.4;
          contain(n, a, inCerebellum);
        } else if (src.type === 'project' || src.type === 'stream') {
          const ang = (pi++ / pTotal) * Math.PI * 2;
          const n = add(src, { team: 'core', color: PROJECT_COLOR, fixed: true });
          n.x = CORE[0] + Math.cos(ang) * 0.24; n.y = CORE[1] + Math.sin(ang * 3) * 0.04 - 0.02; n.z = CORE[2] + Math.sin(ang) * 0.24;
        }
      }
      state.nodes = nodes;
      state.byId = byId;
      state.movers = nodes.filter(n => n.type === 'memory' || n.type === 'knowledge');

      // edges from the graph, plus the chain of command (structure the roster implies, drawn as axons)
      const edges = [];
      for (const e of g.edges || []) {
        if (e.type === 'in_concept') continue;
        if (!byId[e.source] || !byId[e.target]) continue;
        edges.push({ a: e.source, b: e.target, type: e.type, w: num(e.weight) || 1, cross: !!e.crossAgent });
      }
      const ultron = agentNodes.find(a => a.team === 'ultron');
      for (const team of TEAM_ORDER) {
        if (team === 'ultron') continue;
        const members = agentNodes.filter(a => a.team === team);
        if (!members.length) continue;
        const lead = members.find(a => a.lead) || members[0];
        if (ultron) edges.push({ a: ultron.id, b: lead.id, type: 'chain', w: 1, lead: true });
        for (const m of members) if (m !== lead) edges.push({ a: lead.id, b: m.id, type: 'chain', w: 1 });
      }
      state.edges = edges;
      const nCross = edges.filter(e => e.cross).length;
      state.crossScale = Math.max(0.12, Math.min(1, 70 / Math.max(1, nCross)));
      state.springs = edges.filter(e => {
        const A = byId[e.a], B = byId[e.b];
        return (A.type === 'memory' || A.type === 'knowledge') && (B.type === 'memory' || B.type === 'knowledge') &&
          (e.type === 'similar' || e.type === 'references' || /^(gfy|base)_/.test(e.type));
      });
      state.warm = 26;   // settle over the next frames, so the brain visibly organises itself
      state.loading = false;
      shellColors();
      if (state.selected && !byId[state.selected]) { state.selected = null; state.focus = null; }
      if (focusAgent && !hadGraph && byId['agent:' + focusAgent]) select('agent:' + focusAgent, true);
      else { renderCrew(); renderDetail(); }
      const nAgents = agentNodes.length, nBeliefs = num(st.memories);
      sub.textContent = nAgents + (nAgents === 1 ? ' agent' : ' agents') + ' · one mind' + (ultron ? ' · ' + nice(ultron.label).toLowerCase() + ' at the core' : '');
      empty.hidden = nBeliefs > 0;
      empty.innerHTML = '<b>' + nAgents + ' neurons wired, no beliefs yet.</b><br>Give the crew work — every lesson they keep lands here, in its owner\'s lobe.';
    }

    // ---- layout relaxation: a few springs, local repulsion, a pull home, and the skull as a wall ----
    function relax(iters) {
      const mov = state.movers, byId = state.byId;
      if (!mov.length) return;
      const CELL = 0.06;
      for (let it = 0; it < iters; it++) {
        const grid = new Map();
        for (const n of mov) {
          const k = Math.floor(n.x / CELL) + ',' + Math.floor(n.y / CELL) + ',' + Math.floor(n.z / CELL);
          let b = grid.get(k); if (!b) grid.set(k, b = []); b.push(n);
        }
        for (const n of mov) {
          const gx = Math.floor(n.x / CELL), gy = Math.floor(n.y / CELL), gz = Math.floor(n.z / CELL);
          for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) for (let oz = -1; oz <= 1; oz++) {
            const b = grid.get((gx + ox) + ',' + (gy + oy) + ',' + (gz + oz));
            if (!b) continue;
            for (const m of b) {
              if (m === n) continue;
              let dx = n.x - m.x, dy = n.y - m.y, dz = n.z - m.z;
              let d = Math.sqrt(dx * dx + dy * dy + dz * dz);
              if (d >= CELL) continue;
              if (d < 1e-4) { dx = n.id < m.id ? 1 : -1; dy = 0.3; dz = 0.2; d = 1; }
              const f = (CELL - d) / d * 0.12;
              n.x += dx * f; n.y += dy * f; n.z += dz * f;
            }
          }
        }
        for (const e of state.springs) {
          const a = byId[e.a], b = byId[e.b];
          const rest = e.cross ? 0.24 : a.type === 'knowledge' ? 0.07 : 0.09;
          const k = e.cross ? 0.004 : 0.03;
          const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
          const f = (d - rest) / d * k * Math.min(1.5, e.w || 1);
          a.x += dx * f; a.y += dy * f; a.z += dz * f;
          b.x -= dx * f; b.y -= dy * f; b.z -= dz * f;
        }
        for (const n of mov) {
          const h = n.home;
          n.x += (h[0] - n.x) * 0.05; n.y += (h[1] - n.y) * 0.05; n.z += (h[2] - n.z) * 0.05;
          contain(n, h, n.cb ? inCerebellum : inside);
        }
      }
    }

    // shell point colours: a lobe glows its team's colour only when that team is actually on the station
    let shellPal = [];
    function shellColors() {
      shellPal = REGIONS.map(k => {
        if (k === 'stem') return ICE;
        if (k === 'knowledge') return state.nodes.some(n => n.type === 'knowledge') ? mix(KNOWLEDGE.color, ICE, 0.35) : ICE;
        return state.teamsPresent[k] ? mix(TEAMS[k].color, ICE, 0.42) : ICE;
      });
    }

    // ================================================================ camera
    let S = 300, CX = 0, CY = 0;
    const DIST = 3.6;
    let cy_ = 1, sy_ = 0, cp_ = 1, sp_ = 0;
    function camFrame() {
      const c = state.cam;
      cy_ = Math.cos(c.yaw); sy_ = Math.sin(c.yaw); cp_ = Math.cos(c.pitch); sp_ = Math.sin(c.pitch);
      const topH = 84, dockH = 118;   // the HUD strip and the command dock; the brain sits between them
      S = Math.min(state.w * 0.33, (state.h - topH - dockH) * 0.62) * c.zoom;
      CX = state.w / 2; CY = topH + (state.h - topH - dockH) / 2 + 6;
    }
    // project brain space → screen; returns [sx, sy, scale, depth(+ toward viewer)] (reused array — copy what you keep)
    const P = [0, 0, 0, 0];
    function project(x, y, z) {
      const c = state.cam;
      const X = x - c.tx, Y = y - c.ty, Z = z - c.tz;
      const x1 = X * cy_ - Z * sy_, z1 = X * sy_ + Z * cy_;
      const y2 = Y * cp_ - z1 * sp_, z2 = Y * sp_ + z1 * cp_;
      const pr = DIST / (DIST - z2);
      P[0] = CX + x1 * S * pr; P[1] = CY - y2 * S * pr; P[2] = S * pr; P[3] = z2;
      return P;
    }
    function rotN(nx, ny, nz) {   // rotate a normal; returns its component toward the viewer
      const z1 = nx * sy_ + nz * cy_;
      return ny * sp_ + z1 * cp_;
    }
    function flyTo(n, zoom) {
      state.goal = { tx: n ? n.x : 0, ty: n ? n.y : -0.04, tz: n ? n.z : 0, zoom: zoom || (n ? 1.7 : 1) };
      state.lastInput = performance.now();
    }

    // ================================================================ render
    function fit() {
      const r = wrap.getBoundingClientRect();
      const w = Math.max(320, Math.round(r.width)), h = Math.max(360, Math.round(r.height));
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      if (w === state.w && h === state.h && dpr === state.dpr) return;
      state.w = w; state.h = h; state.dpr = dpr;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      paintBackground();
      const compact = w < 980;
      if (compact !== state.compact) {
        state.compact = compact;
        wrap.classList.toggle('compact', compact);
        if (state.panelsAuto) setPanels(!compact, !compact);
      }
    }
    function paintBackground() {
      const w = state.w, h = state.h, d = state.dpr;
      bg.width = Math.round(w * d); bg.height = Math.round(h * d);
      const g = bg.getContext('2d');
      g.setTransform(d, 0, 0, d, 0, 0);
      const base = g.createRadialGradient(w / 2, h * 0.46, 0, w / 2, h * 0.46, Math.max(w, h) * 0.75);
      base.addColorStop(0, '#0b1430'); base.addColorStop(0.45, '#050a1a'); base.addColorStop(1, '#010207');
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      // nebula washes in the crew's colours, fixed positions so a resize never reshuffles the sky
      const neb = [['#2ee6ff', 0.22, 0.3, 0.42], ['#b48cff', 0.78, 0.26, 0.38], ['#ff3355', 0.5, 0.55, 0.3], ['#ff5fd2', 0.84, 0.78, 0.34], ['#3dffb5', 0.14, 0.8, 0.3]];
      g.globalCompositeOperation = 'lighter';
      for (const n of neb) {
        const r = Math.max(w, h) * n[3];
        const gr = g.createRadialGradient(w * n[1], h * n[2], 0, w * n[1], h * n[2], r);
        gr.addColorStop(0, rgba(n[0], 0.075)); gr.addColorStop(1, rgba(n[0], 0));
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
      }
      let seed = 1337;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const stars = Math.round(w * h / 3800);
      for (let i = 0; i < stars; i++) {
        const a = 0.08 + rnd() * rnd() * 0.6;
        g.fillStyle = 'rgba(200,225,255,' + a.toFixed(3) + ')';
        const s = rnd() < 0.06 ? 1.6 : 0.9;
        g.fillRect(rnd() * w, rnd() * h, s, s);
      }
      g.globalCompositeOperation = 'source-over';
      const vig = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
      vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.6)');
      g.fillStyle = vig; g.fillRect(0, 0, w, h);
    }

    // during a replay, a belief learned after the playhead is not born yet
    const unborn = n => state.cut != null && (n.type === 'memory') && n.createdAt > state.cut;

    // which nodes are "lit" when something is selected or a team is isolated
    function litOf(n) {
      if (state.focus) return state.focus.has(n.id) ? 1 : 0.1;
      if (state.team) return n.team === state.team ? 1 : 0.12;
      return 1;
    }

    function drawShell() {
      const sh = buildShell();
      const L = 6, buckets = new Array(REGIONS.length * L).fill(null);
      const breathe = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(state.t * 0.7);
      const teamFocus = state.team ? REGIONS.indexOf(state.team) : -2;
      const dotScale = Math.max(0.9, S * 0.0048);
      for (let i = 0; i < sh.length; i += 7) {
        const p = project(sh[i], sh[i + 1], sh[i + 2]);
        const facing = rotN(sh[i + 3], sh[i + 4], sh[i + 5]);
        const rim = 1 - Math.abs(facing);
        let a = 0.05 + 0.8 * Math.pow(rim, 2.4) + (facing > 0 ? 0.06 : 0);
        a *= 0.55 + 0.45 * Math.min(1, Math.max(0, (p[3] + 1.1) / 2.2));
        const region = sh[i + 6];
        if (state.team) a *= (region === teamFocus) ? 1.5 : 0.45;
        const lvl = Math.min(L - 1, Math.floor(a * L * 1.6));
        if (lvl <= 0 && a < 0.04) continue;
        const k = region * L + lvl;
        const path = buckets[k] || (buckets[k] = new Path2D());
        const s = Math.max(0.8, dotScale * p[2] / S);
        path.rect(p[0] - s / 2, p[1] - s / 2, s, s);
      }
      for (let k = 0; k < buckets.length; k++) {
        if (!buckets[k]) continue;
        const lvl = k % L;
        ctx.globalAlpha = Math.min(1, ((lvl + 0.6) / (L * 1.6)) * (0.85 + 0.3 * breathe));
        ctx.fillStyle = shellPal[Math.floor(k / L)] || ICE;
        ctx.fill(buckets[k]);
      }
      ctx.globalAlpha = 1;
    }

    function drawVolume() {
      const c = project(-0.05, 0.02, 0), r = S * 1.05;
      const g = ctx.createRadialGradient(c[0], c[1], r * 0.05, c[0], c[1], r);
      g.addColorStop(0, 'rgba(70,110,200,.16)'); g.addColorStop(0.55, 'rgba(40,70,150,.07)'); g.addColorStop(1, 'rgba(20,40,90,0)');
      ctx.fillStyle = g;
      ctx.fillRect(c[0] - r, c[1] - r, r * 2, r * 2);
      if (state.team && TEAMS[state.team]) {   // an isolated lobe glows from inside
        const T = TEAMS[state.team], q = project(T.anchor[0], T.anchor[1], T.anchor[2]), rr = S * 0.42;
        const h = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], rr);
        h.addColorStop(0, rgba(T.color, 0.22)); h.addColorStop(1, rgba(T.color, 0));
        ctx.fillStyle = h; ctx.fillRect(q[0] - rr, q[1] - rr, rr * 2, rr * 2);
      }
    }

    // a link's 3D control point: cross-agent fibres dive through the white matter, the chain of command arches out
    function bow(a, b, type, cross) {
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, mz = (a.z + b.z) / 2;
      if (cross) return [mx + (CORE[0] - mx) * 0.3, my + (CORE[1] - my) * 0.3, mz + (CORE[2] - mz) * 0.3];
      if (type === 'chain') return [mx + (mx - CORE[0]) * 0.22, my + (my - CORE[1]) * 0.22 + 0.05, mz + (mz - CORE[2]) * 0.22];
      return null;
    }
    function edgeStyle(e, A, B) {
      if (e.type === 'chain') return [B.color, e.lead ? 1.8 : 1.1, e.lead ? 0.5 : 0.32];
      if (e.cross) return ['#dff6ff', state.crossScale < 0.5 ? 0.8 : 1.1, 0.36 * state.crossScale];
      if (e.type === 'similar') return [A.color, 0.8, 0.16];
      if (e.type === 'references') return ['#ffffff', 0.9, 0.22];
      if (/^(gfy|base)_/.test(e.type)) return [KNOWLEDGE.color, 0.7, 0.2];
      if (e.type === 'wrote') return [A.color, 0.6, 0.06];
      if (e.type === 'same_project' || e.type === 'same_stream') return [PROJECT_COLOR, 0.5, 0.035];
      return [ICE, 0.6, 0.08];
    }
    function drawEdges() {
      const groups = new Map();
      const focus = state.focus;
      for (const e of state.edges) {
        const A = state.byId[e.a], B = state.byId[e.b];
        if (!A || !B || unborn(A) || unborn(B)) continue;
        const st = edgeStyle(e, A, B);
        let alpha = st[2];
        if (focus) alpha = (focus.has(A.id) && focus.has(B.id)) ? Math.min(0.9, alpha * 2.4 + 0.08) : alpha * 0.12;
        else if (state.team) alpha = (A.team === state.team || B.team === state.team) ? alpha * 1.8 : alpha * 0.15;
        const depth = (A.depth + B.depth) / 2;
        const lvl = depth > 0.35 ? 3 : depth > -0.1 ? 2 : depth > -0.5 ? 1 : 0;
        alpha *= 0.45 + lvl * 0.2;
        if (alpha < 0.012) continue;
        const qa = Math.round(alpha * 40) / 40;
        const key = st[0] + '|' + st[1] + '|' + qa;
        let g = groups.get(key);
        if (!g) groups.set(key, g = { color: st[0], width: st[1], alpha: qa, path: new Path2D() });
        const c = bow(A, B, e.type, e.cross);
        g.path.moveTo(A.sx, A.sy);
        if (c) { const p = project(c[0], c[1], c[2]); g.path.quadraticCurveTo(p[0], p[1], B.sx, B.sy); }
        else g.path.lineTo(B.sx, B.sy);
      }
      ctx.lineCap = 'round';
      for (const g of groups.values()) {
        ctx.globalAlpha = g.alpha;
        ctx.strokeStyle = g.color;
        ctx.lineWidth = g.width * Math.max(0.7, state.cam.zoom * 0.9);
        ctx.stroke(g.path);
      }
      ctx.globalAlpha = 1;
    }

    // radius in screen px; sr is the node's perspective scale, so near neurons read bigger than far ones
    function nodeRadius(n) {
      const k = n.sr / 300;
      if (n.type === 'agent') return (n.team === 'ultron' ? 13 : n.lead ? 9.5 : 6.8) * k;
      if (n.type === 'memory') return (2 + Math.min(2.6, Math.sqrt(n.useCount) * 0.65) + Math.max(0, n.trust) * 1.2) * k;
      if (n.type === 'knowledge') return 1.9 * k;
      return 3.4 * k;
    }
    function drawNodes() {
      const t = state.t;
      for (const n of state.nodes) {
        if (n.type === 'agent' || unborn(n)) continue;
        const lit = litOf(n);
        const r = nodeRadius(n);
        const fog = 0.45 + 0.55 * Math.min(1, Math.max(0, (n.depth + 1) / 2));
        let a = lit * fog * (n.confirmation === 'inferred' ? 0.7 : 1);
        if (n.glow > 0) a = Math.min(1, a + n.glow);
        const s = r * (5 + n.glow * 4);
        ctx.globalAlpha = a;
        ctx.drawImage(sprite(n.color), n.sx - s / 2, n.sy - s / 2, s, s);
        if (n.pinned && lit > 0.5) {
          ctx.globalAlpha = 0.7 * a; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(n.sx, n.sy, r * 1.9, 0, Math.PI * 2); ctx.stroke();
        }
        if (n.id === state.selected || n.id === state.hover) {
          ctx.globalAlpha = 0.9; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(n.sx, n.sy, Math.max(6, r * 2.6), 0, Math.PI * 2); ctx.stroke();
        }
      }
      // agents last: they are the neurons the rest of the brain hangs off
      for (const n of state.agents) {
        const lit = litOf(n);
        const r = nodeRadius(n);
        const fog = 0.6 + 0.4 * Math.min(1, Math.max(0, (n.depth + 1) / 2));
        const cold = n.memories === 0 && n.team !== 'ultron';
        const a = lit * fog * (cold ? 0.62 : 1);
        const isU = n.team === 'ultron';
        const halo = r * (isU ? 11 + (reduced ? 0 : 1.5 * Math.sin(t * 1.6)) : 6.5) * (1 + n.glow * 0.6);
        ctx.globalAlpha = a * (isU ? 0.55 : 0.4);
        ctx.drawImage(sprite(n.color), n.sx - halo / 2, n.sy - halo / 2, halo, halo);
        const core = r * 3.2;
        ctx.globalAlpha = a;
        ctx.drawImage(sprite(n.color), n.sx - core / 2, n.sy - core / 2, core, core);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(n.sx, n.sy, r * 0.42, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = n.color; ctx.lineWidth = Math.max(1, r * 0.16);
        ctx.globalAlpha = a * 0.9;
        ctx.beginPath(); ctx.arc(n.sx, n.sy, r * 1.35, 0, Math.PI * 2); ctx.stroke();
        if (n.lead && !isU) {
          ctx.globalAlpha = a * 0.45; ctx.lineWidth = 1;
          ctx.setLineDash([3, 4]); ctx.lineDashOffset = reduced ? 0 : -t * 10;
          ctx.beginPath(); ctx.arc(n.sx, n.sy, r * 2.1, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
        }
        if (isU) {   // Ultron: two counter-rotating segmented rings and three orbiters
          ctx.lineWidth = Math.max(1.2, r * 0.12);
          for (let ring = 0; ring < 2; ring++) {
            const rr = r * (1.9 + ring * 0.75), spin = (ring ? -1 : 1) * (reduced ? 0 : t * (0.6 - ring * 0.25));
            ctx.globalAlpha = a * (0.75 - ring * 0.3);
            for (let s = 0; s < 6; s++) {
              const a0 = spin + s * Math.PI / 3;
              ctx.beginPath(); ctx.arc(n.sx, n.sy, rr, a0, a0 + Math.PI / 3 * 0.62); ctx.stroke();
            }
          }
          for (let o = 0; o < 3; o++) {
            const ang = (reduced ? 0 : t * 1.1) + o * Math.PI * 2 / 3, rr = r * 3.3;
            const ox = n.sx + Math.cos(ang) * rr, oy = n.sy + Math.sin(ang) * rr * 0.42;
            ctx.globalAlpha = a * 0.9;
            ctx.drawImage(sprite(n.color), ox - r, oy - r, r * 2, r * 2);
          }
        }
        if (state.active[n.agentId] && !reduced) {   // a running agent pings like sonar
          for (let k = 0; k < 2; k++) {
            const ph = (t * 0.9 + k * 0.5) % 1;
            ctx.globalAlpha = a * (1 - ph) * 0.8;
            ctx.strokeStyle = n.color; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(n.sx, n.sy, r * (1.6 + ph * 3.4), 0, Math.PI * 2); ctx.stroke();
          }
        }
        if (n.id === state.selected || n.id === state.hover) {
          ctx.globalAlpha = 0.9; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(n.sx, n.sy, r * 2.6, 0, Math.PI * 2); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    // pulses ride the exact curve the matching edge draws; a pulse with no target is a shockwave at the agent
    function drawPulses(dt) {
      for (let i = state.pulses.length - 1; i >= 0; i--) {
        const p = state.pulses[i];
        p.age += dt * (p.speed || 0.9);
        if (p.age >= 1) { if (p.to) p.to.glow = Math.max(p.to.glow, 0.9); state.pulses.splice(i, 1); continue; }
        if (p.age < 0) continue;   // negative age = still queued in a staggered wave
        const A = p.from, B = p.to;
        if (!A) continue;
        if (!B) {
          const r = Math.max(4, nodeRadius(A)) * (1.5 + p.age * 7);
          ctx.globalAlpha = (1 - p.age) * 0.85; ctx.strokeStyle = p.color || '#ffffff'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.arc(A.sx, A.sy, r, 0, Math.PI * 2); ctx.stroke();
          continue;
        }
        const c3 = bow(A, B, p.type || 'pulse', p.cross);
        let cx = (A.sx + B.sx) / 2, cy = (A.sy + B.sy) / 2;
        if (c3) { const q = project(c3[0], c3[1], c3[2]); cx = q[0]; cy = q[1]; }
        const spr = sprite(p.color || '#ffffff');
        for (let k = 0; k < 6; k++) {
          const t = p.age - k * 0.025;
          if (t < 0) break;
          const u = 1 - t;
          const x = u * u * A.sx + 2 * u * t * cx + t * t * B.sx, y = u * u * A.sy + 2 * u * t * cy + t * t * B.sy;
          const s = (14 - k * 2) * Math.max(0.7, state.cam.zoom * 0.85);
          ctx.globalAlpha = (1 - k / 6) * 0.95;
          ctx.drawImage(spr, x - s / 2, y - s / 2, s, s);
        }
      }
      ctx.globalAlpha = 1;
    }

    const labelBoxes = [];
    const overlaps = box => labelBoxes.some(b => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]);
    function drawLabels() {
      labelBoxes.length = 0;
      ctx.globalCompositeOperation = 'source-over';
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(2,4,12,.9)'; ctx.lineWidth = 3.5;
      const want = state.agents.slice();
      for (const n of [state.byId[state.selected], state.byId[state.hover]]) if (n && n.type !== 'agent') want.push(n);
      if (state.probe) for (const h of state.probe.hits.slice(0, 5)) { const n = state.byId[h.id]; if (n && n.type !== 'agent') want.push(n); }
      const pri = n => (n.id === state.selected || n.id === state.hover ? 3 : n.team === 'ultron' ? 2.5 : n.lead ? 2 : n.type === 'agent' ? 1 : 1.5) + n.depth * 0.3;
      want.sort((a, b) => pri(b) - pri(a));
      const zf = Math.min(1.25, Math.max(0.85, state.cam.zoom * 0.9));
      for (const n of want) {
        const lit = litOf(n);
        const isAgent = n.type === 'agent';
        const big = n.team === 'ultron' ? 22 : n.lead ? 17 : 15;
        const fs = Math.round((isAgent ? big : 15) * zf);
        ctx.font = fs + 'px ' + FONT;
        const text = isAgent ? nice(n.label) : nice(n.label).slice(0, 48);
        const w = ctx.measureText(text).width;
        const r = Math.max(3, nodeRadius(n));
        const x = n.sx, y = n.sy - r * (isAgent ? 2.4 : 2.2) - 3;
        const box = [x - w / 2 - 3, y - fs, x + w / 2 + 3, y + 3];
        const forced = n.id === state.selected || n.id === state.hover || n.team === 'ultron';
        if (!forced && overlaps(box)) continue;
        labelBoxes.push(box);
        const fog = 0.5 + 0.5 * Math.min(1, Math.max(0, (n.depth + 1) / 2));
        ctx.globalAlpha = Math.max(0.18, lit) * (forced ? 1 : fog);
        ctx.fillStyle = isAgent ? (n.team === 'ultron' ? '#ff6b85' : mix(n.color, '#ffffff', 0.45)) : '#ffffff';
        ctx.strokeText(text, x, y); ctx.fillText(text, x, y);
        if (isAgent && forced && n.team !== 'ultron') {
          ctx.font = Math.round(fs * 0.72) + 'px ' + FONT;
          ctx.fillStyle = n.color; ctx.globalAlpha *= 0.75;
          const y2 = n.sy + r * 2.8 + fs * 0.8;
          const sub = (TEAMS[n.team] || TEAMS.crew).label + (n.lead ? ' · LEAD' : '');
          ctx.strokeText(sub, x, y2); ctx.fillText(sub, x, y2);
          labelBoxes.push([x - w / 2, y2 - fs * 0.72, x + w / 2, y2 + 2]);
        }
      }
      // neighbourhood names float where their beliefs actually settled
      if (!state.focus && state.communities.length) {
        ctx.font = '14px ' + FONT;
        for (const c of state.communities.slice().sort((a, b) => num(b.size) - num(a.size)).slice(0, 6)) {
          const mem = (c.members || []).map(id => state.byId[id]).filter(Boolean);
          if (mem.length < 3) continue;
          let sx = 0, sy = 0;
          for (const m of mem) { sx += m.sx; sy += m.sy; }
          sx /= mem.length; sy /= mem.length;
          const text = '◦ ' + String(c.label || '').toLowerCase();
          const w = ctx.measureText(text).width;
          const box = [sx - w / 2, sy - 14, sx + w / 2, sy + 2];
          if (overlaps(box)) continue;
          labelBoxes.push(box);
          ctx.globalAlpha = 0.5; ctx.fillStyle = '#cfe3ff';
          ctx.strokeText(text, sx, sy); ctx.fillText(text, sx, sy);
        }
      }
      if (state.team && TEAMS[state.team]) {   // the isolated lobe names itself
        const T = TEAMS[state.team], p = project(T.anchor[0], T.anchor[1] + 0.32, T.anchor[2]);
        ctx.font = '17px ' + FONT; ctx.globalAlpha = 0.85; ctx.fillStyle = T.color;
        ctx.strokeText(T.region, p[0], p[1]); ctx.fillText(T.region, p[0], p[1]);
      }
      if (!state.focus && state.nodes.some(n => n.type === 'knowledge')) {
        const p = project(KNOWLEDGE.anchor[0], KNOWLEDGE.anchor[1] - 0.3, 0);
        ctx.font = '14px ' + FONT; ctx.globalAlpha = 0.55; ctx.fillStyle = '#a9a8ff';
        ctx.strokeText(KNOWLEDGE.region, p[0], p[1]); ctx.fillText(KNOWLEDGE.region, p[0], p[1]);
      }
      ctx.globalAlpha = 1;
    }

    function draw(dt) {
      const d = state.dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.drawImage(bg, 0, 0);
      ctx.setTransform(d, 0, 0, d, 0, 0);
      camFrame();
      const zs = state.cam.zoom > 1 ? Math.pow(state.cam.zoom, 0.55) : state.cam.zoom;   // zooming in should not balloon dots
      for (const n of state.nodes) {
        const p = project(n.x, n.y, n.z);
        n.sx = p[0]; n.sy = p[1]; n.depth = p[3];
        n.sr = (p[2] / state.cam.zoom) * zs;
        if (n.glow > 0) n.glow = Math.max(0, n.glow - dt * 0.5);
      }
      ctx.globalCompositeOperation = 'lighter';   // additive light: order-independent, so nothing needs depth-sorting
      drawVolume();
      drawShell();
      drawEdges();
      drawNodes();
      drawPulses(dt);
      if (!reduced) {   // a faint holographic scan band; decoration
        const yy = ((state.t * 0.08) % 1.2 - 0.1) * state.h;
        const g = ctx.createLinearGradient(0, yy - 40, 0, yy + 40);
        g.addColorStop(0, 'rgba(143,200,255,0)'); g.addColorStop(0.5, 'rgba(143,200,255,.035)'); g.addColorStop(1, 'rgba(143,200,255,0)');
        ctx.fillStyle = g; ctx.fillRect(0, yy - 40, state.w, 80);
      }
      drawLabels();
      ctx.globalCompositeOperation = 'source-over';
      if (state.loading || state.error) {
        ctx.font = '18px ' + FONT; ctx.textAlign = 'center';
        ctx.fillStyle = state.error ? '#ff5f7e' : 'rgba(220,236,255,.7)';
        ctx.fillText(state.error || 'reading every notebook…', state.w / 2, state.h / 2);
      }
      if (state.cut != null) {
        const born = state.nodes.filter(n => n.type === 'memory' && !unborn(n)).length;
        ctx.font = '22px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(220,236,255,.9)';
        ctx.shadowColor = '#000'; ctx.shadowBlur = 8;
        ctx.fillText(new Date(state.cut).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).toUpperCase() + '  ·  ' + born + ' beliefs', state.w / 2, 104);
        ctx.shadowBlur = 0;
      }
      if (state.sampled) {
        ctx.font = '13px ' + FONT; ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(143,160,190,.8)';
        const total = num(state.graph && state.graph.stats && state.graph.stats.memories) + num(state.graph && state.graph.stats && state.graph.stats.knowledge) + state.agents.length;
        ctx.fillText('sampled — showing ' + state.nodes.length + ' of ' + total + ' nodes', state.w - 16, state.h - 104);
      }
    }

    // The station scene keeps redrawing at full rate behind this window. Profiled on a real iGPU PC it took ~30% of
    // the main thread while the brain covered it; 4 fps behind the glass is enough and halved the page's busy time.
    let stationCapped = false;
    const capStation = on => {
      if (on === stationCapped) return;
      stationCapped = on;
      try { if (typeof World !== 'undefined' && World.setFrameCap) World.setFrameCap(on ? 250 : 0); } catch (_) {}
    };
    function loop(now) {
      if (!state.alive) return;
      // a rebuilt console throws its old panes away without calling destroy(); a detached host must stop its own loop
      if (!host.isConnected) { cleanup(); return; }
      const shown = host.offsetParent !== null || document.fullscreenElement === wrap;
      capStation(shown);
      // a frame that costs more than ~8ms draws at 30 fps instead of 60: same motion, half the work on a slow PC
      if (shown && state.cost > 8 && state.last && now - state.last < 30) { state.raf = requestAnimationFrame(loop); return; }
      const dt = Math.min(0.05, state.last ? (now - state.last) / 1000 : 0.016);
      state.last = now;
      if (shown) {
        state.t += dt;
        if (state.warm > 0) { relax(state.warm > 14 ? 12 : 6); state.warm--; }
        const c = state.cam;
        if (state.goal) {
          const g = state.goal, k = Math.min(1, dt * 4);
          c.tx += (g.tx - c.tx) * k; c.ty += (g.ty - c.ty) * k; c.tz += (g.tz - c.tz) * k; c.zoom += (g.zoom - c.zoom) * k;
          if (Math.abs(g.zoom - c.zoom) < 0.002 && Math.abs(g.tx - c.tx) + Math.abs(g.ty - c.ty) + Math.abs(g.tz - c.tz) < 0.002) state.goal = null;
        }
        if (state.autoRotate && !state.drag && now - state.lastInput > 2600) c.yaw += dt * 0.11;
        if (state.replay) stepReplay(dt);
        const t0 = performance.now();
        draw(dt);
        const ms = performance.now() - t0;
        state.cost = state.cost ? state.cost * 0.9 + ms * 0.1 : ms;
      }
      state.raf = requestAnimationFrame(loop);
    }

    // REPLAY: the playhead walks from the first belief ever learned to now; each belief is born (with a flash and a
    // spark from its owner) at its real createdAt. Pure read of the timestamps already in the graph.
    function startReplay() {
      const times = state.nodes.filter(n => n.type === 'memory' && n.createdAt > 0).map(n => n.createdAt).sort((a, b) => a - b);
      if (times.length < 2) { noteBox.textContent = 'Not enough dated beliefs to replay yet.'; return; }
      state.replay = { from: times[0], to: times[times.length - 1], t: 0, dur: Math.min(14, 5 + times.length / 40) };
      state.cut = times[0] - 1;
      state.focus = null; state.team = null; state.selected = null; state.probe = null;
      flyTo(null);
      replayBtn.classList.add('on'); replayBtn.textContent = 'stop';
      renderCrew(); renderDetail();
    }
    function stopReplay() {
      state.replay = null; state.cut = null;
      replayBtn.classList.remove('on'); replayBtn.textContent = 'replay';
    }
    function stepReplay(dt) {
      const r = state.replay;
      r.t += dt / r.dur;
      const before = state.cut;
      state.cut = r.t >= 1 ? r.to : r.from + (r.to - r.from) * r.t;
      for (const n of state.nodes) {
        if (n.type !== 'memory' || !(n.createdAt > before && n.createdAt <= state.cut)) continue;
        n.glow = 1;
        const an = state.byId['agent:' + n.agentId];
        if (an && state.pulses.length < 80) state.pulses.push({ from: an, to: n, age: 0, color: n.color, speed: 1.6 });
      }
      if (r.t >= 1.15) stopReplay();
    }
    replayBtn.addEventListener('click', () => (state.replay ? stopReplay() : startReplay()));

    // ================================================================ panels
    function setPanels(crewOn, sideOn) {
      crew.classList.toggle('off', !crewOn);
      side.classList.toggle('off', !sideOn);
      crewBtn.classList.toggle('on', crewOn);
      sideBtn.classList.toggle('on', sideOn);
      crewBtn.setAttribute('aria-pressed', String(crewOn));
      sideBtn.setAttribute('aria-pressed', String(sideOn));
    }
    function renderCrew() {
      const agents = state.agents;
      crewHead.innerHTML = 'the crew <b>' + agents.length + '</b>';
      const html = [];
      for (const team of TEAM_ORDER) {
        const list = agents.filter(a => a.team === team).sort((a, b) => (b.lead - a.lead) || String(a.label).localeCompare(String(b.label)));
        if (!list.length) continue;
        const T = TEAMS[team];
        const total = list.reduce((s, a) => s + a.memories, 0);
        html.push('<div class="sb-team"><div class="sb-team-h' + (state.team === team ? ' on' : '') + '" data-team="' + team + '" role="button" tabindex="0" aria-pressed="' + (state.team === team) + '" style="color:' + T.color + '">' +
          '<i style="background:' + T.color + '"></i>' + T.label + '<small>' + total + '</small></div>' +
          '<div class="sb-team-r">' + esc(T.region) + '</div>');
        for (const a of list) {
          html.push('<button type="button" class="sb-agent' + (a.memories ? '' : ' cold') + (state.active[a.agentId] ? ' run' : '') + (state.selected === a.id ? ' on' : '') + '" data-id="' + esc(a.id) + '">' +
            '<span class="d" style="background:' + a.color + ';box-shadow:0 0 8px ' + a.color + '"></span>' +
            '<span class="n">' + esc(nice(a.label)) + '</span>' + (a.lead && team !== 'ultron' ? '<span class="l">LEAD</span>' : '') +
            '<span class="c">' + a.memories + '</span></button>');
        }
        html.push('</div>');
      }
      crewList.innerHTML = html.join('') || '<div class="sb-note" style="padding:8px">No agents on the station yet.</div>';
    }
    crewList.addEventListener('click', ev => {
      const a = ev.target.closest('.sb-agent');
      if (a) { select(a.dataset.id, true); return; }
      const t = ev.target.closest('.sb-team-h');
      if (t) toggleTeam(t.dataset.team);
    });
    crewList.addEventListener('keydown', ev => {
      const t = ev.target.closest('.sb-team-h');
      if (t && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); toggleTeam(t.dataset.team); }
    });
    function toggleTeam(team) {
      state.team = state.team === team ? null : team;
      state.focus = null; state.selected = null; state.probe = null;
      if (state.team && TEAMS[state.team]) {
        const a = TEAMS[state.team].anchor;
        flyTo({ x: a[0], y: a[1], z: a[2] }, 1.35);
      } else flyTo(null);
      renderCrew(); renderDetail();
    }

    // ---- selection ----
    function select(id, fly) {
      state.selected = id && state.byId[id] ? id : null;
      state.team = null;
      if (state.selected) state.probe = null;
      const n = state.selected && state.byId[state.selected];
      if (!n) { state.focus = null; renderCrew(); renderDetail(); return; }
      const f = new Set([n.id]);
      for (const e of state.edges) {
        if (e.a === n.id) f.add(e.b);
        else if (e.b === n.id) f.add(e.a);
      }
      if (n.type === 'memory' || n.type === 'knowledge') {
        for (const id2 of Array.from(f)) { const m = state.byId[id2]; if (m && m.agentId) f.add('agent:' + m.agentId); }
      }
      state.focus = f;
      if (fly) flyTo(n, n.type === 'agent' ? (n.team === 'ultron' ? 1.25 : 1.6) : 2.1);
      renderCrew(); renderDetail();
    }

    function agentOf(id) { return state.agents.find(a => a.agentId === id); }
    function linkBtn(n, extra) {
      return '<button type="button" class="sb-link" data-id="' + esc(n.id) + '"><span style="color:' + n.color + '">●</span> ' + esc(nice(n.label)) + (extra ? ' <em>' + esc(extra) + '</em>' : '') + '</button>';
    }
    function renderDetail() {
      const n = state.selected && state.byId[state.selected];
      const s = (state.graph && state.graph.stats) || {};
      if (!n) {
        if (state.probe) {
          const p = state.probe;
          insHead.textContent = 'recall would surface';
          insBox.innerHTML = '<h5>“' + esc(p.text.slice(0, 80)) + '”</h5>' +
            (p.hits.length ? p.hits.map(h => { const m = state.byId[h.id]; const ag = m && agentOf(m.agentId); return m ? linkBtn(m, (ag ? nice(ag.label) : '') + ' · ' + (Math.round(num(h.score) * 100) / 100)) : ''; }).join('')
              : '<p class="k">Nothing in any notebook matches that yet.</p>');
          return;
        }
        if (state.team && TEAMS[state.team]) {
          const T = TEAMS[state.team];
          const list = state.agents.filter(a => a.team === state.team);
          insHead.textContent = 'lobe';
          insBox.innerHTML = '<h5 style="color:' + T.color + '">' + T.label + '</h5><div class="k">' + esc(T.region) + '</div>' +
            '<div class="meta"><span class="k">agents</span><span>' + list.length + '</span><span class="k">beliefs</span><span>' + list.reduce((t, a) => t + a.memories, 0) + '</span></div>' +
            list.map(a => linkBtn(a, a.memories + ' beliefs' + (a.lead ? ' · lead' : ''))).join('');
          return;
        }
        insHead.textContent = 'the mind';
        const tops = state.communities.slice().sort((a, b) => num(b.size) - num(a.size)).slice(0, 5);
        const busiest = state.agents.slice().sort((a, b) => b.memories - a.memories).filter(a => a.memories).slice(0, 4);
        insBox.innerHTML =
          '<div class="meta">' +
          '<span class="k">agents</span><span>' + state.agents.length + '</span>' +
          '<span class="k">beliefs</span><span>' + num(s.memories) + '</span>' +
          '<span class="k">pinned</span><span>' + num(s.pinned) + '</span>' +
          '<span class="k">never recalled</span><span>' + num(s.stale) + '</span>' +
          '<span class="k">avg trust</span><span>' + (Math.round(num(s.avgTrust) * 100) / 100) + '</span>' +
          '<span class="k">cross-talk</span><span>' + num(s.crossAgentLinks) + ' links</span>' +
          '<span class="k">knowledge</span><span>' + num(s.knowledge) + ' imported</span>' +
          '</div>' +
          (busiest.length ? '<div class="k" style="margin-top:8px">knows the most</div>' + busiest.map(a => linkBtn(a, a.memories + ' beliefs')).join('') : '') +
          (tops.length ? '<div class="k" style="margin-top:8px">neighbourhoods</div>' + tops.map(c => '<div>◦ ' + esc(c.label) + ' <span class="k">· ' + num(c.size) + '</span></div>').join('') : '') +
          '<div class="k" style="margin-top:8px">legend</div>' +
          '<div class="sb-legend">' +
          '<span><i style="background:#ff3355"></i>Ultron · the core</span>' +
          '<span><i class="ln" style="background:#2ee6ff"></i>chain of command</span>' +
          '<span><i class="ln" style="background:#dff6ff"></i>lesson shared across agents</span>' +
          '<span><i style="background:#9fb4d9"></i>a belief · brighter = trusted, bigger = recalled more</span>' +
          '<span><i style="background:#7c7bff"></i>graphify / basemode knowledge</span>' +
          '<span><i style="background:#e6f0ff"></i>project or workstream</span>' +
          '</div>' +
          '<p class="k" style="margin-top:10px">Click any neuron, a name in the crew list, or a team to light its lobe. The pale fibres diving through the middle are lessons two agents share — the auto-improve pass reads exactly those.</p>';
        return;
      }
      const rows = [];
      if (n.type === 'agent') {
        const T = TEAMS[n.team] || TEAMS.crew;
        const mems = state.nodes.filter(x => x.type === 'memory' && x.agentId === n.agentId).sort((a, b) => b.useCount - a.useCount);
        const crossTo = {};
        for (const e of state.edges) {
          if (!e.cross) continue;
          const A = state.byId[e.a], B = state.byId[e.b];
          if (A.agentId === n.agentId && B.agentId) crossTo[B.agentId] = (crossTo[B.agentId] || 0) + 1;
          if (B.agentId === n.agentId && A.agentId) crossTo[A.agentId] = (crossTo[A.agentId] || 0) + 1;
        }
        insHead.textContent = n.team === 'ultron' ? 'the core' : n.lead ? 'team lead' : 'crew member';
        rows.push('<h5 style="color:' + mix(n.color, '#ffffff', 0.35) + '">' + esc(nice(n.label)) + '</h5>');
        rows.push('<span class="tag" style="color:' + T.color + '">' + T.label + (n.lead && n.team !== 'ultron' ? ' · LEAD' : '') + '</span>' + (state.active[n.agentId] ? '<span class="tag" style="color:#3dffb5">RUNNING</span>' : ''));
        if (n.role && n.team !== 'ultron') rows.push('<div class="body">' + esc(n.role) + '</div>');
        rows.push('<div class="meta"><span class="k">lobe</span><span>' + esc(T.region) + '</span>' +
          '<span class="k">beliefs</span><span>' + mems.length + '</span>' +
          '<span class="k">pinned</span><span>' + mems.filter(m => m.pinned).length + '</span>' +
          '<span class="k">recalls</span><span>' + mems.reduce((t, m) => t + m.useCount, 0) + '</span></div>');
        const chain = state.edges.filter(e => e.type === 'chain' && (e.a === n.id || e.b === n.id)).map(e => state.byId[e.a === n.id ? e.b : e.a]);
        if (chain.length) rows.push('<div class="k" style="margin-top:6px">' + (n.team === 'ultron' ? 'commands' : 'chain') + '</div>' + chain.map(a => linkBtn(a, (TEAMS[a.team] || TEAMS.crew).label.toLowerCase())).join(''));
        const cross = Object.keys(crossTo).map(id => [agentOf(id), crossTo[id]]).filter(x => x[0]).sort((a, b) => b[1] - a[1]).slice(0, 5);
        if (cross.length) rows.push('<div class="k" style="margin-top:6px">shares lessons with</div>' + cross.map(x => linkBtn(x[0], x[1] + ' shared')).join(''));
        rows.push('<div class="k" style="margin-top:6px">' + (mems.length ? 'most recalled' : 'no beliefs yet — this neuron is wired but quiet') + '</div>' + mems.slice(0, 8).map(m => linkBtn(m, m.useCount + '×')).join(''));
      } else if (n.type === 'memory') {
        const rec = state.records[n.id.slice(4)] || null;
        const ag = agentOf(n.agentId);
        insHead.textContent = 'belief';
        rows.push('<h5>' + esc(nice(n.label)) + '</h5>');
        rows.push('<span class="tag" style="color:' + n.color + '">' + esc(n.kind || 'note') + '</span>' +
          '<span class="tag" style="color:' + (n.confirmation === 'user-confirmed' ? '#3dffb5' : '#8aa0bf') + '">' + esc(n.confirmation || 'inferred') + '</span>' +
          (n.pinned ? '<span class="tag" style="color:#fff">pinned</span>' : ''));
        if (rec && (rec.body || rec.text)) rows.push('<div class="body">' + esc(String(rec.body || rec.text).slice(0, 600)) + '</div>');
        const tr = Math.max(0, Math.min(1, (n.trust + 1) / 2));
        rows.push('<div class="k">trust ' + (Math.round(n.trust * 100) / 100) + '</div><div class="sb-bar"><i style="width:' + Math.round(tr * 100) + '%;background:' + n.color + '"></i></div>');
        rows.push('<div class="meta">' + (ag ? '<span class="k">held by</span><span>' + esc(nice(ag.label)) + '</span>' : '') +
          '<span class="k">recalled</span><span>' + n.useCount + '×</span>' +
          (rec ? '<span class="k">scope</span><span>' + esc(rec.scope || 'global') + '</span><span class="k">learned</span><span>' + ago(rec.createdAt) + '</span><span class="k">last used</span><span>' + ago(rec.lastUsedAt) + '</span><span class="k">origin</span><span>' + esc(rec.origin || '—') + '</span>' : '') +
          '</div>');
        const related = state.edges.filter(e => (e.a === n.id || e.b === n.id) && (e.type === 'similar' || e.type === 'references'))
          .map(e => [state.byId[e.a === n.id ? e.b : e.a], e]).filter(x => x[0]).slice(0, 8);
        if (ag) rows.push(linkBtn(ag, 'owner'));
        if (related.length) rows.push('<div class="k" style="margin-top:6px">related</div>' + related.map(x => linkBtn(x[0], x[1].cross ? 'cross-agent' : x[1].type)).join(''));
      } else if (n.type === 'knowledge') {
        insHead.textContent = 'imported knowledge';
        rows.push('<h5>' + esc(nice(n.label)) + '</h5><span class="tag" style="color:' + KNOWLEDGE.color + '">' + esc(n.source || 'graph') + '</span>' + (n.kind ? '<span class="tag" style="color:#8aa0bf">' + esc(n.kind) + '</span>' : ''));
        rows.push('<p class="k">Reference from an attached graph — it informs the brain, but it is not a belief any agent holds.</p>');
        const nb = state.edges.filter(e => e.a === n.id || e.b === n.id).map(e => state.byId[e.a === n.id ? e.b : e.a]).filter(Boolean).slice(0, 8);
        if (nb.length) rows.push('<div class="k">connected</div>' + nb.map(m => linkBtn(m)).join(''));
      } else {
        insHead.textContent = n.type;
        const mems = state.edges.filter(e => e.b === n.id || e.a === n.id).map(e => state.byId[e.a === n.id ? e.b : e.a]).filter(m => m && m.type === 'memory');
        rows.push('<h5>' + esc(nice(n.label)) + '</h5><div class="meta"><span class="k">beliefs</span><span>' + mems.length + '</span></div>' + mems.slice(0, 10).map(m => linkBtn(m)).join(''));
      }
      insBox.innerHTML = rows.join('');
    }
    side.addEventListener('click', ev => {
      const b = ev.target.closest('.sb-link');
      if (b && b.dataset.id) select(b.dataset.id, true);
    });

    // ---- feed ----
    const FEED_LABEL = {
      'memory.write': ['WRITE', 'sb-w'], 'memory.used': ['RECALL', 'sb-u'], 'memory.proposed': ['PROPOSE', 'sb-p'],
      'memory.forget': ['FORGET', 'sb-f'], 'memory.feedback': ['VERDICT', 'sb-p'],
      'agent.run.start': ['RUN', 'sb-u'], 'agent.run.end': ['DONE', 'sb-w']
    };
    function agentLabel(id) { const a = agentOf(id); return a ? nice(a.label) : String(id || 'station'); }
    function pushFeed(name, payload) {
      const def = FEED_LABEL[name];
      if (!def) return;
      const p = payload || {};
      let what = '';
      if (name === 'memory.write') what = 'learned ' + (p.kind || 'note') + ' · ' + shortId(p.id);
      else if (name === 'memory.used') what = 'recalled ' + shortId(p.id);
      else if (name === 'memory.proposed') what = 'proposes ' + (p.kind || 'note') + ' · ' + shortId(p.id);
      else if (name === 'memory.forget') what = 'forgot ' + shortId(p.id);
      else if (name === 'memory.feedback') what = 'verdict ' + (num(p.delta) > 0 ? '+' : '') + num(p.delta) + ' on ' + shortId(p.id);
      else if (name === 'agent.run.start') what = 'started a run';
      else what = 'finished a run';
      state.feed.unshift({ at: Date.now(), label: def[0], cls: def[1], who: agentLabel(p.agentId), what: what });
      if (state.feed.length > 120) state.feed.length = 120;
      paintFeed();
      if ((name === 'agent.run.start' || name === 'agent.run.end') && p.agentId) {
        if (name === 'agent.run.start') state.active[p.agentId] = true; else delete state.active[p.agentId];
        renderCrew();
      }
      const an = state.byId['agent:' + p.agentId];
      if (!an) return;
      an.glow = 1;
      const color = name === 'memory.forget' ? '#ff5f7e' : name === 'memory.proposed' || name === 'memory.feedback' ? '#ffd166' : name === 'memory.write' ? '#3dffb5' : an.color;
      state.pulses.push({ from: an, to: null, age: 0, color: color, speed: 0.8 });
      const target = state.byId['mem:' + p.agentId + '/' + p.id];
      if (name === 'memory.used' && target) {
        target.glow = 1;
        state.pulses.push({ from: an, to: target, age: 0, color: '#2ee6ff', speed: 0.8 });
      }
    }
    function paintFeed() {
      if (!state.feed.length) { feedBox.innerHTML = '<div class="sb-quiet">Quiet. Send an agent a task — writes, recalls and runs light up here and in the brain as they happen.</div>'; return; }
      feedBox.innerHTML = state.feed.slice(0, 60).map(f =>
        '<div class="sb-row"><time>' + new Date(f.at).toTimeString().slice(0, 5) + '</time>' +
        '<em class="' + f.cls + '">' + f.label + '</em><span>' + esc(f.who) + ' ' + esc(f.what) + '</span></div>'
      ).join('');
    }

    // ================================================================ input
    function pick(x, y) {
      let best = null, bestD = Infinity;
      for (const n of state.nodes) {
        if (unborn(n)) continue;
        const r = Math.max(7, nodeRadius(n) * (n.type === 'agent' ? 2 : 1.6));
        const dx = n.sx - x, dy = n.sy - y, d2 = dx * dx + dy * dy;
        if (d2 > r * r) continue;
        const score = d2 / (r * r) - (n.type === 'agent' ? 0.3 : 0) - n.depth * 0.1;   // prefer agents and near nodes
        if (score < bestD) { bestD = score; best = n; }
      }
      return best;
    }
    function local(ev) { const r = canvas.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; }
    function pinchDist() { const v = Array.from(state.pointers.values()); return v.length < 2 ? 0 : Math.hypot(v[0][0] - v[1][0], v[0][1] - v[1][1]); }
    canvas.addEventListener('pointerdown', ev => {
      if (canvas.setPointerCapture) { try { canvas.setPointerCapture(ev.pointerId); } catch (_) { /* synthetic pointer */ } }
      const p = local(ev);
      state.pointers.set(ev.pointerId, p);
      state.drag = { x: p[0], y: p[1], moved: 0, pinch: state.pointers.size === 2 ? pinchDist() : 0, zoom: state.cam.zoom };
      state.lastInput = performance.now();
      state.goal = null;
      canvas.classList.add('drag');
      wrap.focus({ preventScroll: true });
    });
    canvas.addEventListener('pointermove', ev => {
      const p = local(ev);
      if (state.drag && state.pointers.has(ev.pointerId)) {
        state.pointers.set(ev.pointerId, p);
        if (state.pointers.size === 2 && state.drag.pinch) {
          state.cam.zoom = Math.max(0.55, Math.min(4, state.drag.zoom * pinchDist() / state.drag.pinch));
          state.drag.moved = 99;
        } else {
          const dx = p[0] - state.drag.x, dy = p[1] - state.drag.y;
          state.drag.moved += Math.abs(dx) + Math.abs(dy);
          state.cam.yaw -= dx * 0.006;
          state.cam.pitch = Math.max(-1.2, Math.min(1.2, state.cam.pitch + dy * 0.005));
          state.drag.x = p[0]; state.drag.y = p[1];
        }
        state.lastInput = performance.now();
        tip.classList.remove('on');
        return;
      }
      const n = pick(p[0], p[1]);
      state.hover = n ? n.id : null;
      canvas.classList.toggle('hot', !!n);
      if (n) {
        const ag = n.agentId && agentOf(n.agentId);
        const kind = n.type === 'agent' ? ((TEAMS[n.team] || TEAMS.crew).label + (n.lead && n.team !== 'ultron' ? ' · lead' : '') + ' · ' + n.memories + ' beliefs')
          : n.type === 'memory' ? ((ag ? nice(ag.label) + ' · ' : '') + (n.kind || 'note') + ' · recalled ' + n.useCount + '×')
          : n.type === 'knowledge' ? ('imported · ' + (n.source || 'graph')) : n.type;
        tip.innerHTML = '<b>' + esc(nice(n.label).slice(0, 90)) + '</b><small>' + esc(kind) + '</small>';
        tip.style.left = Math.min(p[0], state.w - 300) + 'px';
        tip.style.top = Math.min(p[1], state.h - 70) + 'px';
        tip.classList.add('on');
      } else tip.classList.remove('on');
    });
    function endPointer(ev) {
      state.pointers.delete(ev.pointerId);
      if (!state.drag || state.pointers.size) return;
      const moved = state.drag.moved;
      state.drag = null;
      canvas.classList.remove('drag');
      if (moved < 5 && ev.type === 'pointerup') {
        const p = local(ev);
        const n = pick(p[0], p[1]);
        if (n) select(n.id, false);
        else if (state.selected || state.team || state.probe) { state.probe = null; state.team = null; select(null); }
      }
    }
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('pointerleave', () => { state.hover = null; tip.classList.remove('on'); });
    canvas.addEventListener('dblclick', ev => {
      const p = local(ev);
      const n = pick(p[0], p[1]);
      if (n) select(n.id, true); else flyTo(null);
    });
    canvas.addEventListener('wheel', ev => {
      ev.preventDefault();
      state.cam.zoom = Math.max(0.55, Math.min(4, state.cam.zoom * Math.exp(-ev.deltaY * 0.0013)));
      if (state.goal) state.goal.zoom = state.cam.zoom;
      state.lastInput = performance.now();
    }, { passive: false });
    wrap.addEventListener('keydown', ev => {
      const tg = ev.target;
      if (tg.closest && tg.closest('input,select,textarea')) { if (ev.key === 'Escape') wrap.focus({ preventScroll: true }); return; }
      if (tg !== wrap && (ev.key === ' ' || ev.key === 'Enter')) return;   // buttons keep their own Space/Enter
      const c = state.cam;
      if (ev.key === 'Escape') { state.probe = null; state.team = null; select(null); flyTo(null); }
      else if (ev.key === 'r' || ev.key === 'R') resetView();
      else if (ev.key === ' ') { ev.preventDefault(); toggleRotate(); }
      else if (ev.key === 'f' || ev.key === 'F') toggleFull();
      else if (ev.key === 'ArrowLeft') c.yaw += 0.12;
      else if (ev.key === 'ArrowRight') c.yaw -= 0.12;
      else if (ev.key === 'ArrowUp') c.pitch = Math.max(-1.2, c.pitch - 0.1);
      else if (ev.key === 'ArrowDown') c.pitch = Math.min(1.2, c.pitch + 0.1);
      else if (ev.key === '+' || ev.key === '=') c.zoom = Math.min(4, c.zoom * 1.15);
      else if (ev.key === '-') c.zoom = Math.max(0.55, c.zoom / 1.15);
      else return;
      ev.preventDefault();
      state.lastInput = performance.now();
    });
    function resetView() {
      state.cam.yaw = Math.PI * 0.8; state.cam.pitch = 0.2;
      state.probe = null; state.team = null;
      select(null); flyTo(null);
    }
    function toggleRotate() {
      state.autoRotate = !state.autoRotate;
      rotBtn.classList.toggle('on', state.autoRotate);
      rotBtn.setAttribute('aria-pressed', String(state.autoRotate));
      state.lastInput = 0;
    }
    function toggleFull() {
      try {
        if (document.fullscreenElement === wrap) document.exitFullscreen();
        else if (wrap.requestFullscreen) wrap.requestFullscreen();
      } catch (_) { /* a host webview without the Fullscreen API simply keeps the window size */ }
    }
    const onFull = () => {
      const on = document.fullscreenElement === wrap;
      fullBtn.classList.toggle('on', on);
      fullBtn.textContent = on ? 'exit full' : 'fullscreen';
      queueFit();
    };
    document.addEventListener('fullscreenchange', onFull);
    crewBtn.addEventListener('click', () => { state.panelsAuto = false; setPanels(crew.classList.contains('off'), !side.classList.contains('off')); });
    sideBtn.addEventListener('click', () => { state.panelsAuto = false; setPanels(!crew.classList.contains('off'), side.classList.contains('off')); });
    rotBtn.addEventListener('click', toggleRotate);
    rotBtn.setAttribute('aria-pressed', String(state.autoRotate));
    resetBtn.addEventListener('click', resetView);
    fullBtn.addEventListener('click', toggleFull);
    if (!document.fullscreenEnabled) fullBtn.hidden = true;

    // ================================================================ actions
    async function load(quiet) {
      if (!quiet) state.error = '';
      try {
        applyGraph(await GET('/api/secondbrain/graph'));
      } catch (e) {
        state.error = 'could not read the brain — ' + ((e && e.message) || e);
      } finally { state.loading = false; }
    }
    refreshBtn.addEventListener('click', () => { refreshBtn.disabled = true; load().then(() => { refreshBtn.disabled = false; }); });

    exportBtn.addEventListener('click', async () => {
      exportBtn.disabled = true;
      noteBox.textContent = 'writing the vault…';
      try {
        const out = await POST('/api/secondbrain/export', {});
        noteBox.innerHTML = 'Wrote <b>' + num(out.files) + '</b> files · ' + num(out.counts && out.counts.memories) + ' beliefs, ' +
          num(out.counts && out.counts.agents) + ' agents, ' + num(out.counts && out.counts.concepts) + ' neighbourhoods → ' +
          '<span style="word-break:break-all">' + esc(out.root || '') + '</span>. Open that folder as a vault in Obsidian.';
        if (typeof notify === 'function') notify('Second brain exported to Obsidian', 'good');
      } catch (e) {
        noteBox.textContent = 'Export failed — ' + ((e && e.message) || e);
        if (typeof notify === 'function') notify('Second brain export failed', 'bad');
      } finally { exportBtn.disabled = false; }
    });

    async function runProbe() {
      const text = probeIn.value.trim();
      if (!text) { probeIn.focus(); return; }
      probeBtn.disabled = true;
      try {
        const out = await POST('/api/secondbrain/recall', { text: text, k: 10 });
        const hits = (out.hits || []).filter(h => state.byId[h.id]);
        state.pulses = state.pulses.filter(p => !p.probe);   // a probe clears the previous wave so the new one reads cleanly
        state.selected = null;
        state.team = null;
        state.focus = hits.length ? new Set() : null;
        hits.forEach((h, i) => {
          const n = state.byId[h.id];
          state.focus.add(n.id);
          const from = state.byId['agent:' + (n.agentId || '')];
          if (from) state.focus.add(from.id);
          state.pulses.push({ from: from || n, to: n, age: -0.12 * i, color: '#2ee6ff', speed: 0.7, probe: true });
        });
        state.probe = { text: text, hits: hits };
        flyTo(null);
        setPanels(!crew.classList.contains('off'), true);
        renderCrew(); renderDetail();
        state.feed.unshift({ at: Date.now(), label: 'PROBE', cls: 'sb-p', who: 'recall', what: '"' + text.slice(0, 40) + '" → ' + hits.length + (hits.length === 1 ? ' belief' : ' beliefs') });
        paintFeed();
      } catch (e) {
        state.feed.unshift({ at: Date.now(), label: 'PROBE', cls: 'sb-f', who: 'recall', what: 'failed — ' + ((e && e.message) || e) });
        paintFeed();
      } finally { probeBtn.disabled = false; }
    }
    probeBtn.addEventListener('click', runProbe);
    probeIn.addEventListener('keydown', ev => { if (ev.key === 'Enter') runProbe(); });

    // AUTO-IMPROVE: the station-wide reflection pass. It only PROPOSES — proposals land in the same Keep/Edit/Discard
    // deck a run uses, so nothing here writes a belief on its own.
    reflectBtn.addEventListener('click', async () => {
      reflectBtn.disabled = true;
      noteBox.textContent = 'reading every notebook for cross-agent patterns…';
      // light the fibres the reflector reads — real cross-agent edges, as a staggered wave out from the core
      let i = 0;
      for (const e of state.edges) {
        if (!e.cross || i >= 60) continue;
        state.pulses.push({ from: state.byId[e.a], to: state.byId[e.b], age: -0.03 * i++, color: '#dff6ff', cross: true, speed: 0.75 });
      }
      const u = state.agents.find(a => a.team === 'ultron');
      if (u) { u.glow = 1; state.pulses.push({ from: u, to: null, age: 0, color: '#ff3355', speed: 0.6 }); }
      try {
        const out = await POST('/api/secondbrain/reflect', {});
        noteBox.innerHTML = out.total
          ? '<b>' + num(out.total) + '</b> proposal(s) staged across ' + (out.staged || []).length + ' agent(s) — they are waiting in the confirm deck: keep, edit or discard each one.'
          : 'Nothing to propose: the crew already holds what the graph shows. (Beliefs you discarded are never re-proposed.)';
        if (typeof notify === 'function' && out.total) notify('Second brain proposed ' + out.total + ' belief(s)', 'good');
      } catch (e) {
        noteBox.textContent = 'Reflection failed — ' + ((e && e.message) || e);
      } finally { reflectBtn.disabled = false; }
    });

    // ATTACH A GRAPH: fold graphify's graph.json or basemode's .base/graph.nq into this same brain (the cerebellum).
    ingestBtn.addEventListener('click', () => { ingestRow.hidden = !ingestRow.hidden; ingestBtn.classList.toggle('on', !ingestRow.hidden); if (!ingestRow.hidden) pathIn.focus(); });
    async function ingest() {
      const p = pathIn.value.trim();
      if (!p) { pathIn.focus(); return; }
      addBtn.disabled = true;
      noteBox.textContent = 'reading ' + kindSel.value + ' graph…';
      try {
        const out = await POST('/api/secondbrain/ingest', { kind: kindSel.value, path: p });
        noteBox.innerHTML = 'Folded <b>' + num(out.nodes) + '</b> nodes / ' + num(out.edges) + ' links from ' + esc(out.source) + ' into the cerebellum.';
        ingestRow.hidden = true; ingestBtn.classList.remove('on'); pathIn.value = '';
        await load();
      } catch (e) {
        noteBox.textContent = 'Could not read that graph — ' + ((e && e.message) || e);
      } finally { addBtn.disabled = false; }
    }
    addBtn.addEventListener('click', ingest);
    pathIn.addEventListener('keydown', ev => { if (ev.key === 'Enter') ingest(); });

    // ================================================================ live wiring
    const wired = [];
    const bus = (typeof U !== 'undefined' && U.bus && typeof U.bus.on === 'function') ? U.bus : null;
    if (bus) for (const name of Object.keys(FEED_LABEL)) { const fn = p => pushFeed(name, p); bus.on(name, fn); wired.push([name, fn]); }
    let refreshTimer = null;
    const bump = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => { refreshTimer = null; load(true); }, REFRESH_DEBOUNCE);
    };
    if (bus) for (const name of ['memory.write', 'memory.forget', 'memory.proposed', 'memory.feedback']) { bus.on(name, bump); wired.push([name, bump]); }

    // Defer the resize to the next frame: fit() writes canvas size inside the observer callback otherwise, which is
    // exactly Chrome's "ResizeObserver loop completed with undelivered notifications". The canvas is absolutely
    // positioned, so it can never size its own wrapper (that fed an endless grow loop before).
    let fitQueued = false;
    const queueFit = () => {
      if (fitQueued) return;
      fitQueued = true;
      requestAnimationFrame(() => { fitQueued = false; if (state.alive) fit(); });
    };
    const ro = (typeof ResizeObserver !== 'undefined') ? new ResizeObserver(queueFit) : null;
    if (ro) ro.observe(wrap); else window.addEventListener('resize', queueFit);

    function cleanup() {
      if (!state.alive) return;
      state.alive = false;
      capStation(false);
      if (state.raf) cancelAnimationFrame(state.raf);
      if (ro) ro.disconnect(); else window.removeEventListener('resize', queueFit);
      if (refreshTimer) clearTimeout(refreshTimer);
      document.removeEventListener('fullscreenchange', onFull);
      if (bus && typeof bus.off === 'function') for (const w of wired) bus.off(w[0], w[1]);
    }

    fit();
    setPanels(!state.compact, !state.compact);
    paintFeed();
    renderDetail();
    load();
    state.raf = requestAnimationFrame(loop);

    return {
      destroy() { cleanup(); host.innerHTML = ''; },
      refresh: () => load()
    };
  }

  return {
    mount: mount, MAX_NODES: MAX_NODES,
    // pure pieces, exported for test/secondbrain-view.test.js
    _anatomy: { TEAMS: TEAMS, KNOWLEDGE: KNOWLEDGE, teamOf: teamOf, isLead: isLead, inside: inside, inCerebellum: inCerebellum, placeAgents: placeAgents }
  };
})();

/* The station-wide door. A per-agent brain lives in the dossier (MEMORY already answers "what does THIS agent
   know"); the second brain answers the other question — "what does the STATION know, and who learned it" — so it
   gets its own window in the CREW dock. It opens WIDE and tall: the brain is the content, not a widget in a pane. */
if (typeof StationUI !== 'undefined' && StationUI.registerWindow) {
  StationUI.registerWindow('brain', 'SECOND BRAIN', body => {
    body.classList.add('brain-body');
    if (typeof SecondBrain === 'undefined') { body.innerHTML = '<p class="muted">The second brain view failed to load.</p>'; return; }
    // a throw here used to leave the window empty with no hint why: say what broke instead
    try { SecondBrain.mount(body); }
    catch (e) {
      const p = document.createElement('pre');
      p.style.cssText = 'margin:0;padding:12px;white-space:pre-wrap;color:#ffb3c0;background:#2a0a10;user-select:text';
      p.textContent = 'The second brain hit an error — ' + String((e && (e.stack || e.message)) || e).slice(0, 1200);
      body.appendChild(p);
    }
  }, { wide: true, className: 'brain-win' });
}

if (typeof module !== 'undefined' && module.exports) module.exports = SecondBrain;
