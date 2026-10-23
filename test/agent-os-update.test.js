/* node test/agent-os-update.test.js — AGENT OS UPDATES: every merge to main must reach installed apps.
   The chain has four links that live in four files; any one drifting silently strands every install:
     1. the app polls THIS repo's releases (tauri.conf.json endpoint), not upstream StarNet
     2. the Update Center's manual fallback opens the same repo
     3. agent-os-update.yml publishes on push to main, to THIS repo, marked latest, signed with OUR key
     4. the upstream mirror never runs on a schedule (it would mark StarNet releases "latest" here) */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };

const REPO = 'coolboymasterfarm-ai/Agent-OS';
const conf = JSON.parse(read('src-tauri/tauri.conf.json'));
const eps = conf.plugins.updater.endpoints;
ok(eps.length === 1 && eps[0] === 'https://github.com/' + REPO + '/releases/latest/download/latest.json', 'the app polls this repo\'s latest.json');
ok(conf.bundle.createUpdaterArtifacts === true, 'builds still produce the updater .sig');

ok(read('frontend/app/updates.js').includes("'https://github.com/" + REPO + "/releases/latest'"), 'manual fallback opens this repo\'s releases');
ok(!/androoAGI\/starnet-releases/.test(read('frontend/app/updates.js')), 'no upstream feed left in the Update Center');

const UpdateCore = require('../frontend/app/updatecore.js');
ok(UpdateCore.CHECK_INTERVAL_MS <= 60 * 60 * 1000, 'a running app checks at least hourly');

const wf = read('.github/workflows/agent-os-update.yml');
ok(/on:\s*\n\s*push:\s*\n\s*branches:\s*\[main\]/.test(wf), 'publishes on every push to main');
ok(/workflow_dispatch:/.test(wf), 'can be run by hand');
ok(/STARNET_RELEASES_REPO:\s*\$\{\{\s*github\.repository\s*\}\}/.test(wf), 'releases go to this repo');
ok(/secrets\.AGENT_OS_UPDATER_KEY\b/.test(wf) && /secrets\.AGENT_OS_UPDATER_PUBKEY\b/.test(wf), 'signed with this repo\'s own updater key');
ok(!/secrets\.TAURI_SIGNING_PRIVATE_KEY\b/.test(wf), 'never the upstream signing secret');
ok(/--latest/.test(wf), 'the release is marked latest, so the feed moves');
ok(/github\.run_number/.test(wf), 'version grows with every run');
ok(/release-bump\.mjs \$v --no-tag/.test(wf) && /npm run release:cut/.test(wf), 'uses the house bump + cut scripts');
ok(/Remove-Item \$keyFile/.test(wf), 'the key file is deleted after signing');

const mirror = read('.github/workflows/sync-source-release.yml');
ok(!/^\s*schedule:/m.test(mirror), 'the upstream mirror never runs on a timer');

console.log('agent-os-update.test: OK (' + n + ' assertions)');
