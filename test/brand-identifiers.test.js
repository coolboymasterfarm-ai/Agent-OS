'use strict';
/* brand-identifiers.test.js — the Agent OS rename is DISPLAY COPY ONLY. This guards both directions:
     1. no source file may show the old name "StarNet"/"STARNET" as a standalone word unless that exact line is a
        known identifier (on-disk folder, persisted/signed bytes, env-name regex, stamp). New copy must say Agent OS.
     2. every load-bearing identifier is still there (env prefixes, header, provider id, paths) and the
        self-window guard recognises BOTH the old and the new window title.
   Adding a legitimate identifier means adding it to KEEP below, with the reason. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };

// A standalone word: not welded to - _ / \ . | $ or letters/digits (same rule the rename used).
const WORD = /(?<![A-Za-z0-9_\-./\\|$])(?:StarNet|STARNET)(?![A-Za-z0-9_\-/\\|$]|\.[A-Za-z0-9])/;
const KEEP = [
  [/'StarNet', 'models'|'StarNet', 'workspaces'|\['StarNet', 'Skynet'/, 'on-disk app folders (existing installs live there)'],
  [/StarNet deliverables/, 'the real deliverables folder name on disk'],
  [/\(\?:STARNET\|SKYNET\)_/, 'env-name prefix regexes (strip/gate STARNET_*/SKYNET_*)'],
  [/MARKET_NAME\s*=|skill package\\0v1|opts\.author \|\| 'StarNet'|doc\.author \|\| 'StarNet'/, 'signed skill catalog / package digest bytes'],
  [/EARLY_ACCESS_BLURB/, 'names the app as registered with Google; its consent screen still says StarNet until that OAuth app is renamed'],
  [/app: 'StarNet'|o\.app \|\| 'StarNet'/, 'config-export envelope stamp'],
];
const SKIP_DIR = new Set(['node_modules', '.git', 'vendor', 'dist']);
const bad = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!/\.(js|mjs|html)$/.test(e.name)) continue;
    fs.readFileSync(p, 'utf8').split(/\r?\n/).forEach((line, i) => {
      if (WORD.test(line) && !KEEP.some(([re]) => re.test(line))) bad.push(path.relative(root, p) + ':' + (i + 1) + '  ' + line.trim().slice(0, 120));
    });
  }
}
for (const d of ['frontend', 'sidecar', 'shared']) walk(path.join(root, d));
// Rust shell: user-visible string literals (dialogs, tray, window title, errors) say Agent OS. Comments are not scanned;
// the on-disk folder joins stay StarNet on purpose.
const RUST_KEEP = [/\.join\("StarNet"\)/, /"StarNet"\)\.join|\[\s*"StarNet"/, /`StarNet`/];
const rustDir = path.join(root, 'src-tauri', 'src');
if (fs.existsSync(rustDir)) for (const f of fs.readdirSync(rustDir).filter((x) => x.endsWith('.rs'))) {
  fs.readFileSync(path.join(rustDir, f), 'utf8').split(/\r?\n/).forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, (m, off) => (line.slice(0, off).split('"').length % 2 === 1 ? '' : m));
    if (/"[^"]*\bStarNet\b[^"]*"/.test(code) && WORD.test(code) && !RUST_KEEP.some((re) => re.test(code))) bad.push('src-tauri/src/' + f + ':' + (i + 1) + '  ' + line.trim().slice(0, 120));
  });
}
ok(bad.length === 0, 'old-name display copy found (say Agent OS, or add a reasoned KEEP entry):\n  ' + bad.join('\n  '));

// ---- identifiers that must survive the rename ----
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
ok(/\(\?:STARNET\|SKYNET\)_/.test(read('sidecar/child-env.js')), 'child-env still strips STARNET_*/SKYNET_*');
ok(/\(\?:STARNET\|SKYNET\)_/.test(read('sidecar/environment.js')), 'environment still gates STARNET_*/SKYNET_*');
ok(/'StarNet'/.test(read('sidecar/workspace-safety.js')), 'workspace-safety still protects the StarNet app folder');
ok(/'StarNet', 'workspaces'/.test(read('sidecar/index.js')), 'the workspace root still lives under StarNet');
ok(/x-starnet-token/i.test(read('sidecar/index.js')), 'the x-starnet-token header is still accepted');
ok(fs.existsSync(path.join(root, 'bin/starnet.js')), 'bin/starnet.js still exists');
ok(/starnet/.test(read('sidecar/providers/registry.js')) || /'starnet'/.test(read('sidecar/index.js')), "the managed provider id 'starnet' is still used");

// productName drives the installer filenames, the Applications/Start-menu entry, the update manifest and the app-data
// id. Renaming it is a release-engineering change (migration + updater), not a copy change; INSTALL.md/README.md quote it.
const tauriConf = JSON.parse(read('src-tauri/tauri.conf.json'));
ok(tauriConf.productName === 'StarNet', 'productName is still StarNet (the installer, updater and install docs depend on it)');

// ---- the self-window guard knows both names ----
const computer = require('../sidecar/tools/builtin/computer.js');
const T = computer.makeComputerTools ? computer._internals : null;
if (T && T.isSelfWindow) {
  for (const title of ['StarNet', 'STARNET - Google Chrome', 'AGENT OS', 'Agent OS', 'Agent OS - Google Chrome'])
    ok(T.isSelfWindow({ title, process: 'chrome', pid: 9 }, []), 'self window recognised: ' + title);
  ok(T.isSelfWindow({ title: 'StarNetwork Monitor', process: 'netmon', pid: 5 }, []) === false, 'a title that only starts with the letters is not the station');
}
console.log('brand-identifiers.test: OK (' + n + ' assertions)');
