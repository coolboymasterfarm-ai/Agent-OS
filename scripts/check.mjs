#!/usr/bin/env node
/* scripts/check.mjs — the fast "did I just break the app?" guard.

   `npm run test:fast` is the authoritative gate, but it runs ~1250 steps and takes minutes.
   This is the ten-second version, aimed at the mistakes a hand edit actually makes:

     1. SYNTAX   every shipped .js / .mjs / .cjs file still parses (node --check).
     2. REFS     every local src/href in frontend/index.html exists on disk, and every
                 url(...) a stylesheet asks for resolves.
     3. JSON     the manifests the app and the desktop shell read still parse.

   It only reads the tree; it never writes, starts a server or touches a workspace. Exit 0 means
   "nothing obviously broken", not "the gate is green" — say that plainly on success.
   Run the real gate before a release:  npm run test:fast */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CODE_DIRS = ['frontend', 'sidecar', 'shared', 'bin', 'scripts'];
const SKIP_DIRS = new Set(['node_modules', '.git', 'vendor', 'dist', 'frontend-dist', 'frontend-embed']);
const problems = [];

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const walk = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};

/* ---- 1. syntax ---------------------------------------------------------- */
function checkSyntax(files) {
  const pool = 8;
  let next = 0;
  let parsed = 0;
  return new Promise((resolve) => {
    const worker = () => {
      const i = next++;
      if (i >= files.length) return resolve();
      const file = files[i];
      const child = spawn(process.execPath, ['--check', file], { stdio: ['ignore', 'ignore', 'pipe'] });
      let err = '';
      child.stderr.on('data', (d) => { err += d; });
      child.on('close', (code) => {
        if (code === 0) parsed++;
        else problems.push('syntax: ' + rel(file) + '\n  ' + err.split('\n').filter(Boolean).slice(0, 4).join('\n  '));
        worker();
      });
    };
    for (let i = 0; i < pool; i++) worker();
    if (!files.length) resolve();
  }).then(() => parsed);
}

/* ---- 2. references ----------------------------------------------------- */
function checkRefs() {
  let checked = 0;
  const html = path.join(ROOT, 'frontend/index.html');
  if (fs.existsSync(html)) {
    const src = fs.readFileSync(html, 'utf8');
    for (const m of src.matchAll(/(?:src|href)="([^"]+)"/g)) {
      const url = m[1];
      if (/^(?:[a-z]+:|\/\/|#|data:)/i.test(url)) continue;     // remote, anchor, inline
      const raw = url.split('?')[0].split('#')[0];
      if (!raw) continue;
      const file = raw.startsWith('/') ? path.join(ROOT, raw) : path.join(ROOT, 'frontend', raw);
      checked++;
      if (!fs.existsSync(file)) problems.push('ref: frontend/index.html -> ' + url + ' (no such file)');
    }
  }
  const cssDir = path.join(ROOT, 'frontend/css');
  for (const file of walk(cssDir).filter((f) => f.endsWith('.css'))) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
      const url = m[1].trim();
      if (/^(?:[a-z]+:|\/\/|#|data:)/i.test(url)) continue;
      if (url.includes('var(') || url.includes('$')) continue;   // theme tokens, not paths
      const raw = url.split('?')[0].split('#')[0];
      checked++;
      if (!fs.existsSync(path.resolve(path.dirname(file), raw))) {
        problems.push('ref: ' + rel(file) + ' -> ' + url + ' (no such file)');
      }
    }
  }
  return checked;
}

/* ---- 3. JSON ----------------------------------------------------------- */
function checkJson() {
  let checked = 0;
  const targets = [
    'package.json', 'package-lock.json',
    'src-tauri/tauri.conf.json'
  ].map((p) => path.join(ROOT, p));
  for (const f of walk(path.join(ROOT, 'frontend'))) if (f.endsWith('.json')) targets.push(f);
  for (const file of targets) {
    if (!fs.existsSync(file)) continue;
    checked++;
    try { JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (e) { problems.push('json: ' + rel(file) + ' — ' + e.message); }
  }
  return checked;
}

/* ---- run --------------------------------------------------------------- */
const code = CODE_DIRS.flatMap((d) => walk(path.join(ROOT, d))).filter((f) => /\.(?:js|mjs|cjs)$/.test(f));
const parsed = await checkSyntax(code);
const refs = checkRefs();
const json = checkJson();

if (problems.length) {
  console.error('\ncheck: ' + problems.length + ' problem(s) — the app can fail to boot on any of these:\n');
  for (const p of problems) console.error('  ✗ ' + p + '\n');
  console.error('fix these, then re-run `npm run check`. The full gate is `npm run test:fast`.');
  process.exit(1);
}
console.log('check: OK — ' + parsed + ' files parse, ' + refs + ' local references resolve, ' + json + ' JSON manifests valid.');
console.log('       (fast sanity only — run `npm run test:fast` before you call a release good.)');
