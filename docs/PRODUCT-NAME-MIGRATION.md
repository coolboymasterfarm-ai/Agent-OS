# Plan: renaming the installed app (`productName` StarNet → Agent OS)

Status: **plan only, no code changed.** The display copy already says Agent OS (PR #5); this covers the installed
app's own name. `test/brand-identifiers.test.js` pins `productName` to `StarNet` so it cannot change by accident;
the migration PR below flips that pin deliberately.

## What stays stable (do not touch)
- `identifier` = `ai.skynet.harness`: the app-data folder, WebView storage and OS-keychain service all key off it.
  Keeping it means **no data or credential migration**.
- Process/binary names (`skynet-desktop`), crate names, env var names, the `starnet` provider id.

## What `productName` currently drives (found in this repo)
| Area | Where | Effect of renaming |
|---|---|---|
| Windows uninstall key `…\Uninstall\StarNet` | `src-tauri/installer/hooks.nsh` lines ~79–85 (manual-upgrade detection reads `UninstallString`, `DisplayVersion`, `InstallLocation`) | New installer would not find existing installs → side-by-side installs, no in-place upgrade |
| Installer / asset names `StarNet_<ver>_x64-setup.exe`, `.sig`, DMGs | `.github/workflows/release.yml`, `scripts/release-cut.mjs`, `scripts/update-canary.mjs`, `scripts/verify-macos-intel-installed.sh`, `docs/RELEASE_RUNBOOK.md`, `README.md`, `INSTALL.md` | Release automation and docs reference the old names |
| Start-menu / Applications entry, install folder, `StarNet.app` | Tauri bundler (derived from `productName`) | Users see a new app name; macOS app path changes |
| Updater feed | `latest.json` at `androoAGI/starnet-releases` | Must point at the renamed assets and keep the same signing key (`pubkey` in `tauri.conf.json`) |
| Window title | already `Agent OS` (PR #5); self-window guard accepts both | none |

## Recommended order (each step shippable and reversible)
1. **Transitional installer.** Teach `hooks.nsh` to read **both** `Uninstall\StarNet` and `Uninstall\Agent OS` (HKCU and HKLM), so a new installer upgrades an old install in place and vice versa. Ship this under the *old* name first. This is the step that prevents double installs.
2. **Release automation.** Parameterise the asset name in `release.yml` / `release-cut.mjs` / `update-canary.mjs` / the verify scripts; keep publishing the old asset name alongside the new one for at least one release so existing updaters and bookmarked links keep working.
3. **Flip `productName`** to `Agent OS`, update `INSTALL.md` / `README.md`, and change the pin in `test/brand-identifiers.test.js`.
4. **Upgrade proof.** Run the existing packaged-lifecycle and upgrade-continuity proofs (`scripts/qa/public-upgrade-continuity.mjs`, `.github/workflows/g1-packaged-lifecycle.yml`, `t0-clean-install-proof.yml`) from the last StarNet-named release to the first Agent OS-named build on clean Windows and macOS machines.
5. **Retire** the old asset name and the old-key fallback only after the update feed shows the installed base has moved.

## Not verified (needs a real Windows/macOS build)
- Exactly which installer strings the Tauri bundler derives from `productName` versus `identifier` (shortcut name, install folder, DMG volume name). This list is from reading the repo, not from building it.
- Whether the updater accepts a differently named asset under the same `latest.json` signature (expected yes, since it follows the URL, but unproven here).
- macOS: whether a renamed `.app` keeps Gatekeeper/notarization continuity and the existing keychain ACLs (the stable `identifier` should, but test it).

## Rollback
Steps 1–2 are additive. If step 3 misbehaves, revert the `productName` flip; the dual-key installer and dual asset names keep both versions upgradable.
