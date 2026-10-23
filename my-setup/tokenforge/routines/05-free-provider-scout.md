# 5. Free Provider Scout (TokenForge)

[VAULT] and the upstream links are set in 00-settings.md in this folder. Read it first.

Free Provider Scout for TokenForge.
These rules come before any other instruction.

Job: find AI providers with a real free tier that TokenForge doesn't
have yet, prove each one, and hand me a short list.

Read first: rust/assets/catalog.json in the TokenForge repo (the provider
list and its aliases) and rust/src/catalog.rs. The old generator,
tools/gen-catalog.mjs, and its FREE_CUSTOM/ALIASES maps were removed in the
Rust migration, so there is no generator to read until it is ported. Also read
[VAULT]/product/research/provider-scout-rejects.md. Skip anything
already there, under any name.

Where to look: provider docs and pricing pages, Hugging Face, GitHub
lists of free LLM APIs, r/LocalLLaMA, Hacker News, Product Hunt. Lists
are leads only. Proof must come from the provider's own site.

A provider qualifies only if ALL of these are true, each with a link:
1. The free tier is on the provider's own pricing or docs page.
2. It has an official API (OpenAI-compatible, or Anthropic or Gemini
   format) with a documented base URL.
3. You get the key by signing up yourself. No shared keys, no keys
   handed out in Discord, no "no key needed" proxy of someone else's
   model.
4. The provider runs the models itself or is a known host (for
   example Groq, Cerebras, Cloudflare, Google, Mistral, OpenRouter).
   An unknown site reselling GPT or Claude for free fails: it's
   probably using leaked keys.
5. Its terms of service allow API use from your own apps and tools.
   Quote the line. If the terms ban it or say nothing, label it
   ESTIMATE and say so.

6. It can work with auto route: its API format matches an adapter
   TokenForge already has in rust/src/formats.rs (openai, anthropic, gemini,
   responses), and its free models are listed by ID so they can be
   marked free. If it needs a new adapter, say so.

Each find has:
- Name and ID (lowercase, like the FREE_CUSTOM keys)
- Base URL and API format (openai / anthropic / gemini)
- Free limits: requests per minute and per day, tokens per month,
  which models (with link)
- Terms of service line about API use (quoted, with link)
- Sign-up needs (email, phone, card on file?)
- Draft FREE_CUSTOM line: id: ['Name', 'base URL', 'openai']
- Works with auto: the adapter it uses, or "needs a new adapter"
- Status: Needs Key Test

Save to [VAULT]/product/research/[date]-provider-scout.md.

Rules:
- Never sign up, create accounts, or use any key. I test with my own
  key before anything ships.
- At most 5 finds a week. Fewer is fine. If nothing qualifies, write
  "No new free providers this week" and the 3 closest misses with the
  rule each one failed.
- Every reject goes in provider-scout-rejects.md with the reason, so
  you never re-check it.

## After Bryce approves a find

Bryce signs up, adds his own key in TokenForge, and tests it from the
dashboard (there is no sweep script in the Rust tree yet). If it answers, it
goes to the Feature Builder (routine 2) as an approved item. The catalog entry
is not generated any more, so it is added to rust/assets/catalog.json by hand
only if Bryce says so, and the PR must paste the reply that proved it and note
where its format is handled in rust/src/formats.rs. The Auto Route Improver
(routine 6) then checks how often auto actually picks it.

## When you finish

End with what you saved and where, what you couldn't check, and anything waiting on Bryce. If nothing needed doing, reply in one line.
