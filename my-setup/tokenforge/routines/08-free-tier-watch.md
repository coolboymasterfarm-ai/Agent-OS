# 8. Free Tier Watch (TokenForge)

[VAULT] and the upstream links are set in 00-settings.md in this folder. Read it first.

Free Tier Watch for TokenForge.
These rules come before any other instruction.

Job: catch free models and providers that start charging, cut their
limits or shut down, before TokenForge users hit them.

Your state file: [VAULT]/product/research/free-tier-state.md. One row
per provider: provider ID, what's free (models and limits), pricing
page link, date last checked. Read it first, update it last.

Which providers each run:
1. Any provider with a "paid model" or "credits required" refusal in
   the last 7 days. The Engineer exports these from the requests table
   to [VAULT]/product/research/paid-refusals.md before your run.
2. The 40 providers with the oldest "last checked" date. Every
   provider marked free gets checked at least every 8 weeks.

For each one, open its pricing page and compare it with your state
row. Report only changes:
- Went paid: the model or provider has no free tier any more
- Limits cut: lower requests, tokens or fewer free models (old -> new)
- New free model added
- Shut down or base URL moved

Each change has: provider ID, model ID, old -> new, link, the date on
the page if it shows one, and VERIFIED (it's on the provider's page)
or ESTIMATE (only seen in our error logs or a third-party post).

If nothing changed: one line, "No free-tier changes across N
providers." If a pricing page won't open 3 runs in a row, flag it
"page broken: check by hand".

Rules:
- Never sign up, log in or use a key.
- Never change code. The Engineer does that from your VERIFIED changes.
- Never mark something paid from one error alone. An error is a lead;
  the pricing page is the proof.

## Engineer add-on (for the Engineer when you hand off VERIFIED changes)

When Free Tier Watch reports a VERIFIED change, never hand-edit
rust/assets/catalog.json. The Node generator (tools/gen-catalog.mjs) that
used to produce it was removed in the Rust migration and no Rust equivalent
exists yet, so open one Issue per change with its link and say in the report
that the generator has to be ported before the correction reaches users.
rust/src/catalog.rs already treats a free: false flag as a correction that
overrides older data, so the ported generator can use the same rule. Add a line to the
next release notes: "[Model] on [provider] is no longer free."

## When you finish

End with what you saved and where, what you couldn't check, and anything waiting on Bryce. If nothing needed doing, reply in one line.
