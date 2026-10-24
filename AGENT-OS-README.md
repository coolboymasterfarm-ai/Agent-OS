# Agent OS

Agent OS is the desktop app in this repository: a local-first, pixel-art station where AI
agents do real work with real models and tools. The product documentation lives in
[README.md](README.md); this file only orients you in the source tree.

## Run it

```bash
npm ci          # install dependencies once
npm start       # serves the UI and the agent engine together on http://127.0.0.1:8787
```

`npm start` is the whole product: the same process serves `frontend/` and runs the agent
loop. Opening the frontend from a plain static server (or as a file) leaves the station with
no engine behind it, and the top bar will honestly read **LINK DOWN** — that is not a bug in
the app, it means the engine is not running.

Desktop build (Tauri shell + the same sidecar):

```bash
npm run desktop:dev
npm run desktop:build
```

## Check your changes before you rely on them

```bash
npm run check     # fast: syntax + reference + JSON sanity across the tree (seconds)
npm run test:fast # the real merge gate (~1250 steps); run it before a release
```

`npm run check` is the cheap guard against the usual self-inflicted breaks — a typo in a
module, an edited `index.html` that points at a file that no longer exists, a stylesheet or
script added without the file being saved. `npm run test:fast` is the authoritative gate.

## Upstream

Agent OS is a fork of [StarNet](https://github.com/androoAGI/starnet). The MIT licence covers
the code; the StarNet name and original artwork are not licensed with it, which is why this
fork carries its own wordmark. Internal identifiers (`STARNET_*` env names, the
`X-StarNet-Token` header, the `StarNet` workspace folder, `productName`) intentionally keep
their original names: they are the on-disk and wire contracts that keep existing installs,
saves and the updater working. `test/brand-identifiers.test.js` pins both directions of that
rule — display copy says Agent OS, load-bearing identifiers stay put.
