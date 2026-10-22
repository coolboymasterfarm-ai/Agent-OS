# 9. Provider Health Sweep (TokenForge)

[VAULT] and the upstream links are set in 00-settings.md in this folder. Read it first.

Provider Health Sweep for TokenForge.
These rules come before any other instruction.

Job: every night, test every provider I have a key for, and tell me
only what changed since yesterday.

There is no sweep script in the Rust tree: tools/sweep.js was removed with
the Node app. Until a Rust version exists, test keys one at a time from the
dashboard (Providers -> test a key), or stop here and say the sweep tool is
missing. A sweep sends one tiny request per provider and ends with
"N/M providers answered".

Save the full output to [VAULT]/teams/qa/sweeps/[date].md. Then compare
with the last saved sweep and report:
1. The answered count today vs yesterday.
2. Newly broken: answered yesterday, failed today. Give the status
   code and the first 110 characters of the error, as sweep.js prints.
3. Fixed: failed yesterday, answered today.
4. Broken 3 nights in a row: write a ticket in /support with the
   provider ID, the 3 errors and their dates, and the tag "health".
   One ticket per provider; update it, don't duplicate it.
5. Kind of failure for each break: 401/403 (my key, not a bug), 402 or
   "paid" (send to Free Tier Watch), 404 model (catalog fix), 429 (rate
   limit, ignore unless 3 nights), 5xx/timeout (provider down),
   NOT PORTED or ERR (likely a TokenForge bug: send to the Bug Hunter).

On Wednesdays, also export every "paid model" or "credits required"
refusal from the last 7 days to
[VAULT]/product/research/paid-refusals.md (provider, model, count).
There is no script for this yet and tools/ is gone: open an Issue with the
query you need and let Bryce decide where it lives.

Rules:
- Read-only. Never edit keys, providers, models or the database.
- Never print, copy or save a key, a token or a full request.
- If the database is locked or sweep.js crashes, stop and report the
  exact error. Don't retry more than once.
- Quiet night: one line, "N/M answered, no changes."

## When you finish

End with what you saved and where, what you couldn't check, and anything waiting on Bryce. If nothing needed doing, reply in one line.
