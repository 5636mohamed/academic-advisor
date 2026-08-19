# AI Features Blueprint — Project Collider & Cognitive Load Heatmap

**Status:** architecture blueprint only — nothing in this document is implemented yet. No code changes accompany this file; it exists so the plan can be reviewed before any of it is built.

**Target version:** proposed as **v1.1.0**, a superset of v1.0.0 — every existing route, table, and component stays exactly as it is today. Nothing here replaces the fastest-graduation planner, the retake-gate engine, the transfer chain, or the existing Venture Board; it's two new modules bolted onto the same three-portal architecture, reusing the same primitives (`ols`/`recencyWeights` in `linearRegression.ts`, the `--su-*` design tokens, the advisor/VP scoping model) wherever they already do the right thing.

**Repo boundary:** this blueprint targets the public `academic-advisor` repo. If it gets built and the `ejust-academic-advisor` private fork wants it too, that's a second, separate porting pass afterward (mirroring how the PDF/grade-table/regression fixes were each ported once proven in the public repo first) — not in scope here.

---

## 0. Feature comparison — v1.0.0 vs. proposed v1.1.0

| Area | v1.0.0 (today) | v1.1.0 (proposed) |
|---|---|---|
| Student discovery | Manually browse the Venture Board's existing project postings | Describe an idea in free text → get a ranked "Collider Team" of cross-faculty peers automatically |
| Advisor oversight | Approve/propose courses, view roster, view Venture Board postings | + a live dashboard of *organic* (student-initiated) project groups, matched against external internships/grants/fairs |
| VP oversight | Advisor roster summaries, transfer sign-off, flat pending-approvals queue | + an "Innovation Topography" heatmap/bubble chart of cross-faculty keyword clusters, + agile micro-funding allocation |
| Workload visibility | CGPA trend chart, grade history table | + a per-week "Friction Score" timeline per student, with a burnout-risk alert |
| Institutional analytics | Per-advisor roster averages | + a macro friction-aggregation dashboard surfacing which department/week combinations chronically overload students |
| Prediction engine | `ols`/`recencyWeights` used for grade/CGPA trend only | Same primitive reused for skill-vector similarity ranking (Collider) and reused verbatim for friction-trend smoothing (Heatmap) — no second regression implementation |
| New DB surface | — | 5 new collections/tables (`projects`, `project_skills`, `student_skills`, `syllabus_milestones`, `friction_logs`) — see §1 |
| New routes | — | ~14 new endpoints under `/api/collider/*` and `/api/friction/*` — see §2 |
| New top-level nav items | — | Student: "Collider" tab. Advisor: "Collider Board" tab. VP: "Innovation Topography" + "Cognitive Load" tabs |
| Runtime dependencies | None beyond what's already in `package.json` | None required for a first cut (see §1's NLP note) — an optional real embedding model is called out as a v1.2 upgrade path, not a v1.1 requirement |

---

## 1. Database Schema & AI Logic

### 1.1 Where this lives

New shared types go in `packages/shared/src/types/`, following the existing one-file-per-domain convention (`venture.ts`, `transfer.ts`, etc.):

- `packages/shared/src/types/collider.ts` — `SkillVector`, `Project`, `ColliderTeamSuggestion`, `ExternalOpportunity`
- `packages/shared/src/types/friction.ts` — `SyllabusMilestone`, `FrictionLog`, `FrictionReading`

Both re-exported from `packages/shared/src/index.ts`'s existing barrel, exactly like the 9 files already exported there.

Since this app's persistence layer is the in-memory store (`packages/api/src/db/memory/inMemoryDb.ts` — Prisma is scaffolded but genuinely unused today, see `packages/api/src/db/prisma/schema.prisma`'s own "TODO: still pending" header), "table" below means an in-memory `Map`/array with the same shape a real relational table would have, so the eventual Prisma migration (if it ever happens) is a mechanical port, not a redesign.

### 1.2 Schema

```ts
// packages/shared/src/types/collider.ts

/** A skill/technology tag, normalized to a canonical id so "ML" and
 *  "Machine Learning" collide to the same vector dimension. Canonicalization
 *  table lives in seedSkillTaxonomy.ts (§1.3) — NOT user-editable free text,
 *  so the vector space stays finite and comparable. */
export type SkillTag = string; // canonical id, e.g. 'machine-learning', 'iot', 'lora'

export interface StudentSkillProfile {
  studentId: string;
  /** Weighted skill vector — weight 0-1, derived from (a) courses passed
   *  whose catalog entry maps to that skill (seedCourseSkillMap.ts, a new
   *  small seed file analogous to seedCourseOfferings.ts) and (b) skills
   *  the student has explicitly tagged themselves via the NLP intake (1.4). */
  skills: Record<SkillTag, number>;
  updatedAt: string;
}

export type ProjectStage = 'idea' | 'forming_team' | 'active' | 'matched_externally' | 'archived';

export interface Project {
  id: string;
  title: string;
  /** The raw free-text idea description the student typed — kept verbatim
   *  so advisors/VP can read intent, not just extracted tags. */
  rawDescription: string;
  founderStudentId: string;
  memberStudentIds: string[]; // includes founder; capacity is soft (no hard cap in v1.1)
  extractedSkills: SkillTag[]; // output of the NLP intake, §1.4
  facultyIdsRepresented: string[]; // derived from memberStudentIds — drives §1.6's cross-faculty signal
  stage: ProjectStage;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSkillRequirement {
  projectId: string;
  skill: SkillTag;
  /** How central this skill is to the idea (1.0 = core, 0.3 = nice-to-have)
   *  — set from term frequency in the parsed description, see §1.4. */
  weight: number;
}

/** A row in the external-table an advisor's dashboard matches projects
 *  against — internships, grants, research fairs. Seeded/curated data in
 *  v1.1 (seedExternalOpportunities.ts, same pattern as seedVentureProjects.ts),
 *  not a live scraped feed — that's an explicit v1.2+ upgrade, not this cut. */
export interface ExternalOpportunity {
  id: string;
  title: string;
  kind: 'internship' | 'grant' | 'research_fair';
  requiredSkills: SkillTag[];
  organization: string;
  deadline: string | null;
  url: string | null;
}

export interface ColliderTeamSuggestion {
  projectId: string;
  suggestedStudentId: string;
  /** Cosine similarity between the project's skill-requirement vector and
   *  the candidate's skill vector — see §1.5 for the exact algorithm. */
  matchScore: number;
  /** Why this suggestion showed up cross-faculty at all — the one field
   *  that makes "organic interdisciplinary" a checkable claim rather than
   *  a marketing word. */
  candidateFacultyId: string;
  founderFacultyId: string;
}
```

```ts
// packages/shared/src/types/friction.ts

export type MilestoneType = 'assignment' | 'lab_report' | 'quiz' | 'midterm' | 'final' | 'project_deadline';

export interface SyllabusMilestone {
  id: string;
  courseCode: string;
  semesterOrdinal: number; // same ordinal system as EnrollmentRecord/CgpaSnapshot
  weekNumber: number; // 1-based, within that semester
  type: MilestoneType;
  /** Spec-analogous to predictionWeights.json's candidateScore weights —
   *  see §1.7 for where these live and how they're tuned. */
  title: string;
}

export interface FrictionLog {
  studentId: string;
  semesterOrdinal: number;
  weekNumber: number;
  /** Computed, not stored raw input — see §1.7's formula. Persisted so the
   *  VP macro-dashboard (§3.3) can aggregate historical weeks without
   *  recomputing every student's schedule on every request. */
  frictionScore: number;
  burnoutRisk: boolean; // frictionScore > weights.friction.burnoutThreshold
  computedAt: string;
}
```

### 1.3 Seed data

- `packages/api/src/db/seed/seedSkillTaxonomy.ts` — canonical `SkillTag` list + a synonym-normalization map (`{'ml': 'machine-learning', 'machine learning': 'machine-learning', ...}`), same shape as `seedCatalog.ts`'s course list: a flat, hand-authored, reviewable array — not a live taxonomy service.
- `packages/api/src/db/seed/seedCourseSkillMap.ts` — `Record<courseCode, SkillTag[]>`, e.g. `ECE327: ['embedded-systems', 'iot']`. This is the bridge that lets a student's *passed courses* contribute to their skill vector without them manually tagging anything.
- `packages/api/src/db/seed/seedExternalOpportunities.ts` — the internships/grants/fairs table, same pattern as `seedVentureProjects.ts`.
- `packages/api/src/db/seed/seedSyllabusMilestones.ts` — per-course, per-week milestone data for the existing ECE catalog (`seedCatalog.ts`). This is the single largest new seed file and the one most worth a domain-accurate pass (real syllabus deadline clustering, not evenly-spaced placeholders) since the Friction feature's entire credibility rests on it.

### 1.4 NLP intake (student idea → extracted skills)

**Framed honestly, not oversold:** "NLP" here is keyword/phrase extraction against the closed `SkillTag` taxonomy from §1.3, not a generative model call. This matches the rest of the system's philosophy — `expectedPct.ts`'s own header comment already calls out that its weights are "read from config so they can be retuned," i.e. everything in this app is a transparent, debuggable formula, not an opaque black box. A real LLM-based extractor is flagged as a deliberate v1.2 upgrade path (see §1.4's closing note), not silently implied here.

`packages/api/src/modules/collider/skillExtraction.service.ts`:

```ts
export function extractSkillsFromIdea(rawText: string, taxonomy: SkillSynonymMap): { skill: SkillTag; weight: number }[] {
  // 1. Lowercase + tokenize (simple whitespace/punctuation split — no
  //    external tokenizer dependency).
  // 2. Multi-word synonym matching first (longest-match-wins, so "machine
  //    learning" matches before a bare "learning" could false-positive),
  //    then single-word.
  // 3. weight = min(1.0, occurrences / totalTokens * scalingFactor) —
  //    term-frequency, not binary presence, so "an IoT project using IoT
  //    sensors for IoT data" weights 'iot' higher than a passing mention.
  // 4. Returns only taxonomy hits — free text outside the taxonomy is
  //    preserved in Project.rawDescription (§1.2) for a human to read, but
  //    never invented into a fake skill tag.
}
```

This is a pure function, unit-testable exactly like `expectedPct.ts` — feed it fixed strings, assert fixed skill/weight output. No network call, no async.

### 1.5 Collider Team matching algorithm

`packages/api/src/modules/collider/colliderMatch.service.ts` — deliberately modeled on the existing `ventureFitScore.ts` (same shape of problem: score every candidate against a target, threshold, rank), not a new paradigm:

```ts
export function scoreCandidateForProject(
  project: Pick<Project, 'extractedSkills' | 'memberStudentIds' | 'facultyIdsRepresented'>,
  candidate: StudentSkillProfile,
  candidateFacultyId: string
): number {
  // Cosine similarity between the project's requirement vector (extractedSkills,
  // each implicitly weight 1.0 unless overridden by ProjectSkillRequirement)
  // and the candidate's skill vector. Standard dot-product-over-magnitudes —
  // no new math library needed, ~10 lines, same "dependency-free and pure"
  // philosophy linearRegression.ts documents about itself.
  //
  // A same-faculty candidate is NOT excluded (organic teams can and do form
  // within a faculty) but the query in §1.6 below explicitly diversifies the
  // top-N results across faculties rather than just taking the top-N by raw
  // score, which is what actually delivers "cross-faculty" rather than
  // hoping the raw ranking happens to produce it.
}
```

Query logic for `POST /api/collider/projects/:id/suggest-team` (§2):

1. Pull every `StudentSkillProfile` except current project members.
2. Score each via `scoreCandidateForProject`.
3. Filter to `matchScore >= weights.collider.matchThreshold` (new config key, `predictionWeights.json`, same pattern as `ventureFit.matchThreshold`).
4. **Faculty-diversify**: take the top-scoring candidate from each faculty NOT already represented in `facultyIdsRepresented` first, then fill remaining slots by raw score — this is the one deliberate piece of business logic beyond plain top-N, and it's what makes "Collider Team" mean something instead of just "top 5 similar students."
5. Cap at `weights.collider.maxSuggestions` (default 5).

### 1.6 Innovation Topography aggregation (VP level)

`packages/api/src/modules/collider/innovationTopography.service.ts` — pure aggregation, no new statistics beyond counting and grouping:

```ts
export interface TopographyCell {
  facultyId: string;
  skill: SkillTag;
  projectCount: number;
  /** Count of projects in this cell with >1 faculty represented — the
   *  actual "emerging cross-disciplinary cluster" signal the heatmap
   *  colors by, not just raw volume. */
  crossFacultyProjectCount: number;
}

export function buildTopography(projects: Project[]): TopographyCell[] {
  // group by (facultyId x skill) pair across all ACTIVE projects touching
  // that faculty (via facultyIdsRepresented) and that skill (via
  // extractedSkills) — a straightforward reduce, not a new algorithm.
}
```

### 1.7 Cognitive Load / Friction Score formula

`packages/api/src/modules/friction/frictionScore.service.ts`. This is the one genuinely new piece of applied math in this blueprint, so it's specified in full rather than hand-waved:

```
frictionScore(week) = Σ over milestones in that week of:
    baseWeight(type) × courseCreditHours × overlapPenalty

baseWeight: { quiz: 1, assignment: 2, lab_report: 3, midterm: 6, final: 10, project_deadline: 5 }
  — read from predictionWeights.json's new "friction.milestoneWeights" block,
  same retunable-without-redeploy pattern as every other weight in that file.

overlapPenalty = 1 + 0.15 × (milestonesInWeekAcrossAllCourses - 1)
  — deadline CLUSTERING is the actual burnout driver, not raw milestone
  count in isolation: two exams in two different weeks is fine; two exams
  in the SAME week is the problem. This penalty is why the formula isn't
  just "sum the weights" — it's why the score is asymmetric.
```

Then, matching the rest of this system's established pattern of smoothing a noisy signal with the recency-weighted regression already proven in `linearRegression.ts` (see the `academic-advisor` commit that empirically tuned `recencyWeights` for `studentTrend.ts`/`cohortTrend.ts`):

```ts
export function smoothedFrictionTrend(weeklyScores: FrictionLog[]): OlsResult {
  const x = weeklyScores.map(w => w.weekNumber);
  const y = weeklyScores.map(w => w.frictionScore);
  return ols(x, y, recencyWeights(x.length, weights.trend.recencyHalfLife)); // same halfLife=5, same reasoning
}
```

Reusing the exact same primitive (rather than inventing a second trend-smoothing method) both saves code and means "is this week's spike part of a rising trend or a one-off" reuses a mechanism that's already been empirically validated on this app's own data shape.

`burnoutRisk = frictionScore > weights.friction.burnoutThreshold` — a config-driven threshold (start at the 85th percentile of the seeded data's own score distribution, computed once and hardcoded as the initial value, then retunable), not an arbitrary round number.

### 1.8 Macro/institutional bottleneck detection (VP level)

`packages/api/src/modules/friction/institutionalBottleneck.service.ts` — group `FrictionLog` rows by `(departmentId, weekNumber)`, compute mean + the fraction exceeding `burnoutThreshold`. "Engineering Dept consistently overloads Week 8" becomes: `meanFrictionScore` for `(ECE, week=8)` sits in the top decile across all `(dept, week)` cells **and** that's true across ≥2 of the last 3 semesters (`semesterOrdinal` window) — the "consistently" qualifier is a real repeated-measures check, not a one-semester snapshot mistaken for a pattern.

---

## 2. Backend API Architecture

Following the existing `server.ts` convention exactly (flat Express routes, no router-per-module abstraction — that's a deliberate existing choice, not something this blueprint should deviate from) and the existing `?advisorId=`-style query-param scoping (client-checked + basic param-based backend filtering, same "not a session/token system" rigor level `.github/SECURITY.md` already discloses for the rest of the app):

### Collider

| Method & path | Purpose |
|---|---|
| `POST /api/collider/projects` | Student submits a new idea. Body: `{ founderStudentId, title, rawDescription }`. Runs `extractSkillsFromIdea` synchronously (it's a pure, fast function — no job queue needed), stores the `Project` + derived `ProjectSkillRequirement[]`. |
| `GET /api/collider/projects/:id` | Full project detail, including current members and their skill profiles. |
| `POST /api/collider/projects/:id/suggest-team` | Runs §1.5's matching, returns `ColliderTeamSuggestion[]`. Read-only — does not mutate `memberStudentIds`. |
| `POST /api/collider/projects/:id/invite` | Body: `{ studentId }`. Adds to `memberStudentIds` (an explicit accept step by the invited student, `POST /api/collider/projects/:id/accept`, mirrors the existing proposal `choose` pattern in `proposal.service.ts` rather than inventing a new accept/reject shape). |
| `GET /api/collider/students/:id/skill-profile` | A student's own derived `StudentSkillProfile` (for a "here's what we think you're good at" self-view). |
| `GET /api/advisors/:id/collider/projects` | Advisor-scoped: organic project groups where ≥1 member is on this advisor's 25-student roster — same `?advisorId=`-shaped scoping as `GET /api/students`. |
| `GET /api/collider/projects/:id/opportunity-matches` | Matches `extractedSkills` against `ExternalOpportunity.requiredSkills` (same cosine-similarity function as §1.5, reused, not reimplemented) — this is the advisor dashboard's internship/grant/fair matching. |
| `GET /api/vp/collider/topography` | §1.6's aggregation, VP-only route (`RequireVicePresident`-guarded on the frontend, matching existing convention). |
| `POST /api/vp/collider/projects/:id/fund` | Body: `{ amount, note }`. Micro-funding allocation — appends to a `fundingAllocations: {amount, note, allocatedAt}[]` array on the `Project` record (kept simple/append-only in v1.1, no separate ledger table — there's no real payment rail behind this, it's a recorded intent exactly like the rest of this demo's data). |

### Friction / Cognitive Load

| Method & path | Purpose |
|---|---|
| `GET /api/students/:id/friction-timeline?semesterOrdinal=` | Computes (or reads cached) `FrictionLog[]` for every course the student is registered in that semester, calling §1.7's formula against `seedSyllabusMilestones.ts`. |
| `GET /api/students/:id/friction-timeline/trend` | §1.7's `smoothedFrictionTrend` over the student's logged weeks — powers the "is this getting worse" read, same shape as `GET /api/students/:id/cgpa-trend` already does for CGPA. |
| `GET /api/advisors/:id/friction-overview` | Per-student current-week friction score across the advisor's roster, sorted worst-first — the advisor-level "who needs a check-in this week" view. |
| `GET /api/vp/friction/institutional-bottlenecks` | §1.8's aggregation. |
| `POST /api/friction/milestones` *(admin/seed-adjacent, not student/advisor-facing)* | Lets a future real syllabus-import step add milestones without redeploying seed files — stubbed in the route table now so §1.8's aggregation has a real write path to grow into, but not exposed in any v1.1 UI. |

All new routes get the same validation-block style already used throughout `server.ts` (explicit `if (!body.x) return res.status(400)...`, not a schema-validation library — consistent with the rest of the file, not a new dependency).

---

## 3. Frontend Component Hierarchy

Mirrors the existing `portal/ `, `advisorConsole/`, `vpConsole/` split exactly — no new top-level directory pattern introduced.

### 3.1 Student — `packages/web/src/portal/collider/`

```
portal/collider/
  ColliderHome.tsx          — idea submission form + "my projects" list
  IdeaIntakeForm.tsx        — the free-text NLP input; shows extracted
                               skills as removable chips before submit
                               (lets the student correct a bad extraction —
                               important given §1.4's honest "keyword
                               matching, not magic" framing)
  TeamSuggestionCard.tsx    — one suggested teammate: name, faculty badge,
                               match %, "Invite" button
  MyProjectDetail.tsx       — members list, pending invites, opportunity
                               matches surfaced read-only (advisor sees the
                               same data with edit rights, student doesn't)
```

New nav entry in `PortalLayout.tsx`'s existing tab array: `{ to: '/collider', label: 'Collider' }`, same pattern as the other 5 existing tabs — no restructuring of `AuthContext`/routing needed (student identity already comes from context, matching the existing `homeRouteFor` convention).

### 3.2 Advisor — `packages/web/src/advisorConsole/collider/`

```
advisorConsole/collider/
  AdvisorColliderBoard.tsx  — table of organic project groups on this
                               advisor's roster (reuses the same table/
                               Section primitives PortalHome.tsx's
                               collapsed-grades pattern already established
                               — 5-most-recent + "View more", for
                               consistency with the just-shipped grade-table
                               UX rather than a bespoke pagination scheme)
  OpportunityMatchPanel.tsx — per-project internship/grant/fair matches
```

### 3.3 VP — `packages/web/src/vpConsole/collider/` and `.../friction/`

```
vpConsole/collider/
  InnovationTopography.tsx  — the heatmap/bubble chart (§4.2 for exact
                               chart-library styling)
  MicroFundingPanel.tsx     — per-project fund-allocation form + running
                               total, embedded in VpAdvisorDetail.tsx's
                               existing per-advisor drill-down rather than
                               a separate top-level page — funding decisions
                               are naturally scoped to "this advisor's
                               students' projects," matching how the rest
                               of the VP console is already advisor-scoped

vpConsole/friction/
  InstitutionalFrictionDashboard.tsx — the macro bottleneck view (§1.8)
  DepartmentWeekHeatmap.tsx          — the (dept × week) grid itself,
                                        shared visual language with
                                        InnovationTopography.tsx (§4.2)
```

### 3.4 Shared — `packages/web/src/portal/ui/` (already the home for cross-portal primitives like `Primitives.tsx`'s `CgpaBarChart`)

```
portal/ui/
  FrictionTimeline.tsx  — the week-by-week strip + burnout alert banner;
                           used by BOTH the student's own view
                           (portal/collider adjacent, or a new
                           portal/friction/ if it grows past one component)
                           and the advisor's per-student Overview.tsx
                           (same "one component, two portals" pattern
                           CgpaBarChart already establishes)
  SkillChip.tsx          — small reusable tag pill for extracted/matched
                           skills, used across Collider intake, suggestion
                           cards, and topography tooltips
```

### 3.5 State sharing

No new global state library. Every new page fetches its own data via the existing `packages/web/src/api/client.ts` pattern (one typed async function per endpoint, e.g. `colliderSuggestTeam(projectId)`, `frictionTimeline(studentId, semesterOrdinal)`), and identity/role continues to come from `AuthContext` exactly as every existing page already does. `IdeaIntakeForm.tsx`'s local extracted-skill-chip state is component-local (`useState`), not lifted — nothing here needs cross-component synchronization beyond what a normal fetch-on-mount page already does.

---

## 4. UI/UX Theming Implementation

### 4.1 No new CSS framework, no new tokens invented unnecessarily

Every new component styles exclusively with the existing `--su-*` custom properties defined in `packages/web/src/portal/student-theme.css` (imported by all 4 layouts — `PortalLayout.tsx`, `AdvisorLayout.tsx`, `VpLayout.tsx`, and `Login.tsx` — so it's already global across all three portals; confirmed by grep, not assumed). Specifically:

- Card/surface backgrounds: `var(--su-surface)`, `var(--su-surface-2)`
- Borders: `var(--su-border)`, `var(--su-border-strong)`
- Body text: `var(--su-text)`, `var(--su-text-muted)`, `var(--su-text-faint)`
- The brand accent (buttons, active tab underline, "Invite" CTA): `var(--su-accent)` / `var(--su-accent-hover)`
- **Status semantics reused as-is, not reinvented**: burnout-risk alert = `var(--su-danger)` / `var(--su-danger-soft)` (the exact pair the existing probation-risk UI already uses); a project in `matched_externally` stage = `var(--su-good)` / `var(--su-good-soft)` (same pair CGPA-improving already uses); "forming_team" = `var(--su-warn)` / `var(--su-warn-soft)`. This isn't a style preference — reusing the same 3 semantic pairs the rest of the app already trained the user's eye on (green=good, amber=caution, red=risk, exactly as `Primitives.tsx`'s existing `CgpaLegend` already establishes for CGPA standing) means a VP who already reads the probation dashboard correctly reads the friction heatmap on first look, no new legend to learn.
- Radius/shadow: `var(--su-radius)`, `var(--su-shadow-md)` on every new card, matching every existing card in the app pixel-for-pixel.
- Font: no new `font-family` declared anywhere — every new component inherits the body font exactly as the constraint requires (`font-family: inherit` only where a component needs to explicitly opt out of some ancestor override, which nothing here does).

### 4.2 Charting: Recharts, restyled to the token palette

**Library choice:** Recharts — it's the only charting library that cleanly supports both a heatmap-style grid (via a custom `Cell`-mapped `ScatterChart` or `Treemap`) and the bubble chart the spec asks for (native `ScatterChart` with a `ZAxis` for bubble size), without needing D3's lower-level API surface directly (D3 would work but is meaningfully more code for the same visual result; Chart.js's heatmap support is a paid/third-party plugin, which conflicts with the "no conflicting frameworks, nothing new unless justified" constraint). Recharts is a genuinely new `package.json` dependency — the one new runtime dependency this whole blueprint introduces, called out explicitly rather than silently added, exactly as §0's comparison table flags.

**Overriding Recharts' default palette with the app's own tokens** — Recharts accepts inline color props (`fill`, `stroke`) rather than a global theme object, so the pattern is a small typed helper, not per-chart magic-string repetition:

```tsx
// packages/web/src/portal/ui/chartTheme.ts
// Recharts takes literal color values, not CSS var() references, in some
// SVG contexts (older Safari's SVG fill doesn't resolve var() reliably
// inside certain Recharts-generated <defs> gradients) — so this reads the
// CURRENT resolved values from the DOM at chart-mount time via
// getComputedStyle, re-run on theme toggle, instead of hardcoding hex
// (which would silently go stale/wrong the next time student-theme.css's
// dark-mode block is retuned).
export function useChartTokens() {
  const { theme } = useTheme(); // existing hook, re-runs this on toggle
  return useMemo(() => {
    const style = getComputedStyle(document.documentElement);
    const v = (name: string) => style.getPropertyValue(name).trim();
    return {
      good: v('--su-good'), goodSoft: v('--su-good-soft'),
      warn: v('--su-warn'), warnSoft: v('--su-warn-soft'),
      danger: v('--su-danger'), dangerSoft: v('--su-danger-soft'),
      text: v('--su-text'), textMuted: v('--su-text-muted'),
      border: v('--su-border'), surface: v('--su-surface'),
    };
  }, [theme]);
}
```

`DepartmentWeekHeatmap.tsx` and `InnovationTopography.tsx` both consume this hook and pass its values into Recharts' `fill`/`stroke` props — e.g. the friction heatmap's cell color interpolates `goodSoft → warnSoft → dangerSoft` by `frictionScore` percentile (a 3-stop manual interpolation, not a Recharts built-in, since Recharts doesn't ship a color-scale utility) rather than Recharts' default blue/green/red scale. Grid lines use `border`, axis labels use `textMuted`, tooltips are a custom `<Tooltip content={...}>` render function styled with `surface`/`border`/`shadow-md` so a chart tooltip looks like every other floating card in the app, not like a foreign chart-library popup.

### 4.3 Responsive/layout

New pages follow the existing `Section`/grid primitives already used throughout `PortalHome.tsx`/`Overview.tsx` rather than introducing a new layout component — `InnovationTopography.tsx` and `DepartmentWeekHeatmap.tsx` each wrap their chart in the same `<Section title="...">` wrapper every other dashboard card already uses, so they inherit the existing responsive breakpoint behavior for free.

---

## 5. What this blueprint deliberately leaves out (v1.2+ candidates, not silently implied as done)

- A real embedding-model-backed semantic matcher (replacing §1.4/§1.5's keyword/cosine approach with something that understands "self-driving delivery robot" implies `computer-vision` + `robotics` even if neither word appears) — meaningfully more accurate, but a real runtime dependency (an API call or a bundled model) this blueprint intentionally does not assume.
- A live-scraped external-opportunity feed (§1.2's `ExternalOpportunity` stays curated/seeded, like the rest of this demo's data).
- A payment rail behind micro-funding (§2's `fund` endpoint records intent only).
- Real syllabus-file ingestion (§1.3's milestone data stays hand-seeded, matching how `seedCourseOfferings.ts` is synthetic-but-realistic rather than scraped).

None of the above blocks a first, honest v1.1.0 — they're the natural next round once the base version is validated against real advisor/VP feedback.
