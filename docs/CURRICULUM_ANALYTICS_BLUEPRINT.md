# Curriculum Analytics Blueprint — Demand Forecasting, Curriculum Health Monitor, Bottleneck & Dependency Analyzer

**Status:** built, tested, and live-verified — this document describes shipped code, not a proposal. It mirrors `docs/AI_FEATURES_BLUEPRINT.md`'s structure so the two blueprints stay easy to read side by side; unlike that one (still unbuilt at the time of writing), everything below already has passing unit tests and a real Playwright verification pass behind it.

**Target version: v1.2.0**, a superset of v1.1.0 — every existing route, table, and component stays exactly as it is today. Nothing here replaces the fastest-graduation planner, the retake-gate engine, the transfer chain, Project Collider, or the Institutional Friction Dashboard; it's three new modules bolted onto the same three-portal architecture, reusing the same primitives (`ols`/`recencyWeights`/`project` in `linearRegression.ts`, `passRateFromOfferings`/`tierFromOfferings`, `chainUnlockValue`, `CATALOG`/`CATALOG_BY_DEPARTMENT`, the `--su-*` design tokens, the VP-wide/advisor-scoped route-pair pattern) wherever they already do the right thing.

**Repo boundary:** this epic targets the public `academic-advisor` repo only, per explicit instruction — no file in the `ejust-academic-advisor` fork was touched by any part of this work. Same "repo boundary" call already on file for `AI_FEATURES_BLUEPRINT.md`'s still-unbuilt Collider/Friction work: if these three features get ported to the EJUST fork later, that's a deliberate, separate pass afterward.

---

## 0. Feature comparison — v1.1.0 vs. v1.2.0

| Area | v1.1.0 (before) | v1.2.0 (this epic) |
|---|---|---|
| Resource planning | No forward-looking view — only historical `CourseOffering` rows, browsable per-course | **Academic Resource Demand Forecasting**: next-term enrollment projected per course (recency-weighted OLS trend) and rolled up per department, with a derived sections/seats/instructor-load estimate and an honest confidence band |
| Curriculum diagnostics | No aggregate curriculum-quality view — failure rate and prerequisite chains existed as separate signals (`passRateFromOfferings`, `chainUnlockValue`) but were never scored together | **Curriculum Health Monitor**: every course scored 0-100 from its real failure rate, downstream chain impact, current demand pressure, and expected cascading delay — department and institution-wide rollups, worst-5 lists, at-risk counts |
| Bottleneck / dependency analysis | An advisor could see a student's own remaining plan, but nothing surfaced *which courses, institution-wide, cause the most graduation delay* | **Course Bottleneck & Dependency Analyzer**: every course ranked by expected cascading-delay impact, annotated with exactly which other courses it directly blocks, plus (advisor-scoped) which of the advisor's own advisees are genuinely affected right now |
| Prediction engine reuse | `ols`/`recencyWeights`/`project` used for grade/CGPA trend and friction-trend smoothing; `chainUnlockValue` used only by `candidateScore`'s chain-unlock bonus | Same three primitives reused verbatim for enrollment-trend forecasting; `chainUnlockValue` reused verbatim as the "downstream impact" input to the new risk score — no second regression or chain-walk implementation |
| New shared types | — | `packages/shared/src/types/curriculumAnalytics.ts`: `DemandForecast`, `DepartmentDemandForecast`, `CourseRiskProfile`, `CurriculumHealthReport`, `BottleneckCourse`, `AffectedStudentRow` |
| New config | — | `predictionWeights.json`'s `curriculumAnalytics` block — every coefficient retunable without a redeploy, same convention as every existing formula in that file |
| New routes | — | 6 new endpoints, 3 VP-wide + 3 advisor-scoped — see §2 |
| New top-level nav items | — | Advisor: "Demand forecast", "Curriculum health", "Bottleneck analyzer". VP: same 3 tabs under `/vp/*` |
| Runtime dependencies | — | None — every new page reuses the already-installed Recharts + `chartTheme.ts` pattern; no new `package.json` entry |

---

## 1. Data model & the shared risk-scoring primitive

### 1.1 Where this lives

`packages/shared/src/types/curriculumAnalytics.ts`, re-exported from `packages/shared/src/index.ts`'s existing barrel — same one-file-per-domain convention as `venture.ts`/`friction.ts`/`collider.ts`.

No new persistence surface: everything is derived, on every request, from data that already exists — `CourseOffering` history (`seedCourseOfferings.ts`), the prerequisite graph (`Course.prereq`, `seedCatalog.ts`), and `db.getCurriculum(studentId)`'s existing per-course status view. Nothing is cached/stored, matching how `institutionalBottleneck.service.ts` and `innovationTopography.service.ts` are themselves pure recompute-on-request aggregations, not materialized tables.

### 1.2 Schema

```ts
// packages/shared/src/types/curriculumAnalytics.ts

export interface DemandForecast {
  courseCode: string;
  courseName: string;
  departmentId: string | null;
  history: Array<{ term: string; year: number; enrolled: number }>;
  nextTermEnrolled: number;
  confidenceBand: number;          // +/- seats, from the OLS fit's residual spread
  forecastedSections: number;      // derived estimate — see §5
  forecastedSeatsNeeded: number;
  forecastedInstructorLoad: number; // 1:1 with forecastedSections — see §5
  trendSlope: number;
}

export interface DepartmentDemandForecast {
  departmentId: string;
  totalNextTermEnrolled: number;
  totalForecastedSections: number;
  totalForecastedInstructorLoad: number;
  courses: DemandForecast[];
}

export interface CourseRiskProfile {
  courseCode: string;
  courseName: string;
  departmentId: string | null;
  failureRate: number;             // 100 - passRateFromOfferings(offerings)
  downstreamImpact: number;        // chainUnlockValue(code, catalog)
  demandPressure: number;          // forecastedNextTermEnrolled / typical class size
  cascadingDelaySemesters: number; // the one genuinely new number — see §1.4
  healthScore: number;             // 0-100, higher = healthier
}

export interface CurriculumHealthReport {
  departmentId: string | null;     // null = every real department (VP view)
  averageHealthScore: number;
  coursesAtRisk: number;           // healthScore < weights.curriculumAnalytics.health.atRiskThreshold
  totalCourses: number;
  worstCourses: CourseRiskProfile[]; // ascending by healthScore, sliced to 5
  allCourses: CourseRiskProfile[];
}

export interface BottleneckCourse extends CourseRiskProfile {
  directlyBlocks: string[];        // course codes whose prereq[] includes this course
}

export interface AffectedStudentRow {
  studentId: string;
  bottleneckCourseCode: string;
  reason: 'failed_needs_retake' | 'prereq_not_yet_cleared';
}
```

### 1.3 Config

`packages/api/src/config/predictionWeights.json`'s new top-level block, weights sum to 100 (same "coefficients sum to a round total" convention `candidateScore` already uses):

```json
"curriculumAnalytics": {
  "health": {
    "failureWeight": 35,
    "chainWeight": 25,
    "demandWeight": 20,
    "delayWeight": 20,
    "atRiskThreshold": 55
  },
  "forecast": {
    "saturationThreshold": 1.3,
    "maxWaitTermsAtSaturation": 2
  }
}
```

### 1.4 The shared risk-scoring primitive (Features 2 and 3's common foundation)

Curriculum Health Monitor and Bottleneck & Dependency Analyzer both need "how much cascading risk does this course carry" — computing that twice would violate this codebase's established discipline of composing, not duplicating (`chainUnlockValue`/`ols`/`passRateFromOfferings` are each defined once and reused everywhere they apply). Both features are built on one pure function:

```ts
// packages/api/src/modules/curriculumAnalytics/courseRiskScore.service.ts

export function computeCourseRisk(input: CourseRiskInput): CourseRiskProfile {
  const failureRate = 100 - passRateFromOfferings(offerings);        // reused, unchanged
  const downstreamImpact = chainUnlockValue(course.code, catalog);   // reused, unchanged
  const typicalClassSize = CATEGORY_BASELINE[course.category].classSize;
  const demandPressure = typicalClassSize > 0 ? forecastedNextTermEnrolled / typicalClassSize : 1;
  const retakeWaitTerms = retakeWaitTermsFor(demandPressure);        // see below

  const cascadingDelaySemesters =
    (failureRate / 100) * retakeWaitTerms * Math.log2(1 + downstreamImpact);

  const h = weights.curriculumAnalytics.health;
  const rawHealth = 100
    - h.failureWeight * (failureRate / 100)
    - h.chainWeight   * Math.min(downstreamImpact / weights.chainUnlock.depth, 1)
    - h.demandWeight  * Math.min(Math.max(demandPressure - 1, 0), 1)
    - h.delayWeight   * (Math.min(cascadingDelaySemesters, 3) / 3);

  const healthScore = Math.round(Math.max(0, Math.min(100, rawHealth)) * 10) / 10;
  return { courseCode, courseName, departmentId, failureRate, downstreamImpact, demandPressure, cascadingDelaySemesters, healthScore };
}
```

`retakeWaitTermsFor(demandPressure)` is the one honest piece of derived-availability logic in this epic: `1` term normally, interpolating linearly toward `weights.curriculumAnalytics.forecast.maxWaitTermsAtSaturation` (default `2`) as `demandPressure` crosses `weights.curriculumAnalytics.forecast.saturationThreshold` (default `1.3`, i.e. 30% over typical class size) — a straight-line interpolation, not a second regression, because there is no real course-cadence signal to regress against (see §5).

Unit-tested exhaustively on its own before either consuming feature was built (`courseRiskScore.service.test.ts`, 6 tests): zero-offering-history fallback (no divide-by-zero), a leaf course with no dependents (`downstreamImpact = 0`, never ranks as a bottleneck regardless of failure rate), monotonic response to failure rate, a 100%-pass-rate course scoring near-perfect health apart from its real chain-position penalty, and the `demandPressure` saturation-interpolation boundary.

### 1.5 Feature 1 — demand forecasting math

```ts
// packages/api/src/modules/curriculumAnalytics/resourceForecast.service.ts

export function forecastCourseDemand(course, offerings): DemandForecast {
  const chronological = [...offerings].sort((a, b) => a.year - b.year || a.term.localeCompare(b.term));
  const x = chronological.map((_, i) => i);
  const y = chronological.map(o => o.enrolled);
  const fit = ols(x, y, recencyWeights(x.length, weights.trend.recencyHalfLife)); // same halfLife=5 already tuned elsewhere
  const nextTermEnrolled = Math.round(clamp(project(fit, x.length), 0, typicalClassSize * 3));
  const forecastedSections = Math.ceil(nextTermEnrolled / typicalClassSize);
  // confidenceBand from the fit's residual standard deviation — an honest
  // uncertainty band, not a fabricated single number.
}
```

`forecastDepartmentDemand(departmentId, catalog, offeringsByCourse)` sums every course forecast in that department's catalog; `forecastAllDepartments(catalogByDepartment, offeringsByCourse)` returns one entry per real department, for the VP's rollup. 7 unit tests (`resourceForecast.service.test.ts`) confirm a genuinely rising/flat/declining enrollment history drives the forecast direction correctly (wiring correctness — the OLS math itself is already covered by `linearRegression.test.ts`), and that department aggregation sums correctly against `CATALOG_BY_DEPARTMENT[dept].length`.

### 1.6 Feature 2 — curriculum health rollup

```ts
// packages/api/src/modules/curriculumAnalytics/curriculumHealthMonitor.service.ts

export function buildHealthMonitor(departmentId, catalogByDepartment, catalog, offeringsByCourse): CurriculumHealthReport {
  const scopedCourses = departmentId === null ? catalog : (catalogByDepartment[departmentId] ?? []);
  // computeCourseRisk() per course, then averageHealthScore / coursesAtRisk / worstCourses (asc, top 5)
}
```

**A real bug was caught and fixed here before shipping**, worth documenting since it's exactly the kind of double-counting mistake this codebase's audit discipline exists to catch: `CATALOG_BY_DEPARTMENT[dept]` is each department's own *full requirement list*, which already includes shared/UR courses used by multiple departments — naively flattening `Object.values(catalogByDepartment).flat()` for the VP's unscoped (`departmentId === null`) view would count every shared course once per department it's listed under. Fixed by using the already-deduplicated `CATALOG` export directly for the VP's view, never re-flattening `catalogByDepartment`. A dedicated regression test (`curriculumHealthMonitor.service.test.ts`) constructs a synthetic shared course appearing in 2 department catalogs and asserts it appears exactly once in the unscoped report.

### 1.7 Feature 3 — bottleneck ranking and the advisor cross-reference

```ts
// packages/api/src/modules/curriculumAnalytics/bottleneckDependencyAnalyzer.service.ts

export function rankBottlenecks(catalog, offeringsByCourse, forecastedEnrolledByCode): BottleneckCourse[] {
  // computeCourseRisk() per course + directlyBlocks (catalog.filter(c => c.prereq.includes(course.code)))
  // sorted by cascadingDelaySemesters descending
}

export function affectedAdvisees(roster: StudentForBottleneckCheck[], bottlenecks: BottleneckCourse[]): AffectedStudentRow[] {
  // for each course with cascadingDelaySemesters > 0 ("genuine" bottlenecks):
  //   'failed_needs_retake'    if the student's failedCourseCodes includes it
  //   'prereq_not_yet_cleared' if not yet passed AND directlyBlocks intersects
  //                            the student's own remainingCourseCodes
}
```

`StudentForBottleneckCheck` (`{ studentId, failedCourseCodes, passedCourseCodes, remainingCourseCodes }`) is built at the route layer from `db.getCurriculum(studentId)` — the single existing per-student course-status source (`'passed' | 'needs_retake' | 'registered' | 'eligible' | 'locked'`), not a new query. This is the one genuinely new cross-reference in the whole epic; everything else in Feature 3 reuses `rankBottlenecks` as-is.

7 unit tests (`bottleneckDependencyAnalyzer.service.test.ts`) cover ranking order/stability, the `directlyBlocks` annotation, and — the same risk class already caught twice earlier this project for transfer requests and venture ownership — 5 explicit roster-ownership-scoping tests confirming a student never shows up in `affectedAdvisees` for an advisor who isn't really theirs.

---

## 2. Backend API

Following `server.ts`'s existing convention exactly — flat Express routes, the same VP-wide (`GET /api/vp/<module>/<name>`, no params) / Advisor-scoped (`GET /api/advisors/:advisorId/<name>`, 404 via `db.getAdvisor()`) route-pair pattern the friction/collider routes already established:

| Method & path | Purpose |
|---|---|
| `GET /api/vp/curriculum-analytics/demand-forecast` | `forecastAllDepartments()` — every real department, unfiltered. |
| `GET /api/advisors/:advisorId/curriculum-analytics/demand-forecast` | 404 if unknown advisor; `forecastDepartmentDemand(advisor.departmentId, ...)` — the advisor's own **home department**, a deliberately wider scope than their 25-student roster (see §3's "Department" scope note). |
| `GET /api/vp/curriculum-analytics/health-monitor` | `buildHealthMonitor(null, ...)` — institution-wide. |
| `GET /api/advisors/:advisorId/curriculum-analytics/health-monitor` | `buildHealthMonitor(advisor.departmentId, ...)` — same 404 guard. |
| `GET /api/vp/curriculum-analytics/bottlenecks` | `rankBottlenecks(CATALOG, ...)` — institution-wide, no per-student tracing (that already exists on `VpAdvisorDetail.tsx`). |
| `GET /api/advisors/:advisorId/curriculum-analytics/bottlenecks` | Same ranked list **plus** `affectedAdvisees`, built from that advisor's own real roster (`db.listStudents().filter(s => s.advisorId === advisorId && s.status !== 'dismissed')`) — the "Advisors" roster-actionable framing this feature was explicitly named for, unlike Features 1-2's "Department" framing. |

Advisor-scoped `affectedAdvisees` rows are enriched with `studentName` at the HTTP boundary (`server.ts`'s `rosterNameById` map), matching the established `withMemberNames`/`withProfessorName` pattern of keeping the domain type name-free and attaching display names only at the response edge.

---

## 3. Frontend

Mirrors the existing `vpConsole/` / `advisorConsole/` split exactly — no new directory or nesting convention introduced:

```
vpConsole/
  VpDemandForecast.tsx          — StatCards + a department-rollup horizontal
                                   bar chart (Recharts, via chartTheme.ts) +
                                   full department table
  VpCurriculumHealthMonitor.tsx — StatCards + a ranked table (healthBadge()
                                   colors by score threshold), table-only —
                                   no chart, matching AdvisorFrictionOverview's
                                   own precedent
  VpBottleneckAnalyzer.tsx      — StatCards + institution-wide ranked table
                                   with a "Directly blocks" column

advisorConsole/
  AdvisorDemandForecast.tsx          — StatCards + own-department course
                                        table, confidence bands, rising/
                                        declining/steady badges
  AdvisorCurriculumHealthMonitor.tsx — same pattern, department-scoped
  AdvisorBottleneckAnalyzer.tsx      — StatCards + "Advisees affected" table
                                        (click-through to the student's file)
                                        + the institution-wide ranking table,
                                        sliced to top 15, for context
```

Each page fetches its own data via `packages/web/src/api/client.ts`'s existing one-function-per-endpoint pattern (`vpDemandForecast()`, `advisorDemandForecast(advisorId)`, `vpCurriculumHealthMonitor()`, `advisorCurriculumHealthMonitor(advisorId)`, `vpBottlenecks()`, `advisorBottlenecks(advisorId)`), built from the same `Section`/`Loading`/`Empty`/`StatCard` primitives (`portal/ui/Primitives.tsx`) every other dashboard page already uses — no new component library, no new fetch/state pattern.

`AffectedStudentRowDTO` (`AffectedStudentRow & { studentName: string }`) and `AdvisorBottlenecksDTO` (`{ bottlenecks: BottleneckCourse[]; affectedAdvisees: AffectedStudentRowDTO[] }`) are the only web-local `*DTO` types added — matching the `FrictionOverviewRowDTO` precedent of only wrapping a shared type where the response is genuinely enriched at the API boundary.

Wired into `packages/web/src/app/router.tsx` under both the advisor tree (bare paths: `demand-forecast`, `curriculum-health`, `bottleneck-analyzer`) and the `/vp` tree (same bare paths, since the VP has no `:id` URL segment), plus one nav tab each in `VpLayout.tsx`'s and `AdvisorLayout.tsx`'s existing tab arrays.

### The "Department" audience — a scope, not a new role

The user's ask named these features' audience as "Department, VP" (Features 1-2) and "Advisors, VP" (Feature 3). This app has no Department-Head login (`AuthState` is exactly `advisor | student | vice_president` — the project's own history explicitly *removed* a 4th role rather than add one), so "Department" is implemented as a **scope**, not a new role: the VP sees every department; each Advisor sees their own **home department** (`Advisor.departmentId`), which is a genuinely wider scope than their usual roster-level pages. This is exactly why Feature 3 says "Advisors" (roster-level, actionable via `affectedAdvisees`) while Features 1-2 say "Department" (department-level, diagnostic) — the distinction in the original ask is real, and is implemented as one, not collapsed into a single scope for convenience.

---

## 4. Theming

No new CSS framework, no new tokens. Every new component styles exclusively with the existing `--su-*` custom properties (`student-theme.css`) — surfaces, borders, text, the brand accent, and the same 3 reused status-semantic pairs (`--su-good`/`--su-warn`/`--su-danger` + their `-soft` tints) every other dashboard in the app already trained the user's eye on: a healthy course = good, an at-risk course = warn, a genuine bottleneck's expected delay badge = danger. `VpDemandForecast.tsx`'s department bar chart reuses `chartTheme.ts`'s `useChartTokens()` hook verbatim — the same theme-aware Recharts styling `InnovationTopography`'s chart already established, so a theme toggle mid-session re-colors this chart exactly like every other one in the app, with zero new charting code.

Responsiveness: `Section`/`StatCard`/table-wrap primitives are reused as-is, so the new pages inherit the existing breakpoint behavior for free. Verified live at 375px on all 6 pages (VP and advisor, both roles) with zero horizontal overflow (`document.documentElement.scrollWidth - clientWidth === 0`) and zero console errors, against a fresh dev-server restart.

---

## 5. What this epic deliberately leaves out (documented simplifications, not hidden gaps)

Verified by direct repo-wide search before this epic was designed, not assumed:

- **No real `Section`/`Instructor`/seat-capacity entity.** `CourseOffering.enrolled` is a whole-cohort headcount, not a per-section seat count, and no such entity exists anywhere in `packages/shared/src/types/*.ts` or the DB layer. Demand Forecasting's `forecastedSections`/`forecastedSeatsNeeded`/`forecastedInstructorLoad` are **derived estimates** (forecasted enrollment ÷ `CATEGORY_BASELINE[category].classSize`, 1:1 section-to-instructor) — explicitly labeled as such in the UI ("Derived estimate — see note below") and never presented as if real staffing/timetabling data exists behind them.
- **No course-offering-cadence/availability modeling.** The seed generates a Fall+Spring offering for every course, every year, uniformly — there is no "this course only runs once a year" flag anywhere. "Availability pressure" (`demandPressure`, and the `retakeWaitTermsFor` interpolation it feeds) is derived from forecasted demand relative to a course's typical historical class size, not from a true scheduling gap.
- **No Department-Head login role.** "Department" audience is a scope on the existing Advisor/VP roles (see §3), not a new `AuthState` value.
- **Any porting to `ejust-academic-advisor`.** Explicitly excluded from this epic per instruction — a deliberate, separate pass later, same as the standing repo-boundary note already on file for `AI_FEATURES_BLUEPRINT.md`'s still-unbuilt work.

None of the above is a blocker to a real, honest v1.2.0 — each is a documented simplification with an explicit "how to close this gap for real" path, matching how `CourseOffering` itself has been treated in this codebase since it was first seeded.
