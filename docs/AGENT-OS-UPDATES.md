# Agent OS updates — merge to main, every install updates itself

Once this is set up, you never build or copy installers by hand again:

1. You merge a PR (or push to `main`).
2. GitHub builds a signed Windows installer and publishes it as a Release on this repo, marked **Latest**
   (`.github/workflows/agent-os-update.yml`, about 20–40 minutes; docs-only changes are skipped).
3. Every installed Agent OS checks this repo's update feed when it starts and every 30 minutes while it runs.
   When it sees the new version, the Update Center offers it; one click installs and restarts. Your agents,
   memory and settings are kept (they live outside the app folder the installer replaces).

Version numbers look like `0.14.7`: the last number is the build count, so each one is newer than the last.

## One-time setup (about 5 minutes, on your PC)

### 1. Make your own updater key

Updates are signed so the app only installs builds that came from you. Open a terminal **in your Agent OS folder**
and run:

```bash
npx @tauri-apps/cli signer generate --ci -w "%USERPROFILE%\.tauri\agent-os-updater.key"
```

(PowerShell: use `"$env:USERPROFILE\.tauri\agent-os-updater.key"`.) It makes two files:

- `agent-os-updater.key` — **private**. Never share it, never commit it. Back it up somewhere safe: if you lose it,
  installed apps can't accept new updates until you reinstall once by hand.
- `agent-os-updater.key.pub` — public, safe to share.

### 2. Give GitHub the key

On GitHub: **Agent-OS repo → Settings → Secrets and variables → Actions → New repository secret**, twice:

| Name | Value |
| --- | --- |
| `AGENT_OS_UPDATER_KEY` | the whole contents of `agent-os-updater.key` |
| `AGENT_OS_UPDATER_PUBKEY` | the whole contents of `agent-os-updater.key.pub` |

Or from the terminal, if you use the GitHub CLI:

```bash
gh secret set AGENT_OS_UPDATER_KEY    -R coolboymasterfarm-ai/Agent-OS < "%USERPROFILE%\.tauri\agent-os-updater.key"
gh secret set AGENT_OS_UPDATER_PUBKEY -R coolboymasterfarm-ai/Agent-OS < "%USERPROFILE%\.tauri\agent-os-updater.key.pub"
```

### 3. Make the first build

**Actions → agent-os-update → Run workflow** (or just merge any PR). When it finishes, the
[Releases page](https://github.com/coolboymasterfarm-ai/Agent-OS/releases/latest) has the new installer.

### 4. Install that build once, by hand

The app you have now still trusts the original StarNet update feed, so it can't find your builds yet. Download
`StarNet_<version>_x64-setup.exe` from the release above and run it over your current install — your data is kept.

From then on, every merge reaches you automatically.

## Checking it

- **Is a build running / did it fail?** Repo → **Actions → agent-os-update**. If the first step says *Updater key
  missing*, step 2 above wasn't done.
- **What does the app see?** In the app, open the Update Center and press *Check now*.
- **What is the feed serving?** <https://github.com/coolboymasterfarm-ai/Agent-OS/releases/latest/download/latest.json>

## What changed to make this work

- `src-tauri/tauri.conf.json` and `frontend/app/updates.js` point at this repo instead of `androoAGI/starnet-releases`.
- The build bakes in **your** public key (from `AGENT_OS_UPDATER_PUBKEY`), so installed apps accept only builds you signed.
- `sync-source-release.yml` no longer runs every 15 minutes. It mirrored upstream StarNet releases into this repo
  and marked them latest, which would have replaced your updates with theirs. It can still be run by hand.
- Running apps check every 30 minutes (was 6 hours).
- `test/agent-os-update.test.js` fails if any of these links drift.
