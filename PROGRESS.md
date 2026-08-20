# Build Progress — hand-off notes

This file is the honest state of the build as of this session's cutoff.
Read this **before** touching code — it tells you exactly what's implemented,
what's verified, and what to do next, mapped to section numbers in
`docs/BUILD_SPEC.md` (the full specification).

## ✅ SESSION 14 NOTE — READ FIRST (Curriculum Analytics epic v1.2.0; sidebar nav; real backend auth v1.3.0; prediction engine rebuild; bottleneck level categorization)

The biggest session yet — six distinct pieces of work, each independently
tested/typechecked/verified live before moving to the next, in this order:

1. **Curriculum Analytics epic (v1.2.0)** — three new department/VP-facing
   modules, all reasoning over real historical enrollment and prerequisite
   data: **Academic Resource Demand Forecasting** (recency-weighted
   regression, same primitive grade/CGPA trend already used), **Curriculum
   Health Monitor** (every course scored 0-100 from real failure rate,
   downstream prereq-chain impact, demand pressure, expected graduation
   delay), and **Course Bottleneck & Dependency Analyzer** (institution-
   wide ranking by cascading-delay impact, plus — advisor-scoped — which
   of an advisor's own advisees are genuinely affected right now). One
   shared risk-scoring primitive (`courseRiskScore.service.ts`), a
   Department/Category filter bar reused across all 6 new pages. Full
   spec: `docs/CURRICULUM_ANALYTICS_BLUEPRINT.md`.
2. **Persistent sidebar navigation** — live UX complaint that the
   horizontal tab bar started wrapping to two lines as new tabs shipped;
   replaced with a persistent left sidebar (all 3 portals), topbar now
   mobile-only. `docs/BUILD_SPEC.md` §19.8.
3. **Deploy-lag defensive crash fix** — live production crash
   (`Cannot read properties of undefined (reading 'length')` on VP
   login), root-caused to GitHub Pages/Railway's non-atomic deploy lag;
   fixed by making the affected frontend code defensive against a
   temporarily-stale API response shape instead of assuming atomic
   deploys. `docs/BUILD_SPEC.md` §19.9.
4. **Real backend authentication (v1.3.0)** — the big one: replaced the
   client-only demo login (a `localStorage` blob, no server round-trip)
   with real server-verified sessions. `POST /api/auth/login` hashes/
   verifies the password (Node's built-in `crypto.scrypt`, no new
   dependency) and issues a bearer token; all ~83 API routes now run
   behind a guard middleware family instead of trusting a client-supplied
   id — closing a real, previously-open gap where any advisor session
   could reach any student's record, not just their own roster. Demo
   passwords are unchanged and still public/documented — this is real
   verification/enforcement, not a claim of production-grade secrecy.
   Full spec: `docs/BUILD_SPEC.md` §20; threat model: `.github/SECURITY.md`.
5. **Prediction engine rebuild** — live report: a student with a strong
   recent record (90.5% last semester) could still be predicted a D
   purely because a historically hard course's own class average was
   low. `expectedPct` rebuilt around exactly what was asked for: the
   student's own real mean + modal grade, the course's own real 3-year
   mean + modal grade (deterministically modeled per-letter distribution,
   compared by density to fix a real band-width bias — a wide F band
   could otherwise "win" over a narrower D/D+ band even when the true
   mean sat in D/D+ range), plus an explicit rising/declining/consistent/
   inconsistent trend adjustment. `docs/BUILD_SPEC.md` §3.1 (rewritten).
6. **Bottleneck Analyzer: level categorization + confirmed roster
   scoping** — direct follow-up to #1: every course table across all 3
   Curriculum Analytics features gained a Level filter (via the shared
   `CourseFilterBar`); the advisor's affected-advisees table gained its
   own Level column/filter and a PDF export column; roster scoping (an
   advisor only ever sees their own real advisees) was re-verified
   against the live route, not just assumed. `docs/
   CURRICULUM_ANALYTICS_BLUEPRINT.md` §6.

Also shipped this session, requested alongside #4-6: a **live production
deployment of the `ejust-academic-advisor` fork** (GitHub Pages + its own
Railway project) — see that repo's own `PROGRESS.md`/`README.md`.
`ejust-academic-advisor` did **not** receive #1-6 above (auth,
Curriculum Analytics, the prediction rebuild, and level categorization
are all `academic-advisor`-only by explicit scope) — see `docs/
COMPARISON.md` in that repo for the current, real feature divergence.

**Verified, not just written:** full backend test suite green after every
batch of #1 and #4 (`npm run test -w packages/api`), `tsc --noEmit` clean
across all three packages after every change, and every piece live-
verified against a real running app (not just unit tests) — including,
for #4, a full cross-role access-denial sweep against the deployed
production app (one role's token can't reach another's data) and a
session-survives-refresh check.

---

## ✅ SESSION 13 NOTE (Venture Board for the whole cohort; night mode)

Direct product-owner follow-up to session 12, two requests:

1. **"Build the Venture Board for all the students in the system"** —
   Mohamed was, since session 9, the one deliberately-unanswered persona so
   the live gate→form→card walkthrough always had a subject. That exception
   is retired: he's now in `inMemoryDb.ts`'s `PRESEEDED_VENTURE_OPT_INS`
   too, with his §11 Scenario N canonical answers baked in, so his Venture
   Board is populated from a cold boot exactly like everyone else's. Two
   groups remain (correctly) excluded, both real business rules, not
   leftover demo scaffolding: Level 1–2 students (`sara-1`, `karim-1`,
   `yara-1`, `hassan-1`, `fatma-1` — the Venture Gate is never shown below
   Level 3, §16.1/§16.8) and the one dismissed student (`nourhan-1` —
   every student self-service route 403s once dismissed, venture matching
   included, so seeding an answer for her would be inert). Updated 2 tests
   in `ventureWiring.test.ts` that had asserted Mohamed's old
   held-out-by-default behavior (172/172 still passing, no new tests — the
   change is a seed-data/comment change, not new logic).
2. **"Add a night mode (dark mode) for the system"** — a real, systemwide
   light/dark theme, not just a CSS class flip on one page. `styles.css`'s
   existing token system (`--paper`, `--ink`, `--accent`, `--rule`,
   `--good`/`--warn`/`--danger` + their `-soft` tints) now has a full dark
   counterpart under `[data-theme="dark"]` (mirrored under
   `prefers-color-scheme: dark`, guarded so an explicit choice always
   wins), plus new component-specific tokens (`--masthead-bg`/`-fg`,
   `--neutral-soft`/`-fg`, `--letter-b`/`-d`, `--venture-*`) so nothing —
   including the gold Venture Match card, which a session-9 note explicitly
   said was "fixed light-gold, not dark-mode-aware" at the time — was left
   behind. New `theme/ThemeContext.tsx` (same localStorage pattern as
   `auth/AuthContext.tsx`) + `theme/ThemeToggle.tsx`, wired into all three
   mastheads (advisor, student portal, Faculty Console) and the login page.
   Defaults to the OS's `prefers-color-scheme` and follows it live until
   the user clicks the toggle once, at which point that choice sticks
   (`localStorage`) across every future visit; `index.html` sets
   `data-theme` before React mounts so there's no flash of the wrong theme.
   One real bug caught along the way: `CgpaTrendChart.tsx`'s inline SVG
   used raw hex literals in `fill`/`stroke` attributes, which don't reliably
   resolve CSS custom properties — moved to `style={{ fill: 'var(--token)' }}`
   so the chart actually follows the theme instead of rendering
   near-invisible dark dots on a dark background.

**Verified, not just written:** 172/172 tests still passing (this session
touched frontend styling + two test assertions, no new backend logic),
`tsc --noEmit` clean in both packages, `vite build` clean, and driven live
in headless Chromium across both themes: Mohamed's Venture Board confirmed
populated from a cold server boot; the toggle round-tripped light → dark →
light on the login page, the advisor console (masthead, sidebar, CGPA
trend chart, transcript table, letter-grade colors), and the student
portal's gold Venture Match card, with zero console errors and no
unreadable/low-contrast text in either theme (verified visually via
screenshots at every step, not just "it rendered without throwing").

## ✅ SESSION 12 NOTE (express interest regardless of score; gate/form moved to Venture Board)

Direct product-owner follow-up to session 11, two requests:

1. **"Regardless of his interest [score], let the student express interest
   and upload a CV for the projects that appear for him"** — previously
   "Express Interest" only rendered for a `suggested` row (score ≥ the 0.80
   `matchThreshold`); a below-threshold project just showed its bars with no
   action. Now every row on the Venture Board — `suggested` AND `unscored`
   — has the file input + "Express Interest" button. New DB function
   `applyToVentureProject(studentId, projectId, cv?)`
   (`inMemoryDb.ts`) and service helper `createDirectApplication`
   (`ventureMatch.service.ts`) handle the below-threshold case: if no
   `StudentVentureMatch` row exists yet, one is created fresh, straight to
   `applied` (skipping `suggested` — there's nothing left to suggest, the
   student already decided). New route
   `POST /students/:id/venture-projects/:projectId/express-interest`
   (keyed by project, not `matchId`, so it works whether or not a row
   exists yet); the old `matchId`-keyed route stays for direct-`matchId`
   callers but the UI no longer calls it. `client.ts`'s `expressInterest`
   was replaced with `expressInterestInProject`, wired into both
   `VentureMatchCard`'s caller (`PortalAdvise.tsx`) and
   `PortalVentureBoard.tsx`.
2. **"The [Venture Gate/Interest Form] questions shouldn't be part of
   Advise Me's recommending, but should live in the Venture Board tab"** —
   `PortalAdvise.tsx` no longer has `venture-gate`/`venture-form` steps at
   all; the retake gate goes straight to the plan. Those two components
   (`VentureGateStep.tsx`, `VentureInterestForm.tsx`) are deleted — their
   UI is now inlined directly in `PortalVentureBoard.tsx` as a "Your
   venture preferences" panel at the top of the tab, pre-filled with
   whatever's currently saved (two new GET routes,
   `GET /students/:id/venture-gate` and `GET /students/:id/venture-interest-form`,
   back this) and re-answerable at any time — saving either one
   immediately reloads the ranked list below. The gold Venture Match card
   on the Plan Results screen (§16.4) is unchanged and still shows if the
   student opted in via the Venture Board at any point — it was already
   read-only/additive, so it needed no code change, only a documentation
   correction (§16.1/§10/§8 step 12 in `docs/BUILD_SPEC.md` no longer say
   the gate is asked inline in "Advise Me").

**Verified, not just written:** 4 new tests (172/172 total passing),
`tsc --noEmit` clean in both packages, `vite build` clean, and driven live
in headless Chromium: a Level 3+ student (Ahmed) ran "Advise Me" and never
saw a venture-gate/interest-form step (confirmed via explicit
`page.locator('text=...').count()` checks returning 0) while his
already-qualifying gold card still rendered; Mona (pre-seeded, opted in,
but below threshold for every project) opened the Venture Board, saw her
saved gate answer highlighted and her quiz answers pre-filled, then
successfully expressed interest with a CV on a project scoring only 14% —
its status flipped to `applied` live. Zero console errors throughout.

## ✅ SESSION 11 NOTE (Venture Board: whole cohort + inline CV viewer)

Direct product-owner follow-up to session 10, two requests:

1. **"Make this modification to all the students in the test cases"** — the
   professor-attribution + CV-upload capability from session 10 was already
   generic (not hardcoded to Mohamed), but only Mohamed had any seeded
   Venture Gate/Interest Form data, so he was the only persona whose Venture
   Board wasn't empty. Fixed by pre-seeding a Venture Gate=YES + Interest
   Form answer for **every Level 3+, non-dismissed seeded student except
   Mohamed** (`ahmed-1`, `omar-1`, `mona-2`, `youssef-3`, `laila-4`,
   `salma-1` — `inMemoryDb.ts`'s new `PRESEEDED_VENTURE_OPT_INS` +
   `seedInitialVentureOptIns()`, wired into both module init and
   `__resetForTests`). Mohamed is deliberately left un-opted-in so the full
   live gate→form→card→apply walkthrough still has a subject. Every one of
   these six students' Venture Board is now populated out of the box, and
   every professor's ranked candidate list shows the whole opted-in cohort,
   not just Mohamed — most score low (probation-ladder students realistically
   don't clear the 0.80 match threshold) and just show up ranked/unscored,
   which is itself an honest demo of the ranking, not a bug. Ahmed's
   transcript also gained two Semester 7 elective attempts (`ECE413`,
   `ECEEL1`, both 90/91%) so he's a **second** persona who genuinely clears
   the 0.80 threshold for two different projects/professors — giving a full
   second live express-interest/CV demo independent of Mohamed's, proving
   the feature isn't special-cased to one student.
2. **"Make the professor view the PDF on the website without downloading
   it"** — `FacultyProjectCandidates.tsx`'s CV link (which used
   `<a download>`, forcing a save-to-disk) is now a **"View CV" button**
   that opens an in-page modal rendering the PDF inline via
   `<iframe src={cvDataUrl}>` — the browser's native PDF viewer, no
   download prompt, no new tab, everything stays on the Faculty Console
   page. The CV file input on both the compact card and the Venture Board
   was tightened from `.pdf,.doc,.docx` to `.pdf` only, since only a PDF can
   actually render in that inline viewer — a `.docx` would just silently
   fail to preview.

**Verified, not just written:** 3 new tests (168/168 total passing),
`tsc --noEmit` clean in both packages, `vite build` clean, and driven live
in headless Chromium: Ahmed's Venture Board showed both projects
pre-populated with "Hosted by..." and real scores with zero clicks through
"Advise Me"; uploading a CV and clicking "Express Interest" worked exactly
like Mohamed's flow; Dr. Salma Adel's Faculty Console showed the whole
opted-in cohort ranked (Ahmed at 95% `applied`, five others `unscored` at
their honest low scores); clicking "View CV" opened the inline modal
without navigating away or triggering a download (confirmed via
`page.url()` staying on the Faculty Console route, zero console errors).
One caveat surfaced during verification, not a code defect: the actual PDF
*content* renders blank inside Playwright's headless Chromium specifically
— confirmed with a bare, app-independent `<iframe src="data:application/pdf;...">`
test page, which also rendered blank — this is a known limitation of
Playwright's bundled headless browser (no PDF-viewer plugin in that build),
not something a real desktop Chrome/Edge/Firefox user would hit; those
browsers render `data:application/pdf` iframes via their built-in viewer
normally. The plumbing (correct data URL delivered to the iframe, no
download attribute, no navigation) is confirmed correct either way.

**Spec updated in place:** `docs/BUILD_SPEC.md` §16.4.1, §16.5, §16.6 all
touched — CV accept type, the inline-viewer mechanism, and a new "Demo
fixture note" documenting the cohort pre-seed and why Mohamed is excluded
from it.

## ✅ SESSION 10 NOTE (Venture Board: professor attribution + CV upload)

Direct product-owner follow-up to session 9: two additions to the student
Venture Board/Match card, both implemented end-to-end.

1. **Which professor hosts each project** — the gold Venture Match card and
   every Venture Board entry now show "Hosted by Dr. [Name]" under the
   title. `VentureProject`/`StudentVentureMatch` themselves stay pure
   (`professorId` only, no denormalized name) — the name is resolved at
   the HTTP boundary (`server.ts`'s new `withProfessorName` helper, applied
   to `/venture-matches` and `/advise`'s `ventureMatch` field) so the
   domain layer never has to know about it. §16.4/§16.5 updated accordingly.
2. **CV upload attached to "Express Interest"** — a file picker (PDF/DOC)
   sits next to every "Express Interest" button (the compact card AND the
   Venture Board); if a file is chosen it's read client-side into a base64
   `data:` URL (`lib/readFileAsDataUrl.ts`) and sent in the same `POST
   .../apply` call — no separate upload step, matching the request's "click
   that he is interested and upload his CV" as one action. A CV is
   optional, never required — new §3.5-adjacent spec language (§16.4.1)
   makes explicit that expressing interest with no file still fully counts.
   `StudentVentureMatch` gained `cvFileName`/`cvDataUrl` (shared type +
   Prisma schema + §1.1 table, all updated). The professor's ranked
   candidate list (Faculty Console) now has a **CV** column — a
   download/view link when present, "none" when not — express.json's body
   limit was raised to 10mb to fit a base64-inflated PDF.

**Verified, not just written:** 5 new tests (165/165 total passing),
`tsc --noEmit` clean in both packages, `vite build` clean, and driven live
end-to-end in headless Chromium: Mohamed answered the gate/form, the card
showed "Hosted by Dr. Youssef Kamel," a real dummy PDF was uploaded via
`page.setInputFiles` and submitted with "Express Interest & Submit CV," and
Dr. Kamel's Faculty Console showed the exact filename as a working download
link next to Accept/Decline. Zero console errors on both sides.

**Spec updated in place, not just code:** `docs/BUILD_SPEC.md` §16.4/§16.5/
§16.6/§1.1/§9.2/§9.3 all touched — this was worth doing since §16.4 already
said "the card shows... the professor's name" (written in session 7 but
never implemented until now); the CV mechanism is genuinely new and got its
own §16.4.1 subsection.

## ✅ SESSION 9 NOTE (§16 Innovation & Venture Catalyst, fully built)

Session 7 wrote §16 into `docs/BUILD_SPEC.md` as documentation only. This
session **implemented it** — every piece of §16, on both the backend and
the frontend, matching the spec's own §11 Scenario N (Mohamed) as the
acceptance test.

**Verified, not just written:** `npx vitest run` → **160/160 passing across
25 files** (32 new tests this session), `npx tsc --noEmit` clean in both
packages, `npx vite build` clean, every new route curl-tested live against
a freshly-booted server (to rule out cross-test state contamination — one
real scare during manual QA turned out to be exactly that, not a bug; see
below), and the full new UI surface — Venture Gate, Interest Form, gold
match card in both the advisor's and student's Plan Results screen, Venture
Board, and the entire Faculty Console — driven live in headless Chromium
with **zero console errors**.

**What was built, mapped to §16:**
1. **§3.5 `ventureFitScore`** — `modules/venture/ventureFitScore.ts` (13
   tests): `courseCompetencyScore` (mean pct/100 across required courses,
   0 for untaken — never excluded from the average), `skillAlignmentScore`
   (50/50 blend of the Venture Interest Form's trait-tag overlap and the
   student's own top-performing-elective-grades overlap, both reusing §6's
   `traitMatchCount`-style normalization), `academicTrajectoryScore` (a
   continuous 0–1 signal: half raw CGPA/4.0, half a bonus flag for
   improving trend or CGPA > 3.0). All three weights + the 0.80 threshold
   live in `predictionWeights.json`'s new `ventureFit` block.
2. **§16.2/§16.3 lifecycle** — `modules/venture/ventureMatch.service.ts` (8
   tests), pure state-transition functions in the same style as
   `proposal.service.ts`: `computeMatchesForStudent` (mints a `suggested`
   row only the first time a score clears threshold; below-threshold scores
   are always returned for display but never persisted), `applyToMatch`,
   `setMatchStatus` (professor accept/decline).
3. **Seed data** — `db/seed/seedVentureProjects.ts`: two professors, four
   venture projects (including §11 Scenario N's exact LoRa project title),
   a `COURSE_SKILL_TAGS` mapping, and `ELECTIVE_COURSE_CODES` computed
   directly from the catalog's `program_elective` courses. Two of the four
   projects are deliberate edge-case fixtures (one seeded at capacity, one
   `isActive:false`) so §16.8's exclusion rules are exercised by the seed
   data itself, not only by hand-written tests.
4. **Mohamed** — a new demo persona (`mohamed-1`) matching §11 Scenario N's
   description verbatim (Level 3, CGPA 3.4, exceptional embedded/
   microcontrollers/ML grades). His Venture Gate answer and interest-form
   responses are deliberately left **unanswered** in the seed (unlike the
   other new personas added in past sessions) so the full live flow —
   gate → form → match → card → express interest → professor accepts — can
   be demoed end-to-end through the UI, not replayed from pre-seeded state.
   Confirmed live: his real score against the LoRa project is **89.6%**
   (the spec's own worked walkthrough approximates ~92% by hand — close
   enough to confirm the formula, not an exact-match requirement).
5. **`inMemoryDb.ts` wiring** — `ventureMatches` field on `StoredStudent`,
   module-level mutable `ventureProjects` (professors create/edit at
   runtime), gate-answer and interest-form-answer maps (same re-askable-
   per-session shape as `retakePreferences`), and ~15 new exported
   functions covering the full lifecycle plus `getTopVentureCardMatch`
   (reused by BOTH the `/advise` route's card injection and the dedicated
   `/venture-matches` route, so there is exactly one code path for
   "does this student have a qualifying match," not two that could drift).
6. **11 routes** in `server.ts`: gate, interest-form, matches, apply,
   professors list/detail, project create/edit, candidates, accept/decline
   — plus the existing `/advise` route now attaches a `ventureMatch` field
   (§8 step 12) without touching `action`/`plan` in any way.
7. **Frontend — student side**: `VentureGateStep`/`VentureInterestForm`
   inserted into `PortalAdvise`'s flow (Level 3+ only, skippable, never
   blocks); `VentureMatchCard` (gold-highlighted, `components/
   VentureMatchCard.tsx`) rendered above the plan in both `PortalAdvise`
   (with a working "Express Interest" button) and the advisor's
   `AdviseFlow` (same card, read-only — the advisor views the student's
   match, never acts on their behalf); `PortalVentureBoard` (new tab,
   Level 3+ only) showing the full ranked list with §6-style breakdown bars.
8. **Frontend — professor side**: a full **Faculty Console** at
   `/faculty/:professorId` (`faculty/FacultyLayout.tsx`,
   `FacultyProjects.tsx` — post/edit/archive projects, `
   FacultyProjectCandidates.tsx` — ranked candidates with Accept/Decline).
   `professor` added as a real third party in the access-control system
   from session 8: `RequireProfessor` guard, `loginAsProfessor` in
   `AuthContext`, a professor picker on the login page. Confirmed live: a
   signed-in professor session is bounced away from both `/` (advisor) and
   `/portal/*` (student) — the three-way separation holds, not just the
   two-way one from session 8.

**A real bug found and fixed during manual QA, not just the automated
tests:** the Venture Match card's CSS had a dark-mode override
(`:root:not([data-theme="light"]) .venture-card`) that was never wrapped in
a `prefers-color-scheme` media query — since this app has no dark-mode
support anywhere else (single "editorial/paper" theme, confirmed by reading
`styles.css`'s `:root` block), that selector matched unconditionally and
rendered the card with low-contrast dark-on-dark text. Caught by actually
looking at a screenshot, not by the type checker or test suite. Fixed by
removing the erroneous rule.

**Judgment calls made, flagged (per §16's own spec header, not silently
decided):** "top-performing elective" is operationalized as points ≥ 3.0
(B or better); the Faculty Console's candidate list is a live read-only
scoring view and does NOT mint `suggested` match rows on the student's
behalf (only the student's own `/venture-matches` call does that) — a
professor can see a 94% candidate with `matchId: null` if that student
hasn't loaded their own Venture Board yet; this is intentional, not a bug.

## ✅ SESSION 8 NOTE (real advisor/student access separation)

Immediate follow-up to session 7: the product owner rejected the "view as
student" / "Advisor View" cross-links §15.1 originally shipped — the two
parties must be unable to reach each other's pages at all. Added a demo
sign-in screen (`/login`, `pages/Login/Login.tsx`) + `localStorage` session
(`auth/AuthContext.tsx`) + route guards (`auth/RequireRole.tsx`,
`RequireAdvisor`/`RequireStudent`) wrapping the router. Verified live with
Playwright, not just by removing the links: an authed advisor session
redirected away from `/portal/sara-1`; an authed student session redirected
away from `/students/sara-1`, `/advisor-console`, **and** another student's
`/portal/karim-1` (own-id-only enforcement, not just role-only). Full
details in `docs/BUILD_SPEC.md` §15.1's updated judgment-call note. No
backend changes; `packages/api` suite is unaffected (128/128 still
passing). `npx tsc --noEmit` and `npx vite build` both clean in
`packages/web`.

## ✅ SESSION 7 NOTE (§15: student portal, best-case grade, dual-approval registration, PDF report)

Direct product-owner request, implemented end-to-end this session: a
student-facing portal (letters only, never a percentage), a "best-case"
grade projection alongside the existing realistic one (both views), a
two-sided advisor/student course-approval-and-registration workflow, and a
client-side PDF roster report for the advisor. Full design written into
`docs/BUILD_SPEC.md` **§15** before any code was touched, per the product
owner's explicit request — read that section for the complete spec; this
note is the "what actually got built" summary.

**Verified, not just written:** `npm install --workspaces`, `npx vitest run`
→ **128/128 passing across 22 files** (14 new tests this session), `npx tsc
--noEmit` clean in both packages, `npx vite build` clean, every new route
curl-tested live (including a real advisor-alternate proposal, a real
student "choose" that both registers and correctly blocks with the
contact-advisor popup), and the entire new UI surface — advisor Proposals
tab, Advisor Console's PDF button (a real file download was captured and
confirmed by a Playwright script, not assumed), and all 5 student-portal
screens — driven live in headless Chromium with **zero console errors**.

**What was built, mapped to §15:**
1. **§15.2 best-case projection** — `modules/prediction/bestCaseProjection.ts`
   (4 tests) computes it (max comparable-category pct, not a regression —
   literally the student's own best-ever result), `modules/prediction/
   whatIfProjection.ts` (2 tests) computes the real expected-vs-best-case
   CGPA delta by running §2.2's `computeCGPA` twice. Wired into `/advise`,
   `/plan/fast`, `/plan/target` (every plan course now carries
   `bestCasePct/Letter/Points`) via a shared `attachBestCase` helper in
   `server.ts`, AND into `/proposals` (§15.3). Rendered in the advisor's
   `CourseSlip`/`PlanResultsStep` (percentages shown) and reused as-is in
   the student portal via a `hidePct` prop (percentages hidden).
2. **§15.3 course proposal / dual-approval workflow** —
   `modules/proposals/proposal.service.ts` (8 tests) is the pure
   state-transition core (`buildProposalsFromPlan`, `approveProposal`,
   `declineProposal`, `buildAdvisorAlternate`, `chooseProposal`), wired into
   `inMemoryDb.ts` (new `proposals`/`registeredCourses` fields on
   `StoredStudent`, plus `addProposalsFromPlan`/`approveProposalById`/
   `declineProposalById`/`addAdvisorAlternateProposal`/`chooseProposalById`/
   `getAdvisorReport`) and 7 new routes in `server.ts`. The advisor's
   `pages/Proposals/ProposalReview.tsx` (approve/decline/propose-alternate,
   percentages shown) and the student's `portal/PortalRecommendations.tsx`
   (side-by-side system-vs-advisor cards, letters only, the contact-advisor
   modal) are two independent UIs over the exact same `CourseProposal` rows
   — confirmed live: an advisor approval made in one tab is immediately
   visible in the other on next load, no sync step needed.
3. **§15.1 student portal** — new `packages/web/src/portal/` route tree at
   `/portal/:id` (`PortalLayout` + `PortalHome`/`PortalAdvise`/
   `PortalTargetCgpa`/`PortalQuiz`/`PortalRecommendations`), reachable from
   the advisor's sidebar ("View as this student →") and vice versa
   ("Advisor View →"). The percentage-hiding rule is enforced by reusing
   the SAME components as the advisor views with a `hidePct` prop
   (`CourseSlip`, `PlanResultsStep`, and new shared `TargetCgpaPlanContent`/
   `QuizContent` extracted from the advisor pages so both views share one
   implementation) — there is exactly one place the API's `expectedPct`
   field gets rendered as text, and the portal components skip it.
4. **§15.4 advisor PDF report** — `lib/pdfReport.ts` (client-side, `jspdf`
   + `jspdf-autotable`, no new backend dependency) driven by
   `GET /api/advisor/report`, wired to a "Generate Report (PDF)" button in
   `AdvisorConsole.tsx`. A real download was captured by Playwright's
   `page.waitForEvent('download')` this session, not just code-reviewed.

**Judgment calls made, flagged (per §15's own header, not silently
decided):** no real login — the portal is reachable by anyone who knows/
picks a student id from its switcher, same category of simplification as
the existing `x-role` admin header; "approve" is per-course, not a
plan-wide bulk action (matches the spec's "modify the recommended
subjects... choose another subject" framing, which is about individual
course swaps); a student choosing an option no one has reviewed yet (no
advisor action at all) routes to the SAME contact-advisor popup as choosing
an explicitly-not-approved option — one general rule, not two special cases.

**Explicitly NOT done:** proposals/registered-courses are in-memory only
(same store, same caveats as session 6); no notification/email actually
contacts the advisor, the popup is informational only; the PDF is a simple
table, not styled/branded.

## ✅ SESSION 6 NOTE (§7 transfer engine, full §9.2 routes, real React frontend)

The user asked for a full gap-analysis against `docs/BUILD_SPEC.md` and to
close the gaps. This session closed the three biggest ones flagged at the
top of this file's old TODO list — every claim below was actually run, not
hand-traced: `npm install --workspaces`, `npx vitest run` (114/114 across 19
files), `npx tsc --noEmit` clean in both `packages/api` and `packages/web`,
`npx vite build` clean, and the full Express route list smoke-tested live
with `curl` (including a real internal transfer, a real external transfer
end-to-end, and a real 403 on a dismissed student).

1. **§7 Transfer execution engine — built from scratch, was entirely
   missing.** `modules/transfer/{courseEquivalency,transferSemester.builder,
   internalTransfer.service,externalTransfer.service}.ts`, all pure
   functions in the same hexagonal style as the rest of `modules/`, 13 new
   tests (`test/unit/transfer/*`). Wired into the in-memory store
   (`executeInternalTransferForStudent`/`executeExternalTransferForStudent`/
   `previewExternalTransfer` in `inMemoryDb.ts`) and into
   `repositoryBackedPorts.ts`'s `alreadyTransferredInternallyOnce` (was
   hardcoded `false`, now queries real `TransferRecord`s). A real bug was
   found and fixed live: the external-transfer preview's "passed courses"
   filter was reusing `getEligibleCourses`' stricter "counts toward prereq
   unlock" definition (excludes D/D+), which wrongly excluded genuinely
   passed D+ courses from transfer consideration — fixed to "anything but F."
2. **`simulateUnderDepartment` replaced** — was a linear-fudge heuristic
   (`cgpa + (fitScore - 0.5) * 1.5`) flagged in session 3 as a stand-in for
   real math. Now `modules/fitEngine/simulateUnderDepartment.ts` re-runs the
   REAL §2.2 `computeCGPA` arithmetic and the REAL §3.4 `ols` trend routine,
   anchored on the student's own demonstrated performance in the candidate
   department's gateway courses. Still flagged, not silently presented as
   spec-complete: no full per-department course catalog is seeded beyond
   ECE, so the "next semester" signal is one hypothetical bundle rather than
   a real candidate-pool/knapsack re-run — see that file's header for
   exactly what's real vs. approximated.
3. **§4.1/§4.5 probation history is now derived, not hand-authored.**
   New `modules/probation/probationHistory.ts#replayProbationHistory`
   replays a student's real `cgpaSnapshots` through the actual state-machine
   functions to produce the full audit log. Every seeded demo student's
   `probationCounter` is now computed this way at load time (`deriveStudent`
   in `inMemoryDb.ts`) — the old "counter seeded directly, not derived from
   history, flagged in the seed data's own comment" caveat from session 5 is
   resolved; Laila's snapshot series was extended by one semester so the
   replay naturally lands on warning 4/6 instead of being hand-forced.
4. **Full §9.2 route list** (`packages/api/src/server.ts`, rewritten):
   retake-preference, plan/fast, plan/target (safety-vs-speed mode), 
   department-fit, faculty-fit, probation (history), cgpa-trend,
   transfer/internal, transfer/external, transfer/preview, courses/:code/chain,
   admin prediction-weights (GET + role-gated PUT that hot-patches the
   shared weights object AND persists to disk), plus `/faculties` and
   `/quiz` lookups the frontend needs. Every route that touches
   advising/transfer/registration now runs `blockIfDismissed` first (spec
   §12's 403-at-the-API-layer rule) — confirmed live against `nourhan-1`
   (the new dismissed demo persona).
5. **Five new demo personas** added to `inMemoryDb.ts` to cover the §11
   scenarios the old three + four warning-ladder students didn't reach live:
   `salma-1` (B), `yara-1` (G, half-load), `nourhan-1` (F, dismissed),
   `hassan-1` (I/K, faculty transfer — its live `/transfer/preview` and
   `/transfer/external` execution was actually exercised end-to-end with
   curl, not just unit-tested), `fatma-1` (M, mandatory-overflow).
6. **A real React frontend** — `packages/web` was a single stub component
   before this session (no router, no `App.tsx`, no build config). Now a
   full Vite + React Router app: `vite.config.ts` (proxies `/api` to the
   Express server), `tsconfig.json`, all 8 screens from spec §10
   (`Dashboard/StudentFile`, `AdviseFlow` with its four sub-steps —
   `RetakeGateStep`/`PlanResultsStep`/`TransferRecommendationStep`/
   `TransferConfirmStep`, `TargetCgpaPlanner`, `DepartmentFitQuiz`,
   `ProbationHistory`, `AdvisorConsole`), a typed `api/client.ts` covering
   every route above, and the 4 components spec §9.1 names
   (`CourseSlip`/`ProbationCounterPill`/`CgpaTrendChart`/
   `TransferExplanationCard`). `npx tsc --noEmit` and `npx vite build` both
   clean. **Actually driven in a real (headless) browser this session**,
   not just typechecked: installed Playwright + Chromium mid-session, ran
   both servers together, and scripted a full user path — loaded the
   dashboard, opened Youssef's (warning 3/6) advise flow through the retake
   gate to a live `RECOMMEND_INTERNAL_TRANSFER` card with real dept-fit
   bars, ran Laila's (warning 4/6) flow all the way to the external
   Transfer Semester preview screen (equivalency-mapped/excluded courses,
   new base CGPA, department picker), viewed Laila's Probation History
   timeline (matches the replayed audit log exactly), built a Target-CGPA
   plan, and loaded the Advisor Console roster. Zero browser console errors
   across all of it. Screenshots aren't committed to the repo (they were a
   one-time verification, not build output) but the path above is
   reproducible any time via `npx playwright install chromium` + a small
   script driving `localhost:5173` against `localhost:3001`.
7. **`docs/HANDBOOK_RULES.md` and `docs/DECISION_TREE.md`** — written from
   scratch, the two files spec §9.1's file tree names and previous sessions
   left undone. Plain-language rule restatement cross-referenced to code,
   and a Mermaid decision-tree diagram of `decideAdvisingAction` kept
   explicitly tied to the `explain` strings the API actually returns.

**Explicitly NOT done this session** (unchanged from before, still real
gaps): no Postgres/Prisma migration (the user explicitly chose to keep the
in-memory store for this session), no real auth/JWT sessions (the admin
route uses a single `x-role` header), no `PlanningRun` audit persistence
(flagged in the Advisor Console screen itself rather than silently
omitted).



This session **had full network access** (npm registry reachable) — every
claim below was actually run, not hand-traced. In order:

1. `npm install --workspaces` → succeeded (198 packages).
2. `npx vitest run` → **39/39 passing**, confirming session 2's untested
   `decideAdvisingAction.test.ts` (7 tests) really does pass exactly as
   session 2's hand-trace predicted. `npx tsc --noEmit` → clean.
3. Completed **PROGRESS.md item 1 in full** (previously the top-of-list
   TODO): added and ran to green —
   - `test/unit/advising/runAdvisingCycle.test.ts` (2 tests) — the full
     async orchestrator against mock `AdvisingCyclePorts`, covering §11
     Example A (`SHOW_PLAN`, and asserts the fit-engine ports are **never
     called** — the tier-1 short-circuit is real, not just documented) and
     an Example-H-shaped flat-trend case (`RECOMMEND_INTERNAL_TRANSFER`,
     exercising every port end-to-end through real `await`s).
   - `test/unit/grading/cgpa.test.ts` (8 tests) — hand-computed weighted
     averages, withdrawal exclusion, 2-decimal rounding, and the §7.2.3
     `sinceSemesterOrdinal` post-transfer anchoring case (confirms old-
     faculty history is excluded once a base snapshot is set), plus two
     `latestAttemptPerCourse` replacement-rule tests.
   - `test/unit/prediction/planPacker.test.ts` (6 tests) — plain knapsack,
     the "0/1 knapsack not greedy" case, coreq bundling, mandatory
     reservation before the optimizer runs, and **§11 Example M** (mandatory
     credits exceeding the cap: highest-`chainUnlockValue` bundles keep
     their reserved seats, the rest lands in `carriedToNextSemester`).
   - All of the above **passed on first run** — no bugs found in the
     session-1/session-2 implementations these tests exercise. That's a
     meaningful signal: `planPacker.ts`, `cgpa.ts`, and the orchestrator's
     async wiring were all correct as originally written, just unverified
     until now.
   - Suite is now **64/64 passing** (`packages/api`, 11 test files),
     `tsc --noEmit` clean.
4. Started **PROGRESS.md item 2, the §6 fit engine**
   (`modules/fitEngine/deptFitEngine.ts`, 9 new tests, all passing):
   - **Important provenance note**: item 2 originally said to port the
     prototype's `QUIZ`/`DEPARTMENTS`/`ALUMNI` constants from
     `test.html` in "the original upload." That HTML file was **not**
     present in this session's upload (only the already-scaffolded
     `academic-advisor` project + `docs/BUILD_SPEC.md` were provided) — so
     `deptFitEngine.ts` is a **from-scratch implementation**, faithful to
     §6's formula and worked Examples H/I/J/K, not a literal port. This is
     flagged in the file's own header comment too. **If the real
     prototype file turns up in a future session, diff its QUIZ/
     DEPARTMENTS/ALUMNI seed data against this file's and prefer the
     original verbatim** — the engine *functions* (`fitScore`,
     `recommendDepartments`, `rankFacultiesByFit`) shouldn't need to change
     either way, only the seed constants might.
   - Implements `fitScore` (the exact 0.5·quiz + 0.3·gateway + 0.2·alumni
     formula, weights read from `predictionWeights.json`'s `deptFit`
     block — added `neutralGatewayPrior` (0.6) and
     `topDepartmentsForFacultyAggregate` (3) to that config file so those
     two numbers aren't hardcoded, per §12's "weighted-sum weights are
     configuration, not constants" rule), `recommendDepartments`
     (restricted to one faculty, §4.2 tier 2), and `rankFacultiesByFit`
     (mean of top-3 in-faculty department quiz scores + faculty-wide
     basic-science gateway signal + faculty-wide alumni stats, §4.2 tier 3,
     excludes the student's current faculty).
   - Seed data covers **one faculty** (`ENG`, matching the seeded ECE
     catalog) with 3 departments (`ECE`, `CSE`, `MCE`) using real gateway
     course codes from `seedCatalog.ts`, plus **one alternate faculty**
     (`BUS` / Business Informatics, matching §11 Example K) with 3
     synthetic sub-departments — enough for both tiers of §4.2's branch to
     have something real to recommend, not enough to be a general
     university catalog. Extend `DEPARTMENTS`/`FACULTIES`/
     `OTHER_FACULTY_DEPARTMENTS`/alumni maps as more programs are seeded.
   - **NOT yet done** (rest of item 2, see the reordered TODO list below):
     wiring this into `AdvisingCyclePorts` as an actual adapter
     (`recommendDepartments`/`simulateUnderDepartment`/
     `rankFacultiesByFit` in `advisingCycle.service.ts` still take
     hand-built fixtures in tests, not this module) — `simulateUnderDepartment`
     specifically needs to re-run §3.4's projection *as if* the student
     were in the candidate department, which needs the candidate-pool +
     packPlan pipeline parameterized by an alternate course pool, not just
     the fit engine above. That composition doesn't exist yet.

## ✅ SESSION 4 NOTE — READ FIRST (demo server + frontend + in-memory data layer)

The user asked to actually **see** a frontend and backend running together,
with real data being saved/modified/queried — not just green test output.
Session 4 built exactly that, as a clearly-scoped **demo layer**, separate
from (and not a substitute for) the real Prisma/Postgres + full-route work
still described under item 4/5 below.

**What was added:**

- `src/db/memory/inMemoryDb.ts` — an in-memory "database" (module-level
  `Map`, not Prisma) seeded with 3 real demo students (Ahmed/Sara/Karim,
  matching §11 Examples A/H/C respectively) with real transcripts and CGPA
  snapshots. Exposes read functions (`listStudents`, `getStudent`,
  `getTranscript` — applies §2.2's replacement rule at read time,
  `getCurrentCgpa`, `getEligibleCourses` — a deliberately simplified
  stand-in for the real §1.2/§5 eligibility engine that still doesn't exist
  as its own module) and write functions (`recordEnrollment` — appends a
  new attempt, never destructively rewrites history, then returns the
  recomputed CGPA; `setQuizAnswers`; `updateStudentStatus`). Also exports
  `__resetForTests()` for test isolation (this module is a singleton, so
  writes persist across the process the same way a real connection pool
  would — tests need an explicit reset, not module-reload isolation).
- `src/modules/advising/repositoryBackedPorts.ts` — a REAL
  `AdvisingCyclePorts` implementation (`buildRepositoryBackedPorts()`)
  wired to the in-memory store + the actual §3.1/§3.3 pure functions
  (`expectedPct`, `cohortProjectedPct`, `studentTrendPct`,
  `chainUnlockValue`) + the §6 fit engine — this is the adapter
  `advisingCycle.service.ts`'s header comment says the repository layer
  should eventually provide. Two things in it are flagged as
  intentionally approximate, not spec-complete:
  - `scoreEligibleCourse` falls back to a neutral cohort-mean/pass-rate
    since no `CourseOffering` history is seeded anywhere yet (the table
    exists in `schema.prisma`, nothing populates it in this demo).
  - `simulateUnderDepartment` uses a fit-score-based heuristic rather than
    actually re-running the full §3.1–§3.4 pipeline under an alternate
    course pool (see item 1 below, still the real task).
- `src/server.ts` — a small Express server exposing `GET /api/students`,
  `GET /api/students/:id` (transcript + snapshots + quiz answers),
  `GET /api/students/:id/eligible-courses`, `POST /api/students/:id/enroll`
  (the write/modify endpoint — records a grade, recomputes CGPA, returns
  both), `POST /api/students/:id/quiz`, and `POST /api/students/:id/advise`
  (runs the REAL `runAdvisingCycle` against real in-memory data). This is
  **not** the full §9.2 route list (no auth, no dismissal-lockout 403s, no
  transfer execution) — see item 5 below, still the real task.
- `public/index.html` — a single-file vanilla HTML/CSS/JS frontend (no
  build step, no framework) served statically by the same Express server.
  Lists students in a sidebar with live CGPA/probation-counter badges,
  shows a selected student's transcript, lets you add/modify a grade
  (writes through to the store and refreshes the CGPA live), and has a
  "Run Advising Cycle" button that calls the real orchestrator and renders
  its actual output (action tag, explain string, the full plan table with
  mandatory retakes flagged). This is a deliberately lightweight stand-in
  for the real React app scaffolded in `packages/web` (still just a
  `RetakeGateStep.tsx` stub, per item 7 below) — it exists to make the
  system demoable over HTTP today, not to replace the real frontend work.
- **A real bug was found and fixed this session**: `packages/shared/src/
  grading/urScale.ts`'s `gradeFromPct`/`passMark` used a bare `require('./
  engScale')` call inside an otherwise-ESM-import file. This happened to
  work under `tsx` (which compiles to CommonJS per `tsconfig.json`'s
  `module: "commonjs"`) but broke the instant a test actually exercised
  that code path under Vitest's Vite/ESM transform — which nothing had,
  until `inMemoryDb.test.ts` (below) called `gradeFromPct` for the first
  time. Fixed to a normal top-of-file `import { ENG_SCALE, ENG_PASS_MARK }
  from './engScale'`. This confirms the "Cannot find name 'require'"
  symptom flagged (differently) in session 2's network-outage note was a
  real, reproducible issue, not just a missing-`@types/node` artifact —
  worth remembering if it resurfaces elsewhere.
- **New tests**, all passing: `test/unit/db/inMemoryDb.test.ts` (13 tests
  — covers exactly what was asked for: seeding, reading, the replacement
  rule at read time, writing/modifying a grade without destroying history,
  CGPA recomputation on write, eligibility-list changes after a retake
  passes, and error handling for bad writes).
- Suite is now **77/77 passing** (13 test files), typecheck clean.

**How to actually run and see this yourself:**
```bash
cd academic-advisor
npm install --workspaces
cd packages/api
npx vitest run                # 77/77
npx tsx src/server.ts         # starts the demo server on :3001
# then open http://localhost:3001 in a browser
```
With the server running, `curl http://localhost:3001/api/students`,
`curl -X POST http://localhost:3001/api/students/sara-1/advise`, and
`curl -X POST http://localhost:3001/api/students/karim-1/enroll -H "Content-Type: application/json" -d '{"courseCode":"PHY121","pct":78,"semesterOrdinal":3}'`
all work against real (if in-memory) data — this was verified in-session,
not just written and assumed to work.

**Explicitly NOT done by this demo layer** (don't mistake it for items
3–7 below being finished): no Postgres, no Prisma migrations run, no
auth/lockout, no transfer execution, no real `packages/web` React screens.
It's a parallel, honest demo surface — the TODO list below is unchanged
in substance, just renumbered where session 4 touched something.

## ✅ SESSION 5 NOTE — READ FIRST (AMENDMENT 1: warning-ladder-driven transfer tiers)

Direct product-owner instruction, implemented and validated this session:

> "for the 1st and 2nd warning: normal recommendation, but if the student
> stayed like that into the 3rd warning: internal transfer recommendation,
> then the 4th: faculty transfer recommendation."

This ties `RECOMMEND_INTERNAL_TRANSFER`/`RECOMMEND_FACULTY_TRANSFER`
directly to `ProbationCounterState.count` (the same "N/6 warnings" counter
§4.1/§4.4 already track), for any student currently on the warning ladder
(count >= 1). **Full design rationale, precedence table, and exactly what
this supersedes in the original §12 checklist are documented in
`advisingCycle.service.ts`'s file header under "AMENDMENT 1"** — read that
before touching this logic again.

**The short version:**
- `warningCount === 0` (never had a low-CGPA semester, e.g. §11 Example H's
  Sara whose CGPA never drops below 2.00) → falls back to the ORIGINAL
  trend-based §4.2 tiering, completely unchanged. This is why all 77
  pre-existing tests (including `decideAdvisingAction.test.ts`'s Examples
  A/H/I/J/L) still pass without modification — `warningCount` defaults to
  `0` when omitted, so every old call site is implicitly asking for the
  old behavior.
- `warningCount` 1 or 2 → `SHOW_PLAN`, explain
  `probation_warning_1_or_2_normal_recommendation`, regardless of trend.
- `warningCount === 3` → `RECOMMEND_INTERNAL_TRANSFER` (or straight to
  `RECOMMEND_FACULTY_TRANSFER` if the §4.2.1 anti-loop guard already fired
  once for this student — the guard still applies under the new rule).
- `warningCount` 4 or 5 → `RECOMMEND_FACULTY_TRANSFER`.
- `warningCount >= 6` → out of scope for this function; dismissal already
  fired in `onSemesterClose` (§4.1) before advising would run again.

**What changed, concretely:**
- `AdvisingCyclePorts` gained one new method: `getProbationCounter(studentId)`.
- `decideAdvisingAction` gained an optional `warningCount` param (default
  `0`) and a new precedence block ahead of the original tier-1/2/3 logic.
- `runAdvisingCycle` now fetches the counter unconditionally (cheap — one
  row) and can only take the tier-1 trend-only short-circuit when
  `warningCount === 0`; for `warningCount` 1–2 it takes a new,
  cheaper short-circuit (skips the fit-engine ports, since those tiers
  never need them); for `warningCount` 3+ it always fetches dept/faculty
  fit, same as the original tier-2/3 path did.
- `repositoryBackedPorts.ts` wired the new port to the in-memory store's
  existing `probationCounter` field (no store schema change needed — it
  was already there).
- **New test file** `test/unit/advising/warningLadder.test.ts` (9 tests,
  all passing): every rung (1, 2, 3, 3-with-guard-already-fired,
  3-with-no-internal-candidate, 4, 5) plus two tests proving
  `warningCount = 0` (or omitted) still reproduces the exact original
  trend-based explain strings, not the new ladder ones.
- **New demo students** in `inMemoryDb.ts`, one per rung, so the rule can
  be validated live, not just in unit tests: Omar (1/6), Mona (2/6),
  Youssef (3/6, quiz-and-transcript-shaped like Sara so he has a real
  best-fit CSE department to be recommended into), Laila (4/6). Their
  `probationCounter.count` is seeded directly rather than derived from a
  multi-semester history, since that history isn't modeled in this demo
  store — flagged in the seed data's own comment.
- Full suite: **86/86 passing** (13 files), typecheck clean.
- **This was validated live, not just unit-tested**: started the server,
  called `POST /api/students/{id}/advise` for all four new students, and
  confirmed the HTTP response matched exactly:
  - Omar (1/6) → `SHOW_PLAN` / `probation_warning_1_or_2_normal_recommendation`
  - Mona (2/6) → `SHOW_PLAN` / `probation_warning_1_or_2_normal_recommendation`
  - Youssef (3/6) → `RECOMMEND_INTERNAL_TRANSFER` → suggested department `CSE`
  - Laila (4/6) → `RECOMMEND_FACULTY_TRANSFER` → suggested faculty `Faculty of Business Informatics`
- The demo frontend (`public/index.html`) now shows "Warning X/6" per
  student in the sidebar (with a "transfer tier" badge once count >= 3)
  and a one-line explanation of the ladder rule on the student detail page.

**One thing flagged, not silently resolved — worth a second look from a
human product owner:** this amendment makes count >= 1 the ONLY driver of
transfer tier, which supersedes the §12 checklist's original claim that
"a probation student is not blocked from also seeing a department-fit
suggestion" as an *independent* system from the counter. Under the old
design, a count=1 student with a genuinely flat trend WOULD have gotten an
internal-transfer suggestion (tier 2 of the original logic) even at
warning 1. Under this amendment, that same student now gets `SHOW_PLAN`
instead, because the ladder rule takes precedence. That's exactly what was
asked for ("1st and 2nd warning: normal recommendation" reads as
unconditional), but it's a real behavior change for that specific case,
not just an additive one — noted here in case it's not what was intended
for warning-1/2 students whose trend is severely declining.

## ⚠️ SESSION 2 NOTE

This session had **no network access in the sandbox** (`npm install` failed
with `403 Forbidden` on every package, including ones session 1 already
listed in `package.json`). That means:
- `npm install --workspaces` and `npx vitest run` could **not** be run this
  session — the 32/32 passing-tests claim below is carried over from
  session 1 and was **not re-verified** this session.
- New code was instead typechecked by hand: I symlinked
  `packages/api/node_modules/@advisor/shared → packages/shared` and ran the
  bundled global `tsc` (`typescript@6.0.3`, not the repo's pinned `^5.5.0` —
  close enough for a syntax/type sanity pass, not a substitute for the real
  `tsc -p tsconfig.json`) directly against the new file plus every module it
  imports. **Zero type errors** in any new code; the only error surfaced was
  a pre-existing, unrelated `Cannot find name 'require'` in
  `packages/shared/src/grading/urScale.ts` caused by `@types/node` not being
  installed (not a real bug, just this session's lack of `node_modules`).
- **The new `decideAdvisingAction` test file has never actually been run.**
  It's been hand-traced against `isImprovingCase`'s logic line-by-line (see
  the git-blame-able comments if you want to re-derive it yourself), and I'm
  confident in it, but "confident from tracing" is not the same bar as
  "green in CI." **Run it first, before writing any new code.**

**First thing to do next session:** confirm you have network, then
```bash
cd academic-advisor && npm install --workspaces
cd packages/api && npx vitest run    # expect 6 files/32 tests from session 1
                                      # PLUS the new decideAdvisingAction.test.ts
                                      # (7 more tests) = should be 39 total, all passing
npx tsc --noEmit -p tsconfig.json    # expect clean
```
If `decideAdvisingAction.test.ts` does NOT pass cleanly, treat that as the
top-priority bug — it means my hand-trace was wrong somewhere.

## What's done and VERIFIED (tests pass, typecheck clean) — as of session 7

`npm install --workspaces`, `npx vitest run` (packages/api) → **128/128
tests passing across 22 files**, `npx tsc --noEmit` clean in both
`packages/api` and `packages/web`, `npx vite build` (packages/web) clean,
every route (§9.2 and §15.5) smoke-tested live with `curl`, and the full
frontend — advisor AND student portal — driven in a real headless-Chromium
session with zero console errors, including a captured PDF download (see
the session-7 note above for the exact path exercised).

The table below is corrected in place rather than left stale — rows session
7 added are marked; everything else is unchanged from prior sessions'
verification.

| Spec section | File(s) | Status |
|---|---|---|
| §15.2 best-case grade projection | `packages/api/src/modules/prediction/{bestCaseProjection,whatIfProjection}.ts` | ✅ **new session 7** — done + tested (4 + 2 tests) |
| §15.3 course proposal / dual-approval workflow | `packages/api/src/modules/proposals/proposal.service.ts` | ✅ **new session 7** — pure state machine, done + tested (8 tests) |
| §15.3 in-memory wiring + routes | `packages/api/src/db/memory/inMemoryDb.ts`, `src/server.ts` | ✅ **new session 7** — 7 new routes, all curl-verified |
| §15.1 student portal (5 screens) | `packages/web/src/portal/*.tsx` | ✅ **new session 7** — driven live, zero console errors |
| §15.3 advisor proposal review screen | `packages/web/src/pages/Proposals/ProposalReview.tsx` | ✅ **new session 7** |
| §15.4 advisor PDF report | `packages/web/src/lib/pdfReport.ts` + `AdvisorConsole.tsx` | ✅ **new session 7** — real download captured via Playwright |
| §1 domain types | `packages/shared/src/types/*.ts` | ✅ done |
| §2.1 grading scales | `packages/shared/src/grading/{engScale,urScale}.ts` | ✅ done |
| §2.2 CGPA (replacement rule, base-snapshot aware) | `packages/api/src/modules/grading/cgpa.ts` | ✅ done + tested (8 tests, incl. §7.2.3 anchoring) — **session 3** |
| §2.3 levels, §2.4 three-tier credit cap | `packages/api/src/modules/grading/level.ts` | ✅ done + tested (13 tests) |
| §3.1(a) cohort trend regression | `packages/api/src/modules/prediction/cohortTrend.ts` | ✅ done, no dedicated test — **TODO** |
| §3.1(b) student ability regression | `packages/api/src/modules/prediction/studentTrend.ts` | ✅ done, no dedicated test — **TODO** |
| §3.1(c) expectedPct weighted blend | `packages/api/src/modules/prediction/expectedPct.ts` | ✅ done, no dedicated test — **TODO** |
| §3.2 candidate scoring (all 4 modes) | `packages/api/src/modules/prediction/candidateScore.ts` | ✅ done, no dedicated test — **TODO** (exercised indirectly by planPacker tests, but no direct per-mode test yet) |
| §3.2/§5.2 knapsack + mandatory-F reservation | `packages/api/src/modules/prediction/planPacker.ts` | ✅ done + tested (6 tests, incl. **Example M** overflow) — **session 3** |
| §3.3 multi-level chain unlock value | `packages/api/src/modules/prediction/chainUnlockValue.ts` | ✅ done, no dedicated test — **TODO** |
| §3.4 CGPA trend projection | `packages/api/src/modules/prediction/cgpaTrendProjection.ts` | ✅ done + tested (4 tests, incl. Example L) |
| §3.1/§3.4 OLS core | `packages/api/src/modules/prediction/linearRegression.ts` | ✅ done + tested (4 tests) |
| §4.1 probation counter incr/reset/dismiss | `packages/api/src/modules/probation/probationCounter.service.ts` | ✅ done + tested (6 tests, Examples D/E/F, mid-window recovery table matches exactly) |
| §4.2 orchestrator (full async) | `packages/api/src/modules/advising/advisingCycle.service.ts` | ✅ done + tested (7 branch-decision tests + 2 full-orchestrator tests) — **session 3 confirmed** |
| §4.5 first-semester unarmed rule + half-load | `packages/api/src/modules/probation/firstSemesterRule.service.ts` | ✅ done + tested (3 + 2 tests, Example G) |
| §4.1/§12 dismissal + lockout guard | `packages/api/src/modules/probation/dismissal.service.ts` | ✅ done, no dedicated test — **TODO, trivial, do it first** |
| §5 retake gate pool-splitting | `packages/api/src/modules/retakeGate/retakePreference.service.ts` | ✅ done, no dedicated test — **TODO** (exercised indirectly by orchestrator tests) |
| §6 fit engine (quiz+grades+alumni weighted sum) | `packages/api/src/modules/fitEngine/deptFitEngine.ts` | ✅ done + tested (9 tests), **wired into `AdvisingCyclePorts`** since session 4's `repositoryBackedPorts.ts` |
| §6/§4.2 `simulateUnderDepartment` (real math, not a heuristic) | `packages/api/src/modules/fitEngine/simulateUnderDepartment.ts` | ✅ **new session 6** — re-runs real `computeCGPA` + `ols`, done + tested (3 tests); still approximates the candidate-pool step (no per-department catalog seeded beyond ECE) — flagged in the file |
| §7.1 internal transfer | `packages/api/src/modules/transfer/internalTransfer.service.ts` | ✅ **new session 6** — done + tested (4 tests), wired into `inMemoryDb.ts`/`server.ts` |
| §7.2.1/§7.2.2 Transfer Semester builder + equivalency map | `packages/api/src/modules/transfer/{transferSemester.builder,courseEquivalency}.ts` + `db/seed/seedEquivalency.ts` | ✅ **new session 6** — done + tested (4 tests) |
| §7.2.3 external transfer | `packages/api/src/modules/transfer/externalTransfer.service.ts` | ✅ **new session 6** — done + tested (5 tests + a live curl execution against `hassan-1`) |
| §4.1/§4.5 probation history / audit log | `packages/api/src/modules/probation/probationHistory.ts` | ✅ **new session 6** — replays real snapshots through the real state machine, done + tested (3 tests); every seeded demo student's counter is now derived this way, not hand-set |
| §9.3 Prisma schema | `packages/api/src/db/prisma/schema.prisma` | ✅ written, **still NOT migrated** — no `DATABASE_URL` configured (user explicitly chose to stay in-memory for session 6) |
| §14 phase 1 catalog seed | `packages/api/src/db/seed/seedCatalog.ts` | ✅ done — real 82-course ECE catalog, type-checks clean against the shared `Course` type. Elective pools ported too. |
| §12 tunable prediction weights | `packages/api/src/config/predictionWeights.json` | ✅ done, every formula in `prediction/*`/`fitEngine/*` reads from this file; **session 6** added a role-gated `PUT /admin/prediction-weights` that hot-patches it at runtime and persists to disk |
| §9.2 full route list | `packages/api/src/server.ts` | ✅ **rewritten session 6** — every route in spec §9.2 the in-memory store can serve, plus `blockIfDismissed` (§12) on every advise/transfer/enroll route. Two documented deviations: auth is a single `x-role` header, and `POST /semesters/:id/close` is exposed per-student (`POST /students/:id/semesters/close`) since Semesters aren't globally addressable in this store. |
| §10 full screen list | `packages/web/src/pages/**` | ✅ **built session 6** — all 8 screens (was: one unwired stub). See the session-6 note above for exactly what was driven live in a browser. |
| Demo data layer (NOT §9.3 Prisma) | `packages/api/src/db/memory/inMemoryDb.ts` | ✅ seeded (12 personas, up from 3+4), read+write+transfer+probation-history tested (13+9 tests) |
| Demo API server (NOT full §9.2's auth/DB) | `packages/api/src/server.ts` + `repositoryBackedPorts.ts` | ✅ manually verified end-to-end with curl, every route |
| `packages/api/public/index.html` (vanilla-JS demo page) | — | Superseded by the real React app as of session 6; left in place, still works, no longer the primary frontend |

### §4.2 orchestrator — what was built this session

`advisingCycle.service.ts` now exists and wires: retake gate (§5, via
`buildCandidatePool`) → scored candidate pool (via an injected port, see
below) → `packPlan` (§3.2/§5.2) → `projectCGPATrend`/`isImprovingCase`
(§3.4) → the three-way branch (§4.2, with the §4.2.1 anti-loop guard).
Two functions are exported:

- **`decideAdvisingAction(params)`** — the branch decision ONLY, as a pure
  function (no ports, no async). This is the piece worth trusting most,
  because it's the piece that's actually unit-tested (see below) and the
  easiest to verify by re-reading.
- **`runAdvisingCycle(student, ports)`** — the full async orchestration.
  Composes the pipeline and calls `decideAdvisingAction` at the end. Skips
  the (relatively expensive) fit-engine port calls entirely when tier 1
  (`SHOW_PLAN`) already applies — small optimization, not spec-mandated but
  harmless and matches the pseudocode's short-circuiting `if improving:
  return`.

**Important design choice — read before touching this file:** two pieces of
§4.2's pseudocode need real data this repo doesn't have modeled as pure
functions yet (course-offering stats + a student's comparable transcript
history → `expectedPct`/`chainUnlockValue` per course; and the §6 quiz/
gateway/alumni fit engine, which doesn't exist as code at all — see item 2
below). Rather than block the orchestrator on those, I injected them as an
`AdvisingCyclePorts` interface (7 methods: `getRetakeGateAnswer`,
`getEligibleCourses`, `scoreEligibleCourse`, `isPostLowFirstSemester`,
`projectPlanCGPA`, `getCgpaSnapshots`, `recommendDepartments`,
`simulateUnderDepartment`, `rankFacultiesByFit`,
`alreadyTransferredInternallyOnce` — 10, actually, count them in the file).
**This is a deliberate hexagonal seam, not a cop-out** — it means the branch
logic is typed, testable, and spec-faithful *today*, and when the
repository layer (item 5 below) and fit engine (item 2 below) are built,
you write ONE adapter object implementing `AdvisingCyclePorts` against real
Prisma queries — nothing in `advisingCycle.service.ts` itself should need
to change. **Do not "simplify" this by inlining DB calls directly into
`runAdvisingCycle`** — that was considered and rejected because it would
make this file untestable without a live Postgres instance, which is
exactly the trap that would have made this session's work impossible to
verify (see the network-access note at the top of this file).

**Also flagged, not fixed:** the shared `Student` type
(`packages/shared/src/types/student.ts`) has no `cgpa` field — only
`cumulativeEarnedCredits`/`level`. Every signature in `advisingCycle.service.ts`
therefore takes `Student & { cgpa: number }` (aliased as `StudentWithCgpa`)
rather than silently widening the shared type from inside this module. Next
session should probably just add `cgpa: number` to `Student` directly once
the repository layer exists and it's clear whether it should be stored or
always-computed — flagging the decision rather than making it unilaterally.

**Test coverage added (session 2):** `test/unit/advising/decideAdvisingAction.test.ts`,
7 cases covering spec Examples A, H, I (plus a variant), J, L, and one extra
case pinning down that tier 2 requires the *simulated* trend slope > -0.01,
not just a higher projected CGPA. **Session 3 confirmed this passes exactly
as hand-traced** and added `runAdvisingCycle.test.ts` (2 more tests) for the
async wrapper itself — see the session-3 note at the top of this file.

**Bottom line:** the two hardest, highest-risk pieces of business logic per
the spec's own roadmap (§14 phase 4: the probation/dismissal state machine,
and §14 phase 2: the prediction math core) were implemented and passing
against the spec's own worked examples in session 1 (§11 D, E, F, G, L).
This session added the orchestrator (§4.2) that wires those pieces together
end-to-end, with its branch-decision logic covered by new (unrun) tests.
Everything else (HTTP routes, DB wiring, React screens, the fit engine) is
comparatively mechanical once this core is trustworthy — that reasoning
still holds.

## What's NOT done yet — pick up here, in this order

1. **Real Postgres/Prisma wiring.** `schema.prisma` is written and has been
   since session 1, but nothing has ever run `prisma migrate dev` against a
   real database — every session so far (including 6, by explicit user
   choice) has run on the in-memory store (`db/memory/inMemoryDb.ts`). Set
   `DATABASE_URL` in `.env` (copy `.env.example`), migrate, then build the
   `*.repository.ts` layer (spec §9.1 — none exist yet) so the pure
   functions already built can be called with real persisted data instead
   of the in-memory Map. This is the single biggest remaining structural
   gap — everything else in this list is smaller.
2. **Real auth.** The admin route (`PUT /admin/prediction-weights`) checks
   a single `x-role` header — there's no login flow, no JWT, no session
   behind it. Spec §9 names four roles (`student`, `advisor`, `registrar`,
   `admin`); only the registrar/admin distinction on that one route is
   enforced today.
3. **`PlanningRun` audit persistence** (spec §9.3's table exists in
   `schema.prisma`, nothing writes to it). The Advisor Console screen
   explicitly flags this as not-yet-implemented rather than faking it —
   see `packages/web/src/pages/AdvisorConsole/AdvisorConsole.tsx`.
4. Remaining un-tested ✅ modules (lower priority — simpler, lower-risk):
   - `expectedPct.ts`, `cohortTrend.ts`, `studentTrend.ts` (§3.1) — no
     dedicated tests yet (exercised indirectly via `repositoryBackedPorts.ts`
     and the advising-cycle tests).
   - `candidateScore.ts` (§3.2) — exercised indirectly by `planPacker.test.ts`,
     no direct per-mode unit test yet.
5. **`simulateUnderDepartment`'s remaining approximation** (see its own
   header comment and the table above): once per-department course catalogs
   beyond ECE are seeded, replace the "hypothetical bundle at the gateway
   average" signal with a real `buildCandidatePool → packPlan → expectedPct`
   chain against that catalog. The function signature and its trend/CGPA
   math don't need to change — only what feeds `assumedNextSemesterPoints`.
6. **Screenshot/visual regression harness.** Session 6 verified the frontend
   live with a one-off Playwright script (not committed — see the session-6
   note). Worth turning into a real `packages/web/e2e/*.spec.ts` suite if
   the frontend keeps growing, so visual verification doesn't depend on
   re-deriving the same script each session.

## Things the next session should NOT re-litigate

- The mid-window probation counter reset logic (§4.4) is correct and tested
  exactly against the spec's own table in Example E — do not "simplify" it
  to a rolling window; it is a reset-on-recovery counter, not a sliding
  window, and the test enforces that distinction explicitly.
- The Level-1 first-semester unarmed rule (§4.5) intentionally does NOT
  increment the counter even on a very low GPA — this is correct per spec,
  confirmed by two dedicated tests.
- `chainUnlockValue` is deliberately memoized and takes only the static
  catalog graph as input (no student-specific data) — keep it that way
  (§12 edge case, §13 test item 12) when you eventually wire it to a real
  catalog-version cache.
- The documented judgment call in spec §7.2.3 (Transfer Semester treated
  with the same "unarmed" logic as a first semester) is implemented as
  `onTransferSemesterClose` — an explicit alias of `onFirstSemesterClose` in
  `firstSemesterRule.service.ts`. If the registrar/product owner decides
  this should be stricter, that's the one function to change.
- The `AdvisingCyclePorts` seam in `advisingCycle.service.ts` (session 2) is
  intentional, not a placeholder to "clean up" by inlining DB calls — see
  the design-choice writeup above under §4.2. Keep the branch decision
  (`decideAdvisingAction`) pure and synchronous. Session 3 confirms this
  seam is exactly what made `runAdvisingCycle.test.ts` possible to write
  without a database — do not collapse it while wiring in item 1 above.
- `deptFitEngine.ts`'s seed data (session 3) is a reconstruction, not a
  verified port of the original prototype — see the provenance note under
  item 1 above and the file's own header comment. Don't treat the specific
  quiz questions/trait tags/alumni numbers as spec-mandated; the *formula*
  and *function signatures* are what matter and are spec-faithful.
- **(Session 6)** `replayProbationHistory`'s "only the earliest snapshot at
  ordinal 1 is a genuine unarmed first semester" rule
  (`probationHistory.ts`) is load-bearing, not incidental — without it,
  demo students whose modeled history starts mid-career (e.g. `mona-2`
  starting at ordinal 4) would incorrectly get one free unarmed low
  semester they were never entitled to. Confirmed by
  `test/unit/db/transferWiring.test.ts`'s exact-rung assertions.
- **(Session 6)** The §7 transfer module's "passed courses" filter
  (`r.letter !== 'F'`) is deliberately different from `getEligibleCourses`'
  stricter "counts toward prereq unlock" filter (`!['D','D+','F'].includes`)
  a few lines away in the same file (`inMemoryDb.ts`). These are two
  different institutional concepts (passed-and-transferable vs.
  passed-well-enough-to-unlock-the-next-course) — don't "simplify" them to
  the same filter; a real bug from doing exactly that (D+ courses wrongly
  excluded from transfer) was found and fixed this session.

## How to verify this session's work yourself

```bash
cd academic-advisor
npm install --workspaces

cd packages/api
npx vitest run                      # expect: 22 test files, 128 tests, all passing
npx tsc --noEmit -p tsconfig.json   # expect: no output, exit 0
npx tsx src/server.ts               # starts the API on :3001

# in a second terminal
cd packages/web
npx tsc --noEmit -p tsconfig.json   # expect: no output, exit 0
npx vite build                      # expect: clean production build
npx vite                            # starts the real React app on :5173, proxies /api to :3001
```

Open `http://localhost:5173` (advisor view) — pick any student in the
sidebar, try "Advise Me" (Youssef/warning-3 → internal transfer
recommendation; Laila/warning-4 → faculty transfer recommendation → "Start
transfer review" → a real Transfer Semester preview), "Target CGPA",
"Best-Fit Quiz", "Probation History", and the new **"Proposals"** tab
(§15.3 — click "Generate proposals from plan", then approve one or propose
an alternate). `nourhan-1` is the dismissed persona — her `/advise` call
should 403. **Advisor Console**'s "Generate Report (PDF)" button (§15.4)
downloads a real PDF.

Then open `http://localhost:5173/portal/sara-1` (student portal, §15.1) —
confirm no percentage ever appears, only letters. Approve something as the
advisor for Sara first (Proposals tab), then in the portal's "My
Recommendations" tab: choosing the advisor-approved option should register
immediately; choosing the other option should pop up "contact your
advisor."

Session 7 confirmed all of the above — tests, typecheck, build, and a
scripted headless-Chromium walkthrough of the exact advisor + portal path
above, including a captured PDF download — before handing off. Session 6
confirmed the §7-and-earlier work the same way; see both notes at the top
of this file.
