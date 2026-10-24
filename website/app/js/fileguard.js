/* frontend/js/fileguard.js — the file:// guard.
 *
 * Agent OS is ONE program: the sidecar serves this page AND runs the agents behind it. Opened
 * straight off disk (file://) every fetch fails with "URL scheme file is not supported", the boot
 * router ends on an unreachable/blank panel, and the console fills with errors. That is not a broken
 * install, it is the wrong way to launch it — so say the one thing that fixes it.
 *
 * Loaded from <head> (before paint) but kept as an EXTERNAL file on purpose: the served page carries
 * a nonce-based Content-Security-Policy, and an inline script here would be refused on every normal
 * load — a console error in the shipped app for a branch that can never run over http. Over file://
 * there is no CSP, so this file runs and the notice appears.
 *
 * The notice lives in a SHADOW ROOT so the station's global CSS (zoom, collapsed line boxes) cannot
 * reach it and it cannot leak a station style back into the UI. It only ever runs on file://.
 */
(function () {
  'use strict';
  if (location.protocol !== 'file:') return;
  document.documentElement.classList.add('file-open');

  function show() {
    var host = document.createElement('div');
    host.id = 'file-open-notice';
    host.setAttribute('role', 'alert');
    document.body.appendChild(host);
    host.attachShadow({ mode: 'open' }).innerHTML =
      '<style>' +
      '.card { box-sizing: border-box; max-width: 760px; border: 1px solid #ffb347; padding: 30px 34px;' +
      ' background: #0b0906; color: #ffb347; font-family: "VT323", "Courier New", monospace;' +
      ' line-height: 1.45; box-shadow: 0 0 30px rgba(255,179,71,.25), inset 0 0 40px rgba(0,0,0,.8); }' +
      'h1 { font-size: 30px; line-height: 1.2; letter-spacing: 4px; margin: 0 0 16px; }' +
      'p { font-size: 20px; line-height: 1.45; margin: 10px 0; }' +
      'code { color: #ffd9a0; background: rgba(255,179,71,.14); padding: 1px 6px; }' +
      '.dim { color: #b98b52; font-size: 17px; }' +
      '</style>' +
      '<div class="card">' +
      '<h1>&#9670; AGENT OS</h1>' +
      '<p><b>This page was opened straight from the folder, so there is no station service behind it.</b></p>' +
      '<p>Agent OS is one program: the interface you see and the agents that do the work are served' +
      ' together, so <code>frontend/index.html</code> on its own can only ever be a dead station.</p>' +
      '<p>Start it properly &mdash; in a terminal at the project folder run <code>npm ci</code> once, then' +
      ' <code>npm start</code>, and open <code>http://127.0.0.1:8787</code>.</p>' +
      '<p class="dim">In the installed desktop app, launch Agent OS from your Applications / Start menu instead.</p>' +
      '</div>';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show);
  else show();
})();
