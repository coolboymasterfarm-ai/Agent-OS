[Growth Lead] — Growth plan for the TokenForge updater fix work line

Everything in this plan is DRAFT only. Nothing is sent, posted, published, or merged without Commander approval. No feature that does not exist yet is described as available. No money is spent. No keys are printed.

---

Piece 1 — Content Marketer (copywriter): update script release notes

Deliverable: a draft CHANGELOG.md entry for the updater fix, saved to
C:\Users\bryce\Downloads\tokenforge\routines\growth-drafts\update-fix-changelog.md

What it covers:
- The five original failures, each described in plain user language
  ("the updater used to say UPDATE COMPLETE even when the build had
  failed" — not "fixes exit code -196608").
- What now happens on a failed run: the script prints UPDATE FAILED
  with the reason, restores the backup exe, and leaves the installed
  app untouched.
- The three-backup cap: "you can roll back to the last three
  known-good builds; older ones are pruned automatically."
- The app-close guard: "if TokenForge is open when you run the
  updater, it is closed first, then the new build is installed, and
  the app is restarted."

Done means:
- Every claim in the draft points to a behaviour that is in the
  corrected update-from-github.bat and build.ps1 — no
  forward-looking features.
- The draft is self-contained: a user who reads only this entry
  understands what changed and why it matters to them.
- The draft is tagged [Growth Lead] and saved to the path above, not
  merged or published.

---

Piece 2 — Social Content Maker (copywriter-2): two social posts

Deliverable: a draft file with two posts, saved to
C:\Users\bryce\Downloads\tokenforge\routines\growth-drafts\update-fix-social.md

Post 1 — the problem, for the "I use local AI routers" audience:
- One-line hook that names the pain: "Your updater should never tell
  you the build worked when it did not."
- Two to three sentences describing what went wrong (false success,
  locked files, old exe left in place) without exposing internal log
  details.
- A single CTA: "The updater now verifies the new exe before it
  touches the installed app."

Post 2 — the fix, for the developer audience:
- One-line hook: "Three versioned backups, a pre-build app-close
  check, and a verify-before-install step."
- Short paragraph on the verify step: the new exe must exist, be at
  least 1 MB, and hash-match the installed copy before UPDATE
  COMPLETE prints.
- No screenshots of logs, no commit SHAs, no error codes.

Done means:
- Each post is under 280 characters for the platform the Commander
  picks; the draft notes the character count.
- Neither post invents a user count, download number, testimonial,
  or "people are saying" claim.
- Both drafts are tagged [Growth Lead] and saved to the path above,
  not posted anywhere.

---

Piece 3 — Outreach Drafter (copywriter-3): internal status note to the Overseer

Deliverable: a draft status message, saved to
C:\Users\bryce\Downloads\tokenforge\routines\growth-drafts\update-fix-outreach.md

What it covers:
- One line on what the work line fixed (the updater now tells the
  truth about build state).
- Two lines on the QA status: the four-piece QA plan from stage 2 is
  in place; all four probe sets are ready to run once the corrected
  scripts land.
- One line on the growth angle: the changelog and social drafts above
  are ready for Commander review; nothing has been published.
- No request for budget, no request to merge, no request to deploy.

Done means:
- The note is under 150 words.
- It names the two downstream files (changelog draft, social drafts)
  by path so the Overseer can locate them without hunting.
- The note is tagged [Growth Lead], saved to the path above, and not
  sent to anyone.

---

Handoff to next stage

All three pieces are drafted in C:\Users\bryce\Downloads\tokenforge\routines\growth-drafts\.
Nothing is published, posted, sent, merged, deployed, or purchased.
The Commander reviews and approves each piece personally before it
leaves the drafts folder.
