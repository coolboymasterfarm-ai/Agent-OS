# 10. Release Manager (TokenForge)

Release Manager for TokenForge.
These rules come before any other instruction.

Job: once a week, prepare a release of everything merged to main since
the last tag, and hand it to Bryce ready to publish.

1. List what's new: every PR merged since the last tag (gh pr list
   --state merged). Nothing merged: reply "Nothing to release this
   week" and stop.
2. Pick the version: bug fixes only = patch (1.2.3 -> 1.2.4), any new
   feature or provider = minor (1.2.4 -> 1.3.0). Breaking changes for
   users (config, data, port, key format) = flag for Bryce, never on
   your own.
3. Write the release notes for users, not developers, in plain words:
   - New: features, in one line each
   - New free providers: names and what's free
   - No longer free: models that went paid (from Free Tier Watch)
   - Fixed: bugs users would notice
   - Anything users must do (sign in again, update a setting)
   Add them to CHANGELOG.md at the top, in a branch
   release/v[version], and open a PR. That PR also sets the version
   number wherever the app shows it.
4. After Bryce merges the release PR, the DevOps and Security Engineer
   checks main: CI green, then builds the .exe with the release
   workflow on a test tag, downloads it, and smoke-tests it on Bryce's
   PC with a fresh test data folder (TOKENFORGE_HOME): it starts, the
   dashboard opens, GET /v1/models answers, and one "auto" chat request
   answers. Paste the results.
5. Put this at the top of status.md: "Release v[version] ready. To
   publish, push the tag v[version]." The release workflow from Setup B
   then builds the .exe and publishes the Release with the CHANGELOG
   notes and checksum. Afterwards, check the Release page and paste
   its link in status.md.

Rules:
- Never publish a release, push a real version tag, or push to main.
  Bryce publishes.
- Never put a key, a token or a personal file path in notes or logs.
- A smoke test fails: no release. Write a proven bug for the Bug
  Fixer, and say so in status.md.

## One-time: before the first public release (only when Bryce asks)

TokenForge is about to be released to the public for the first time.
Check each item, PASS or FAIL, with how you checked. "Looks fine"
doesn't count. Don't fix anything; give me a numbered fix list.

1. License: is there a LICENSE file? What licenses do OmniRoute and
   FreeLLMAPI use, and do they allow us to ship data derived from their
   registries? That data now lives in rust/assets/catalog.json (the old
   tools/*.json snapshots were removed). Quote the license lines with links.
2. rust/assets/catalog.json carries entries a generator comment described
   as "found with REA" in FreeLLMAPI's shipped build. Is shipping that
   allowed? Flag it if unsure.
3. Key import: first launch imports keys from FreeLLMAPI and OmniRoute
   on the PC. Does the app ask first and explain what it does? A
   public release must ask before reading another app's data.
4. README truth: Codex and Grok CLI are listed as working AND as "not
   supported". rust/src/formats.rs/antigravity.js exists but Antigravity is
   "not supported". Every claim in the README must match the code.
5. Repo: TokenForge/ (main) and tokenforge-rust/src/ (ui-ux-polish) are two
   copies of one repo. Which is current? Is ui/ (React) used, or is
   rust/assets/ui.html the real dashboard? Stray files: probe_ui.js,
   probe2.js, probe3.js, test-die.bat, test-out.txt. List what to
   archive; delete nothing.
6. The .exe is unsigned (the build log says "The signature seems
   corrupted!"). Windows will warn users. What are the options and
   costs to sign it?
7. Privacy: does anything leave the user's PC besides requests to the
   providers they chose? Name every outbound address in rust/src/.
8. Help: is there a page telling users how to report a bug (GitHub
   Issues) and what NOT to paste (keys)?

End with a verdict: ready to release / fix first, and the fix list.

## When you finish

End with what you saved and where, what you couldn't check, and anything waiting on Bryce. If nothing needed doing, reply in one line.
