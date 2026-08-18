# Academic Advising & Early-Warning System — Full Build Specification

**Prepared for:** hand-off to a build session (Claude Code / another Claude chat)
**Based on:** the uploaded `FoE Academic Advisor` HTML prototype (single-file, synthetic-data demo)
**Purpose of this document:** this is a *complete implementation plan*, not starter code. It specifies the domain model, every business rule (old + new), the prediction math (weighted sum + linear regression), the full decision flow for probation/transfer, the file/route architecture for a real multi-file web app, and worked examples for every scenario. A build agent should be able to implement the whole system from this document alone.

---

## 0. What the prototype already does (baseline to preserve)

The uploaded prototype is a client-only HTML/JS mock with three features, all of which must be **preserved and re-implemented properly** in the real app:

1. **Fastest-graduation plan** — ranks eligible next-semester courses with a weighted-sum score (expected grade quality, prerequisite-unlock value, credit progress, retake-replacement bonus, risk penalty) and packs them into the semester using a 0/1-knapsack over the credit-hour cap.
2. **Target-CGPA plan** — same engine, re-weighted toward "safety" (below target) or "speed" (above target).
3. **Best-fit department quiz** — a 5-question preference quiz combined with the student's grades in each department's shared "gateway" courses and synthetic 3-year alumni outcomes, blended with a weighted sum (50% quiz / 30% grades / 20% alumni).

It also encodes real handbook mechanics we must keep:
- Two grading scales (engineering-scale `ENG_SCALE`, university-requirement scale `UR_SCALE`), letter grades A+ → F mapped to 1.00–4.00 points.
- **Grade replacement rule**: a retake's new grade *overwrites* the old one in CGPA — it is never averaged.
- **Level thresholds** by cumulative earned credit hours: Level 1 (0–35), 2 (36–71), 3 (72–107), 4 (108–143), 5 (144–160).
- **Registration credit cap**: 20 credit hours normally, 14 while on probation (CGPA < 2.00).
- Course categories: `core/program/faculty/school` (must be taken at-or-before the student's current level), `ur_core`/`ur_elective` (LRA/University-Requirement courses, may be taken from any year's list), `program_elective`, `special` (graduation project / industrial training, own gating).
- A synthetic "3-year history" per course (`avgPct`, `passRate`, `trendDelta`, sample size `n`) used to project a candidate's expected score.

This document extends all of the above with the **probation counter / dismissal**, **retake opt-in gate**, **department & faculty transfer engine**, and a **linear-regression-based** projection layer, then lays out the full production architecture.

---

## 1. Domain Model

### 1.1 Core Entities

| Entity | Key Fields | Notes |
|---|---|---|
| **Student** | `id`, `name`, `nationalId`, `facultyId`, `departmentId`, `levelId`, `entrySemesterId`, `status` (`active`, `probation`, `dismissed`, `transferred_internal`, `transferred_external`, `graduated`) | `status` is derived, not hand-set, except `dismissed`/terminal states which are locked once written. |
| **Faculty** | `id`, `name`, `code` | e.g. Faculty of Engineering. |
| **Department** | `id`, `facultyId`, `name`, `code`, `traits[]`, `gatewayCourseCodes[]` | `traits` and `gatewayCourseCodes` feed the best-fit engine (Section 6). |
| **Course** | `code`, `name`, `credits`, `semesterOrdinal` (catalog semester it's normally offered), `level` (min year), `prereq[]`, `coreq[]`, `category` (`core/program/faculty/school/ur_core/ur_elective/program_elective/special`), `isUR` (bool), `departmentId` (nullable for shared/UR courses), `transferable` (bool — see §7.3) |
| **CourseOffering** (optional, for real historical stats instead of synthetic) | `courseCode`, `semesterTerm`, `year`, `enrolled`, `passed`, `meanPct`, `stdDevPct` | Real 3-year rolling history table, replaces the prototype's seeded-RNG `HISTORY` object. |
| **Semester** | `id`, `studentId`, `termLabel` (e.g. "Fall 2025"), `ordinal` (1, 2, 3… in *this student's* timeline), `kind` (`normal`, `transfer_semester`), `creditCap`, `isHalfLoad` (bool) | One row per semester the student is/was enrolled in. |
| **Enrollment** (transcript line) | `id`, `semesterId`, `courseCode`, `attemptNumber`, `pct`, `letter`, `points`, `isRetake` (bool), `countsInCgpa` (bool) | The atomic transcript record. CGPA is always computed by taking, per course code, the **latest** `countsInCgpa=true` attempt (replacement rule). |
| **CgpaSnapshot** | `id`, `studentId`, `semesterId`, `semesterGpa`, `cgpa`, `cumulativeCredits`, `isBaseSnapshot` (bool) | One row generated per closed semester; `isBaseSnapshot=true` only for the row created by a Transfer Semester (§7.3), which becomes the new anchor for all CGPA math going forward. |
| **ProbationCounter** | `id`, `studentId`, `count` (0–6), `lastUpdatedSemesterId`, `armedFromSemesterOrdinal` (see §4.4) | The dismissal-tracking counter. One live row per student; history of changes kept in `ProbationCounterLog` for audit/explainability. |
| **ProbationCounterLog** | `id`, `studentId`, `semesterId`, `previousCount`, `newCount`, `reason` (`increment_low_cgpa`, `reset_recovered`, `reset_faculty_transfer`, `unchanged_internal_transfer`, `not_armed_first_semester`) | Append-only audit trail — required for the "explain this decision" UI and for advisor override review. |
| **TransferRecord** | `id`, `studentId`, `type` (`internal_department`, `external_faculty`), `fromDepartmentId`, `toDepartmentId`, `fromFacultyId`, `toFacultyId`, `effectiveSemesterId`, `recommendationBasis` (JSON — stores the scores/trend that triggered it), `counterAction` (`retained`, `reset`) | One row per executed transfer; the recommendation itself is a separate, non-persisted `TransferRecommendation` returned by the engine before the student/advisor confirms. |
| **RetakePreference** | `id`, `studentId`, `semesterId`, `considerRetakes` (bool), `answeredAt` | Captures the yes/no gate answer (§5) per planning session; re-asked every planning run (a student's willingness can change each semester). |
| **ProfessorProfile** | `id`, `facultyId`, `departmentId`, `name`, `researchTags[]`, `acceptingUndergrads` (bool) | §16 — one row per faculty member who can post `VentureProject`s. `researchTags[]` is the same free-tag shape as a course's/department's `traits[]` (§6), reused here for consistency. |
| **VentureProject** | `id`, `professorId`, `title`, `description`, `type` (`academic_research`, `commercial_spinoff`), `requiredCourseCodes[]`, `preferredSkills[]`, `capacity` (int), `isActive` (bool) | §16 — a lab placement, research collaboration, or startup spin-off opening. Excluded from matching entirely once `isActive=false` or accepted-match count reaches `capacity` (§16.8). |
| **StudentVentureMatch** | `id`, `studentId`, `ventureProjectId`, `matchScore` (0–1, §3.5), `status` (`suggested`, `applied`, `accepted`, `declined`), `createdAt`, `cvFileName?`, `cvDataUrl?` (§16.4.1 — attached optionally when expressing interest) | §16 — one row per student×project pairing the engine has scored ≥ the display threshold OR the student has explicitly applied to; `suggested` rows below threshold are never persisted (cheap to recompute, no need to store noise). |

### 1.2 Derived values (never stored, always computed)

- `student.level` = `levelFromCredits(cumulativeEarnedCredits)`
- `student.creditCap` = `creditCapFor(student)` (§4.1 — has 3 possible outputs now: 20 / 14 / 16)
- `student.cgpa` = latest `CgpaSnapshot.cgpa`, computed from the transcript **after** the most recent `isBaseSnapshot` row (or from semester 1 if none exists)
- `student.probationCounter` = latest `ProbationCounter.count`
- `student.isDismissed` = `probationCounter.count >= 6`

---
## 2. Grading, Levels, Registration Rules (baseline, unchanged from prototype)

### 2.1 Grade scales

```
ENG_SCALE (engineering/program/faculty/school courses):
  95+ → A+ 4.00   90+ → A 3.70   85+ → B+ 3.30   80+ → B 3.00
  75+ → C+ 2.70   70+ → C 2.30   65+ → D+ 2.00   60+ → D 1.70   <60 → F 1.00

UR_SCALE (isUR = true, LRA / University-Requirement courses):
  same letter bands, pass floor is lower (50% vs 60%) per handbook — keep the
  prototype's ENG/UR floor split when generating/validating synthetic history.
```

### 2.2 CGPA computation (replacement rule)

```
computeCGPA(transcript, sinceBaseSnapshot = null):
  rows = latestAttemptPerCourse(transcript)          # replacement, not averaging
  if sinceBaseSnapshot: rows = rows ∩ courses counted from that base forward
  totalPts = Σ row.points * course.credits
  totalCr  = Σ course.credits   (excluding W/withdrawn)
  return totalCr > 0 ? totalPts / totalCr : 0
```

### 2.3 Levels

```
levelFromCredits(cr):
  cr ≥ 144 → 5 | cr ≥ 108 → 4 | cr ≥ 72 → 3 | cr ≥ 36 → 2 | else → 1
```

### 2.4 Credit-hour registration cap — EXTENDED

The prototype has two cap tiers; the real system needs **three**:

```
creditCapFor(student):
  if student.isFirstSemesterOfLevel1 and student.gpa < 2.00:
      return 16                      # NEW — half-load rule, §4.5
  if student.cgpa < 2.00:
      return 14                      # existing probation cap
  return 20                          # normal
```

`isFirstSemesterOfLevel1` = the student has exactly one closed `Semester` row of kind `normal` (their very first), and no `TransferRecord` exists yet (a freshly-transferred external student starts a *new* first-semester-like state too — see §7.3.4).

---

## 3. Prediction Engine — Weighted Sum + Linear Regression

Everything the system predicts (a course's expected score, a semester's expected GPA, next semesters' CGPA trend, and department fit) is produced by the **same two building blocks**, combined per use case:

- **Weighted sum (WS):** a linear combination of normalized 0–1 signals with fixed or mode-dependent weights — used for *ranking/scoring discrete choices* (which course to take, which department fits).
- **Linear regression (LR):** ordinary least squares fit of a value against semester-ordinal (time) — used for *projecting a trend forward* (a course's typical score trend across recent terms; a student's own CGPA trajectory across their own semesters).

This mirrors the prototype's `expectedNewPct = avgPct + trendDelta*0.5` and `scoreCandidate(...)`, generalized and made rigorous.

### 3.1 Per-course expected score: `expectedPct(course, student)`

Two regression-derived signals are blended with the weighted sum:

**(a) Cohort trend (peer regression)** — fit a simple linear regression of the course's mean score against the last *N* (≥6, configurable) offerings:

```
CourseOffering rows for `code`, ordered by term →  points (x = term index 0..N-1, y = meanPct)
b = Σ((x-x̄)(y-ȳ)) / Σ((x-x̄)²)          # slope
a = ȳ - b·x̄                              # intercept
cohortProjectedPct = a + b·(N)            # project one term ahead
cohortProjectedPct = clamp(cohortProjectedPct, 0, 100)
```
Falls back to the prototype's synthetic `HISTORY[code]` generator (seeded RNG + tier bell curve) only in demo/seed mode when `CourseOffering` history has < 3 data points.

**(b) Student ability regression (personal trend)** — fit a linear regression of the *student's own* percentage marks across their last *M* (≥3) completed courses, ordered by the semester they were taken, restricted to courses in the same category (`program`/`faculty` vs `ur_*`) as the target course, to avoid mixing easy LRA marks with hard core-course marks:

```
studentTrendPct = a_s + b_s·(nextIndex)   # same OLS mechanics, on the student's own history
```
If the student has fewer than 3 comparable graded courses (new/transfer student), fall back to their overall percentage average, and if that's empty too, fall back to the course's cohort mean.

**(c) Weighted-sum blend:**

```
expectedPct(course, student) =
      0.45 * cohortProjectedPct        # what most students tend to score, trend-adjusted
    + 0.40 * studentTrendPct           # this student's own trajectory
    + 0.15 * courseDifficultyAdjustment(course, student)
```
`courseDifficultyAdjustment` nudges the blend down for `historically tough` tier courses (bottom pass-rate tercile) and up for `low-risk` tier, capped at ±5 points — this replaces the prototype's `tierFor()` bucket used only for synthetic generation; in the real system it is measured directly from `CourseOffering.passed/enrolled`.

Weights (0.45 / 0.40 / 0.15) are configuration, not hard-coded constants — expose them in `config/predictionWeights.json` so an academic committee can retune without a redeploy.

### 3.2 Course candidate score: `scoreCandidate(candidate, mode)` — weighted sum (unchanged structurally, extended)

```
score =
    46 * (expectedGrade.points / 4)                        # expected grade quality
  + 18 * min(chainUnlockValue, 4) / 4                       # multi-level dependency chain, §3.3
  + 12 * (course.credits / 3)                                # progress toward the 160-credit target
  + 30 * (isRetake && deltaPts>0 ? deltaPts/3 : 0)           # replacement-rule reward, only if retake gate = YES
  - 20 * (1 - passRate/100)                                  # risk penalty

mode == 'target_safe' → + 20*(expectedGrade.points/4), − 6*(course.credits/3)
mode == 'target_fast' → + 10*(course.credits/3)
mode == 'probation_repair' → + 26*(expectedGrade.points/4), −10*(1-passRate/100)*2, credits weight halved
                              # NEW mode used automatically when student.cgpa < 2.00 (§4.3)
```

### 3.3 Dependency chain value — multi-level, not just immediate unlocks

The prototype only counted *direct* unlocks (`unlockCount`). The real engine must value the **whole downstream chain**, because passing one gateway course can cascade into many future terms:

```
chainUnlockValue(code, depth=3, decay=0.6):
  direct = courses whose prereq[] includes code
  value = |direct|
  for each d in direct:
      value += decay * chainUnlockValue(d.code, depth-1, decay)   # recursive, decayed
  return value   (memoize per catalog version — it's static per course, recompute only when the catalog changes)
```
This produces a single static "unlock weight" per course in the current catalog, cached in `CourseChainWeight` table, refreshed whenever the catalog changes (new prereq wiring), not per student — cheap to serve.

### 3.4 Semester / CGPA trajectory projection (drives the transfer decision, §4)

To decide whether "the trend keeps the CGPA the same or lowers it" (the trigger for recommending a transfer), the engine must **simulate forward**, not just look at one number:

```
projectSemesterPlan(student, plan):
    projectedTranscript = student.transcript ∪ { for each course in plan: expectedPct(course, student) → expectedGrade }
    projectedCGPA = computeCGPA(projectedTranscript, sinceBaseSnapshot=student.activeBaseSnapshot)
    return projectedCGPA

projectCGPATrend(student, horizonSemesters = 2):
    # Linear regression of the student's own last K actual CGPA snapshots (K ≥ 3) vs semester ordinal
    a, b = OLS(x = semesterOrdinal, y = cgpaSnapshot.cgpa)   # same OLS routine as §3.1(b)
    trendSlope = b
    return trendSlope       # >  +0.01 → improving | between −0.01..+0.01 → flat | < −0.01 → declining
```

Two numbers feed the branch in §4.3:
1. `projectedCGPA` from the *recommended plan itself* (does the recommended plan, if grades land as expected, raise CGPA above current?)
2. `trendSlope` from the *student's actual historical CGPA series* (is their real, longer-run trajectory flat/declining regardless of any one semester's plan?)

Both must be computed and stored per planning run in `PlanningRun` (see §9) for auditability and for the UI's "why are you recommending this" explanation panel.

### 3.5 Venture fit score: `ventureFitScore(student, project)` (§16)

A third weighted-sum use of the same WS engine, blending three 0–1 signals — course competency, skill/interest alignment, and academic trajectory — exactly the same pattern as §6's `fitScore`, just with a different set of signals and a different target (a `VentureProject`, not a department):

```
ventureFitScore(student, project) =
    0.40 * courseCompetencyScore(student, project.requiredCourseCodes)
  + 0.40 * skillAlignmentScore(student, project.preferredSkills)
  + 0.20 * academicTrajectoryScore(student)
```

**(a) Course Competency (40%)** — average percentage score across the project's required courses; a required course the student hasn't taken contributes **0** to the average (not excluded from it — a project asking for five courses the student took none of scores 0, not undefined):

```
courseCompetencyScore(student, requiredCourseCodes) =
    mean over c in requiredCourseCodes of:
        student has a graded attempt for c ? (latest countsInCgpa pct for c) / 100 : 0
    # requiredCourseCodes is never empty in a well-formed VentureProject; if it were, this returns 0.
```

**(b) Skill/Interest Alignment (40%)** — overlap between the project's `preferredSkills[]` and TWO signals about the student, weighted evenly: what they *say* they're interested in, and what their *grades* say they're actually good at. The first reuses §6's quiz mechanism directly (trait-tagged multiple-choice options — see §16.1's Venture Interest Form) rather than inventing a second one; the second reuses the student's per-category grade averages already computed for §6's department fit:

```
skillAlignmentScore(student, project) =
    0.5 * traitOverlap(student.ventureInterestAnswers, project.preferredSkills)   # §16.1 form, §6-style trait matching
  + 0.5 * traitOverlap(student.topPerformingElectiveCategories, project.preferredSkills)
```
`traitOverlap` is the same normalized match-count function §6 already defines (`traitMatchCount / totalAnswered`), just called against `preferredSkills` instead of a department's `traits[]`. **Judgment call, flagged:** the request describes this signal in plain English ("overlap between top-performing elective categories and preferredSkills"); the 50/50 split against the Venture Interest Form's stated-interest signal is this document's own formalization, made because §16's own feature description says the match must blend "the student's performance... their stated technical interests... and the professor's requested skill profiles" — i.e. three inputs, not two — so folding the form answers in here (rather than dropping them) is what makes the formula match the feature's own stated intent.

**(c) Academic Trajectory (20%)** — a continuous 0–1 signal, not a step function, so it composes cleanly with the other two weighted-sum terms while still delivering the plain-English "bonus for improving trend or CGPA > 3.0":

```
academicTrajectoryScore(student) =
    clamp(0.5 * (student.cgpa / 4.0) + 0.5 * (isBonusEligible ? 1 : 0), 0, 1)
  where isBonusEligible = (projectCGPATrend(student).trendSlope > improvingSlopeThreshold)  # §3.4's own OLS output
                        OR (student.cgpa > 3.0)
```

All three sub-weights (0.40 / 0.40 / 0.20) and the >80% display threshold used to inject the Venture Match card (§16.3) live in `predictionWeights.json`'s new `ventureFit` block — configuration, not constants, per §12's existing rule for every other WS formula in this document.

---
## 4. Probation Counter, Dismissal, and the Transfer Decision Tree — CORE NEW LOGIC

This is the heart of the new system. Read this section fully before implementing — every rule the user specified is encoded as an explicit branch below, with the exact edge cases called out.

### 4.1 What increments the counter

At the close of every **normal** semester (not the special first semester, not a Transfer Semester itself — see §4.5 and §7.3.3):

```
onSemesterClose(student, semester):
    cgpaSnap = computeAndStoreCgpaSnapshot(student, semester)
    counter  = getProbationCounter(student)

    if not counter.armed:
        # first semester of level 1 is never armed — see §4.5
        return

    if cgpaSnap.cgpa < 2.00:
        counter.count += 1
        log(reason = 'increment_low_cgpa')
    else:
        if counter.count > 0:
            counter.count = 0
            log(reason = 'reset_recovered')       # §4.4 mid-window recovery
        # else: already 0, nothing to log

    if counter.count >= 6:
        student.status = 'dismissed'
        freeze(student)                            # no further registration; advisor/registrar workflow takes over
```

This single function implements **three** of the user's rules at once:
- The counter increments once per low-CGPA semester (not per course).
- Dismissal fires exactly at count = 6.
- **Mid-window recovery**: the moment `cgpa ≥ 2.00` in *any* semester, the counter resets to 0 — it is **not** a lifetime tally of every low semester the student ever had, it is "how many semesters in a row (since the last recovery) has the CGPA been under 2.00." A student can be flagged, recover, and be flagged again later; each flagged run starts counting from 0.

### 4.2 Recommendation branch — decided every planning run, BEFORE showing courses

```
runAdvisingCycle(student):
    retakeGate = askRetakePreference(student)                 # §5, always asked first
    candidates = buildCandidates(student.transcript, student.level, retakeGate)
    normalPlan = packPlan(candidates, creditCapFor(student), mode = student.cgpa < 2.00 ? 'probation_repair' : 'fast')

    projectedCGPA = projectSemesterPlan(student, normalPlan)          # §3.4 (1)
    trendSlope    = projectCGPATrend(student)                          # §3.4 (2)
    improving     = projectedCGPA > student.cgpa + 0.01 AND trendSlope > -0.01

    if improving:
        return { action: 'SHOW_PLAN', plan: normalPlan, explain: 'plan_projected_to_raise_cgpa' }

    # --- trend is flat or declining: normal in-major plan alone won't clearly help ---
    deptFit = recommendDepartments(student)                            # §6, weighted-sum quiz+grades+alumni
    bestInternalDept = topResult(deptFit, restrictTo = student.faculty.departments)

    internalWouldHelp = simulateUnderDepartment(student, bestInternalDept)   # re-run §3.4 against that dept's
                                                                              # course pool / gateway performance
    if (student.cgpa >= 2.00) AND internalWouldHelp.projectedCGPA > student.cgpa
       AND internalWouldHelp.trendSlope > -0.01
       AND NOT alreadyTransferredInternallyOnce(student):    # avoid recommending dept-hopping forever, §4.3.1
        return {
          action: 'RECOMMEND_INTERNAL_TRANSFER',
          plan: normalPlan,                 # still show the in-major plan as the fallback/status-quo option
          suggestedDepartment: bestInternalDept,
          explain: 'flat_or_declining_trend_but_better_fit_department_available_in_faculty'
        }

    # --- CGPA is still < 2.00, OR no department in this faculty projects an improving trend ---
    return {
      action: 'RECOMMEND_FACULTY_TRANSFER',
      plan: normalPlan,
      suggestedFaculties: rankFacultiesByFit(student),        # same weighted-sum engine, faculty-level traits
      explain: student.cgpa < 2.00
                 ? 'cgpa_remains_below_2_after_projection'
                 : 'no_departmental_alternative_improves_trend'
    }
```

This encodes the user's exact three-tier instruction:

1. **Normal case** — recommend subjects that raise CGPA. Show the plan, done.
2. **Flat/declining trend** (but not yet exhausted alternatives) — before anything else, recommend the *best-fit department* (still same faculty) using the quiz+grades+alumni engine, because "he may perform better in another department."
3. **Still failing** — if CGPA remains below 2.00 even under the best in-faculty alternative, **or** no in-faculty department shows an improving trend for this student — escalate to recommending a **faculty** transfer instead.

> **Important nuance kept faithful to the request:** the internal-department suggestion is *always offered first* before a faculty-level suggestion is ever shown — the system never jumps straight to faculty transfer while an untried, better-fitting department in the same faculty exists.

#### 4.2.1 Guard against infinite department-hopping

If the student has already executed one `TransferRecord(type='internal_department')` and is *still* flat/declining, do not recommend a second internal hop — go straight to the faculty-transfer branch. This is implemented via `alreadyTransferredInternallyOnce(student)` querying `TransferRecord`.

### 4.3 Why "probation_repair" mode exists

When `student.cgpa < 2.00`, `packPlan` is called with `mode='probation_repair'` (§3.2) instead of `'fast'`: expected-grade quality is weighted higher and credit-hour throughput lower, because the priority for a probation student is *raising CGPA*, not *speed to graduation* — throughput only matters again once the student is back above 2.00. This is what "recommend normally the subjects that could get him reach higher CGPA" means concretely: the weighting itself changes, not just the eligibility filter.

### 4.4 Mid-window recovery — worked rule recap

> "the counter reset as well if in a semester of the middle of the 6 semesters that the student managed to get his CGPA higher than 2, the counter resets and starts again from the semesters that become lower than 2."

Implemented exactly by §4.1: `counter.count` is **not** a cumulative all-time tally — it is reset to 0 on any recovering semester, and future low semesters start a fresh count from 1. See Example E in §11 for a full walk-through (counter goes 1→2→0→1→2→3…).

### 4.5 Level-1, first-semester special case (GPA = CGPA)

> "for students who are in level one, if in his first semester he got a GPA lower than 2 and his CGPA become lower than 2 — as GPA and CGPA are identical in the first semester — he gets a half-load (16 credit hours), but it does NOT count toward the warning counter; the counter starts if his CGPA after the 2nd semester remains lower than 2."

```
onFirstSemesterClose(student, semester):
    gpa = computeSemesterGPA(semester)          # == cgpa, since it's the only semester on record
    cgpaSnap = storeCgpaSnapshot(student, semester, cgpa = gpa)
    counter  = getOrCreateProbationCounter(student)
    counter.armed = false                        # NEVER incremented for semester 1, regardless of gpa
    log(reason = 'not_armed_first_semester')

    if gpa < 2.00:
        student.nextSemesterCreditCap = 16        # half-load, §2.4
    # counter stays at 0, unarmed

onSemesterClose(student, semester)   # semester #2 onward — this is where §4.1 (the general routine) takes over:
    counter.armed = true              # arming happens automatically once semester 2 begins evaluation
    ... (run §4.1 normally) ...
```

So concretely: a Level-1 student's semester-1 CGPA < 2.00 triggers the 16-credit half-load for semester 2, but contributes **zero** to the dismissal counter. The counter only starts counting from semester 2's outcome onward (i.e., the *earliest* a student could be dismissed is after their 7th semester of continuous sub-2.00 CGPA — semester 1 never counts, semesters 2–7 could each add one).

---
## 5. Retake Preference Gate (asked BEFORE any course list is shown)

Every planning run opens with a single yes/no question, persisted per `RetakePreference`:

> **"Would you like the plan to consider retaking courses you could improve on, to help raise your CGPA?"**

### 5.1 If YES

- All retake-eligible courses (grade `D`, `D+`, or `F` — i.e., `points < 2.30`, per `alreadyTakenNotRetakeEligible`) are added to the candidate pool exactly as in the prototype's `buildCandidates`.
- They receive the **replacement-rule weight bonus** in `scoreCandidate` (`+30 * deltaPts/3` when `deltaPts > 0`), and are further boosted if regression projects the retake will land at a grade that removes a downstream bottleneck (i.e., its `chainUnlockValue` is high — "recommend them for him in the best case that he can't get struggles for the future subjects").
- Concretely: `retakeBoost = 30 * max(deltaPts,0)/3 + 6 * min(chainUnlockValue,4)/4` when the gate is YES; the second term is what implements "retakes chosen to prevent future-course struggle," i.e., prioritize retaking courses that gate the most future courses, not just the ones with the biggest expected point gain.

### 5.2 If NO

- Retake-eligible courses with grade `D` or `D+` are **excluded entirely** from the candidate pool this run (student chose not to attempt improvement).
- **Exception — mandatory `F` grades:** any course where the student's latest grade is `F` **must** still appear, because per the handbook a course must eventually be passed to graduate. These are injected into the plan as a separate `mandatory` bucket:
  - They are **not scored/ranked** with the weighted-sum formula (no CGPA-optimization weighting applied) — they are simply required and flagged distinctly in the UI as `"Mandatory retake — required to graduate (F on record)"`.
  - They still consume credit-hour cap room, and are packed into the knapsack **first**, before the optimizer runs on the remaining (non-mandatory) candidate pool with the leftover credit capacity. This guarantees a plan is always graduation-legal even when the student declines "help me improve" retakes.

```
buildCandidates(transcript, level, retakeGate):
    all = ...same eligibility filtering as prototype (prereqs met, level allowed, not already passed well)...
    mandatory = all.filter(c => c.isRetake && c.oldGrade === 'F')
    optional  = all.filter(c => c.isRetake && c.oldGrade in ['D','D+'])
    freshCourses = all.filter(c => !c.isRetake)

    pool = retakeGate === true
             ? freshCourses ∪ optional        # mandatory handled separately, always included
             : freshCourses                    # optional retakes dropped entirely when gate = NO

    return { pool, mandatory }

packPlan(candidates, cap, mode):
    reservedCredits = Σ mandatory.credits
    mandatoryBundles = bundle(mandatory)                      # coreqs bundled, same as prototype
    remainingCap = cap - reservedCredits
    optimizedBundles = knapsack(bundle(pool), remainingCap, mode)   # unchanged §3.2 scoring
    return mandatoryBundles ∪ optimizedBundles
```

> If `reservedCredits > cap` (a student has more mandatory F-retakes than their credit cap allows, common on probation with the 14-credit cap), pack as many mandatory courses as fit, prioritized by `chainUnlockValue` (unblock the most future courses first), and flag the rest as "carried to next semester — mandatory."

---

## 6. Best-Fit Department / Faculty Engine (weighted sum, extended)

Unchanged core formula from the prototype, generalized to also run at the **faculty** level:

```
fitScore(target, student, answers):     # target = a Department OR a Faculty-level aggregate
    quizScore = Σ traitMatches(target.traits, answers) / answers.length
    gwScore   = mean(student.transcript[c].points/4 for c in target.gatewayCourseCodes if present)
                else 0.6 (neutral prior)
    alumScore = 0.5*(alumni[target].employmentRate/100) + 0.5*(alumni[target].satisfaction/5)
    total = 0.5*quizScore + 0.3*gwScore + 0.2*alumScore
    return total
```

- `recommendDepartments(student)` restricts `target` to departments within `student.facultyId` (used in §4.2's internal-transfer branch).
- `rankFacultiesByFit(student)` aggregates department-level scores per faculty (mean of top-3 departments in that faculty) plus faculty-wide alumni stats, used only in the faculty-transfer branch (§4.2, tier 3). Gateway signal here uses the university-wide "basic science" shared courses (Math, Physics, Chemistry, Intro CS) since those are what a faculty-transfer candidate will actually have grades in.
- Quiz question bank, trait tags, and alumni synthetic-stats generation carry over unchanged from the prototype (`QUIZ`, `DEPARTMENTS`, `ALUMNI`) — in production, alumni stats should be swapped for a real `AlumniOutcomes` table fed by institutional research, with the synthetic generator kept only as a seed-data fallback.

---

## 7. Transfer Execution Engine

The recommendation engine (§4.2) only ever *proposes* a transfer. A transfer is only **executed** — and only then does it affect the counter/CGPA — when the student (or advisor) confirms it through a dedicated confirmation step. This section covers what happens on confirmation.

### 7.1 Internal (intra-faculty, department-to-department) transfer

```
executeInternalTransfer(student, toDepartmentId):
    record = TransferRecord{ type:'internal_department', fromDepartmentId: student.departmentId,
                              toDepartmentId, facultyId unchanged, counterAction:'retained' }
    student.departmentId = toDepartmentId
    student.level = levelFromCredits(student.cumulativeEarnedCredits)   # unchanged — credits carry over 1:1
    # Transcript is NOT reset. Courses already passed that also exist in the new department's
    # catalog (shared faculty/school/UR courses) remain credited exactly as-is.
    # Courses that only existed in the OLD department's plan and have no equivalent in the new
    # one are marked `excessCredit = true` — they still count toward the 160-credit graduation
    # total (per handbook, credits aren't destroyed) but no longer map to a specific requirement slot.
    remapRequirementSlots(student, toDepartmentId)     # fills the new dept's curriculum-map UI
    # ProbationCounter is explicitly left untouched:
    log(ProbationCounterLog, reason='unchanged_internal_transfer')
    recomputeCgpa(student)     # recalculated over the FULL transcript, same as always — no base-snapshot reset
```

**Counter rule, stated plainly:** internal transfer changes nothing about the counter — "the transfer was internal between departments in the faculty, the warning counter remains as it is."

### 7.2 External (inter-faculty) transfer

This is the more involved path and has its own dedicated CGPA-basing mechanism.

#### 7.2.1 Identify transferable courses

```
transferableCourses(student) =
    student.transcript.passedCourses.filter(c =>
         c.course.category === 'ur_core' OR c.course.category === 'ur_elective'   # all LRAs
      OR c.course.isBasicScience === true )                                        # Math/Physics/Chem/etc.
```
Add an explicit `isBasicScience: boolean` column to `Course` (true for the shared first three semesters' Math/Physics/Chemistry/Intro-Programming courses common to every engineering program) — this is what the user calls "basic science subjects."

#### 7.2.2 Build the Transfer Semester

```
buildTransferSemester(student, toFacultyId):
    ts = Semester{ studentId, kind:'transfer_semester', termLabel: 'Transfer Semester', ordinal: next }
    courses = transferableCourses(student)
              .filter(c => equivalencyExists(c.code, toFacultyId))   # must map to a requirement in the NEW faculty
    for c in courses:
        Enrollment{ semesterId: ts.id, courseCode: c.code, pct: c.originalPct,
                    letter: c.originalLetter, points: c.originalPoints,
                    isRetake:false, countsInCgpa:true }
    ts.gpa = computeSemesterGPA(ts)          # weighted-sum over just these courses' points*credits
    return ts
```

`equivalencyExists` looks up a `CourseEquivalencyMap` table (source faculty course code → target faculty course code / "waived, counts as free elective") maintained by the registrar; courses with no equivalency are **excluded** from the Transfer Semester and simply do not carry over (still shown to the student as "did not transfer" for transparency).

#### 7.2.3 Transfer Semester GPA becomes the new base CGPA

```
executeExternalTransfer(student, toFacultyId, toDepartmentId):
    ts = buildTransferSemester(student, toFacultyId)
    snap = CgpaSnapshot{ studentId, semesterId: ts.id, semesterGpa: ts.gpa,
                          cgpa: ts.gpa, cumulativeCredits: Σts.credits, isBaseSnapshot:true }
    student.activeBaseSnapshot = snap          # ALL future computeCGPA() calls anchor here
    student.facultyId = toFacultyId
    student.departmentId = toDepartmentId
    student.level = levelFromCredits(snap.cumulativeCredits)   # usually resets to Level 1 or 2 depending on
                                                                  # how many basic-science credits transferred
    record = TransferRecord{ type:'external_faculty', fromFacultyId, toFacultyId,
                              effectiveSemesterId: ts.id, counterAction:'reset' }

    counter = getProbationCounter(student)
    counter.count = 0
    counter.armed = false                       # re-apply the "first semester" style unarmed state, §4.5,
                                                  # since the Transfer Semester's GPA==CGPA identically, just
                                                  # like a genuine first semester — it only starts arming
                                                  # from the student's next NORMAL semester in the new faculty.
    log(ProbationCounterLog, reason='reset_faculty_transfer')
```

**Stated plainly, matching the request exactly:**
- "the transfer semester ... got its GPA and become the base CGPA that would be calculated on after each semester" → `isBaseSnapshot=true` row; every later `computeCGPA` call sums only enrollments from this semester forward.
- "the warning counter in this point would be reset, as the faculty transfer makes the warning reset" → `counter.count = 0`, logged.
- Because the Transfer Semester behaves like a fresh "GPA = CGPA" starting point, it is treated with the **same unarmed rule as §4.5** — a low GPA in the Transfer Semester itself does not immediately count against the student; the counter only arms from the next real semester onward, consistent with how a brand-new Level-1 student is treated. This is a deliberate, documented extension of the user's Level-1 rule to keep the two "fresh start" mechanics consistent — flag this choice to the student/registrar during implementation review in case policy wants it stricter.

#### 7.2.4 New-department calculation after either transfer type

Both paths call the same post-transfer recompute so the student immediately sees an accurate profile:

```
recomputeAdvisingProfile(student):
    student.creditCap = creditCapFor(student)                 # may re-trigger the 16-cr half load if the
                                                                # Transfer Semester GPA < 2.00, per §7.2.3's
                                                                # "unarmed but still capped" treatment
    student.level = levelFromCredits(student.cumulativeEarnedCredits)
    nextPlan = runAdvisingCycle(student)                       # full §4.2 cycle re-run against the NEW
                                                                # department/faculty course catalog immediately
    return nextPlan
```

---
## 8. End-to-End Orchestration (one "Advise Me" run, in order)

```
1.  Load student, transcript, faculty/department catalog, active base snapshot.
2.  If student.status === 'dismissed' → short-circuit, show dismissal notice + appeal-process info. STOP.
3.  Ask retake-preference gate (§5) — blocking UI question, answer persisted.
4.  buildCandidates(...) using retake gate answer → {pool, mandatory}.
5.  packPlan(...) with mode chosen by current CGPA (fast / probation_repair / target_safe / target_fast).
6.  projectSemesterPlan → projectedCGPA.
7.  projectCGPATrend → trendSlope (needs ≥3 historical CgpaSnapshots; if fewer, treat as "insufficient
    history — default to SHOW_PLAN, flag trend as unknown" rather than guessing).
8.  Branch per §4.2 → SHOW_PLAN | RECOMMEND_INTERNAL_TRANSFER | RECOMMEND_FACULTY_TRANSFER.
9.  Render plan + (if applicable) transfer recommendation card with full explanation
    (which numbers triggered it — projectedCGPA, trendSlope, deptFit scores — always shown, never a black box).
10. If the student/advisor confirms a transfer → §7 execution → recomputeAdvisingProfile → back to step 3
    for the resulting semester in the new context.
11. On semester close (grades actually entered, not just projected) → §4.1 (or §4.5 for a genuine first
    semester, or the Transfer-Semester variant in §7.2.3) → counter update → dismissal check.
12. (§16, independent of steps 3–11 — never reads or changes the branch decision from step 8, and never
    itself asks the Venture Gate/Interest Form — see §16.1's update: those questions are only ever asked on
    the Venture Board tab now, not inline in this flow) If student.level ≥ 3 and the student has answered
    the Venture Gate YES at some point (on the Venture Board tab, §16.1): score every active,
    not-at-capacity VentureProject via ventureFitScore (§3.5); if the top score exceeds
    predictionWeights.ventureFit.matchThreshold (default 0.80), inject a Venture Match card into the same
    render pass as step 9. A student who answers NO, hasn't answered at all, or hasn't reached Level 3 skips
    this step entirely — no scoring work is done, mirroring the tier-1 SHOW_PLAN short-circuit's "don't call
    the expensive engine when its answer can't matter" principle.
```

---

## 9. System Architecture

Recommended stack (swap freely, the module boundaries below matter more than the specific framework):
**Backend:** Node.js + TypeScript, Express (or NestJS), PostgreSQL, Prisma/TypeORM.
**Frontend:** React + TypeScript, Vite, TanStack Query, a component library (or Tailwind, matching the prototype's editorial/paper aesthetic).
**Auth:** JWT session, roles `student`, `advisor`, `vice_president`, `registrar`, `admin` (§16's `VentureProject` create/edit/candidate-review capability lives on the `advisor`/`vice_president` roles — see §16.6 — not a separate `professor` role).

### 9.1 File / Directory Hierarchy

```
academic-advisor/
├── README.md
├── docker-compose.yml                     # postgres + api + web, one command up
├── .env.example
│
├── packages/
│   ├── shared/                            # types & constants shared by API and Web (npm workspace)
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── student.ts
│   │   │   │   ├── course.ts
│   │   │   │   ├── transcript.ts
│   │   │   │   ├── probation.ts
│   │   │   │   ├── transfer.ts
│   │   │   │   └── planning.ts
│   │   │   ├── grading/
│   │   │   │   ├── engScale.ts
│   │   │   │   └── urScale.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── api/
│   │   ├── src/
│   │   │   ├── server.ts                          # express bootstrap
│   │   │   ├── config/
│   │   │   │   ├── env.ts
│   │   │   │   └── predictionWeights.json          # §3.1 tunable weights, hot-reloadable
│   │   │   │
│   │   │   ├── db/
│   │   │   │   ├── prisma/
│   │   │   │   │   ├── schema.prisma               # §9.3
│   │   │   │   │   └── migrations/
│   │   │   │   └── seed/
│   │   │   │       ├── seedCatalog.ts               # loads the ECE course catalog (from prototype §3)
│   │   │   │       ├── seedDepartments.ts
│   │   │   │       ├── seedSyntheticHistory.ts       # port of prototype's mulberry32 seeded generator,
│   │   │   │       │                                 # used only when CourseOffering has <3 real rows
│   │   │   │       ├── seedDemoStudents.ts           # Ali/Mona/Omar + ALL new scenario personas, §11
│   │   │   │       └── seedVentureProjects.ts        # §16 — sample ProfessorProfile/VentureProject rows
│   │   │   │
│   │   │   ├── modules/
│   │   │   │   ├── students/
│   │   │   │   │   ├── student.controller.ts
│   │   │   │   │   ├── student.service.ts
│   │   │   │   │   ├── student.repository.ts
│   │   │   │   │   └── student.routes.ts
│   │   │   │   │
│   │   │   │   ├── courses/
│   │   │   │   │   ├── course.controller.ts
│   │   │   │   │   ├── course.service.ts             # prereq/coreq graph helpers
│   │   │   │   │   ├── course.repository.ts
│   │   │   │   │   └── course.routes.ts
│   │   │   │   │
│   │   │   │   ├── grading/
│   │   │   │   │   ├── gradeScale.ts                  # §2.1
│   │   │   │   │   ├── cgpa.ts                        # §2.2 computeCGPA (base-snapshot aware)
│   │   │   │   │   └── level.ts                       # §2.3 + §2.4 creditCapFor
│   │   │   │   │
│   │   │   │   ├── prediction/                        # §3 — the math core, framework-agnostic, unit-testable
│   │   │   │   │   ├── linearRegression.ts             # generic OLS(x[], y[]) → {a, b}
│   │   │   │   │   ├── cohortTrend.ts                  # §3.1(a)
│   │   │   │   │   ├── studentTrend.ts                 # §3.1(b)
│   │   │   │   │   ├── expectedPct.ts                  # §3.1(c) blend
│   │   │   │   │   ├── chainUnlockValue.ts              # §3.3, memoized per catalog version
│   │   │   │   │   ├── candidateScore.ts                # §3.2 scoreCandidate
│   │   │   │   │   ├── planPacker.ts                    # §3.2/§5 knapsack + mandatory-bucket reservation
│   │   │   │   │   └── cgpaTrendProjection.ts            # §3.4
│   │   │   │   │
│   │   │   │   ├── probation/                          # §4 — counter + dismissal state machine
│   │   │   │   │   ├── probationCounter.service.ts       # §4.1, §4.4
│   │   │   │   │   ├── firstSemesterRule.service.ts       # §4.5
│   │   │   │   │   ├── dismissal.service.ts
│   │   │   │   │   └── probation.routes.ts
│   │   │   │   │
│   │   │   │   ├── retakeGate/
│   │   │   │   │   ├── retakePreference.service.ts        # §5
│   │   │   │   │   └── retakeGate.routes.ts
│   │   │   │   │
│   │   │   │   ├── fitEngine/                           # §6
│   │   │   │   │   ├── quiz.ts
│   │   │   │   │   ├── departmentFit.service.ts
│   │   │   │   │   ├── facultyFit.service.ts
│   │   │   │   │   └── fitEngine.routes.ts
│   │   │   │   │
│   │   │   │   ├── transfer/                           # §7
│   │   │   │   │   ├── internalTransfer.service.ts        # §7.1
│   │   │   │   │   ├── externalTransfer.service.ts        # §7.2
│   │   │   │   │   ├── transferSemester.builder.ts         # §7.2.2
│   │   │   │   │   ├── courseEquivalency.repository.ts
│   │   │   │   │   └── transfer.routes.ts
│   │   │   │   │
│   │   │   │   ├── advising/                           # §8 — orchestrator, composes all the above
│   │   │   │   │   ├── advisingCycle.service.ts           # runAdvisingCycle()
│   │   │   │   │   ├── planningRun.repository.ts           # persists each run for audit/explainability
│   │   │   │   │   └── advising.routes.ts
│   │   │   │   │
│   │   │   │   └── venture/                            # §16 — Innovation & Venture Catalyst, independent of advising
│   │   │   │       ├── ventureGate.service.ts             # §16.1 — level≥3 check + interest-form answer capture
│   │   │   │       ├── ventureFitScore.ts                 # §3.5 — courseCompetency/skillAlignment/trajectory blend
│   │   │   │       ├── ventureProject.service.ts          # professor-side CRUD, capacity enforcement
│   │   │   │       ├── ventureMatch.service.ts             # suggested→applied→accepted/declined lifecycle
│   │   │   │       └── venture.routes.ts
│   │   │   │
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── errorHandler.ts
│   │   │   │   └── requestLogger.ts
│   │   │   │
│   │   │   └── routes/
│   │   │       └── index.ts                            # mounts every module's *.routes.ts, §9.2
│   │   │
│   │   ├── test/
│   │   │   ├── unit/
│   │   │   │   ├── prediction/*.test.ts
│   │   │   │   ├── probation/*.test.ts                  # every scenario in §11 as a test case
│   │   │   │   └── transfer/*.test.ts
│   │   │   └── integration/
│   │   │       └── advisingCycle.e2e.test.ts
│   │   └── package.json
│   │
│   └── web/
│       ├── src/
│       │   ├── main.tsx
│       │   ├── app/
│       │   │   ├── router.tsx
│       │   │   └── App.tsx
│       │   ├── pages/
│       │   │   ├── Dashboard/                            # sidebar "student file" (prototype §3, extended
│       │   │   │   │                                       with the probation counter pill)
│       │   │   ├── AdviseFlow/
│       │   │   │   ├── RetakeGateStep.tsx                 # §5 yes/no question, first screen
│       │   │   │   ├── PlanResultsStep.tsx                # course "slips" list, unchanged visual language
│       │   │   │   ├── TransferRecommendationStep.tsx      # NEW — shown only on branch 2/3 of §4.2
│       │   │   │   └── TransferConfirmStep.tsx             # NEW — internal vs external transfer confirm UI
│       │   │   ├── TargetCgpaPlanner/
│       │   │   ├── DepartmentFitQuiz/
│       │   │   ├── ProbationHistory/                       # NEW — timeline view of ProbationCounterLog
│       │   │   ├── AdvisorConsole/                          # advisor/registrar override + audit views
│       │   │   ├── VentureBoard/                            # NEW §16.5 — student-facing, level 3+ only: the
│       │   │   │   │                                          Venture Gate/Interest Form panel (§16.1, moved
│       │   │   │   │                                          here out of AdviseFlow) PLUS ranked
│       │   │   │   └── VentureProject matches, "Express Interest" on every row (not just qualifying ones)
│       │   │   └── (VentureProject create/edit/candidates now lives      # §16.6 — folded into the advisor/VP
│       │   │        in the advisor console's own Venture Board, below —    consoles directly, no separate
│       │   │        no separate FacultyConsole/role)                       professor role/route tree
│       │   ├── components/
│       │   │   ├── CourseSlip.tsx
│       │   │   ├── ProbationCounterPill.tsx                 # "3 / 6 semesters" warning badge
│       │   │   ├── CgpaTrendChart.tsx                        # renders the OLS trend line, §3.4
│       │   │   ├── TransferExplanationCard.tsx                # shows the numeric basis of a recommendation
│       │   │   └── VentureMatchCard.tsx                        # NEW §16.4 — gold-highlighted card injected into
│       │   │                                                     the Plan Results screen when score > threshold
│       │   ├── theme/                                        # NEW §9.4 — ThemeContext.tsx (localStorage-backed
│       │   │                                                    light/dark state) + ThemeToggle.tsx (shared button)
│       │   ├── api/                                          # typed fetch clients per module
│       │   └── state/
│       └── package.json
│
└── docs/
    ├── HANDBOOK_RULES.md                  # plain-language rule source-of-truth, cross-referenced to code
    └── DECISION_TREE.md                   # the §4.2/§8 flow as a diagram, kept in sync with code
```

### 9.2 API Routes

```
POST   /api/students/:id/advise                     → runAdvisingCycle (full §8 flow, idempotent per gate answer)
POST   /api/students/:id/retake-preference           → { considerRetakes: boolean }
GET    /api/students/:id/plan/fast
GET    /api/students/:id/plan/target?cgpa=3.0
GET    /api/students/:id/department-fit              → ranked list, §6
GET    /api/students/:id/faculty-fit                 → ranked list, §6 (faculty-transfer branch only)
GET    /api/students/:id/probation                   → { count, armed, history[] }
GET    /api/students/:id/cgpa-trend                  → { snapshots[], trendSlope }
POST   /api/students/:id/transfer/internal           → { toDepartmentId }         → §7.1
POST   /api/students/:id/transfer/external            → { toFacultyId, toDepartmentId } → §7.2
GET    /api/students/:id/transfer/preview             → dry-run of §7.2's Transfer Semester before committing
POST   /api/semesters/:id/close                        → triggers §4.1 / §4.5 grade-close hooks
GET    /api/courses/:code/chain                        → dependency-chain visualization data, §3.3
GET    /api/admin/prediction-weights                   → read config/predictionWeights.json
PUT    /api/admin/prediction-weights                    → update (admin/registrar only)

# §16 — Innovation & Venture Catalyst
GET    /api/students/:id/venture-gate                   → { interested: boolean | null }  → current saved answer,
                                                            read by the Venture Board tab to pre-fill the toggle
GET    /api/students/:id/venture-interest-form          → { answers }                     → current saved answers
POST   /api/students/:id/venture-gate                  → { interested: boolean }         → §16.1, level≥3 only
POST   /api/students/:id/venture-interest-form          → { answers }                     → §16.1 trait-tagged form
GET    /api/students/:id/venture-matches                → ranked VentureProject list, §3.5/§16.3 (403 if dismissed,
                                                            same lockout rule as every other student-facing route)
POST   /api/students/:id/venture-matches/:matchId/apply → { cvFileName?, cvDataUrl? } → suggested → applied,
                                                            optional CV attached in the same call, §16.4.1
                                                            (requires an already-persisted matchId; superseded for
                                                            the UI by the project-keyed route below)
POST   /api/students/:id/venture-projects/:projectId/express-interest
                                                          → { cvFileName?, cvDataUrl? } → applied, same as above but
                                                            keyed by project — works even below matchThreshold,
                                                            creating a fresh row on the spot if none exists yet
POST   /api/professors/:id/venture-projects             → create a VentureProject       (role: advisor/vice_president, §16.6)
PUT    /api/professors/:id/venture-projects/:projectId  → edit title/description/requiredCourseCodes/etc. (role: advisor/vice_president)
GET    /api/advisor/venture-projects                    → every project across every professor, with candidates+counts (role: advisor/vice_president, §16.6)
PATCH  /api/venture-matches/:matchId                    → { status: 'accepted' | 'declined' }            (role: advisor/vice_president)
```

### 9.3 Database Schema (essential tables — Prisma-style shorthand)

```prisma
model Student {
  id                String   @id @default(uuid())
  name              String
  facultyId         String
  departmentId      String
  status            StudentStatus @default(active)
  activeBaseSnapshotId String?     // §7.2.3 anchor
  semesters         Semester[]
  probationCounter  ProbationCounter?
  transferRecords   TransferRecord[]
}

enum StudentStatus { active probation dismissed transferred_internal transferred_external graduated }

model Course {
  code            String  @id
  name            String
  credits         Int
  level           Int
  category        CourseCategory
  isUR            Boolean @default(false)
  isBasicScience  Boolean @default(false)   // §7.2.1
  departmentId    String?
  prereq          String[]                  // course codes
  coreq           String[]
}
enum CourseCategory { core program faculty school ur_core ur_elective program_elective special }

model Semester {
  id          String  @id @default(uuid())
  studentId   String
  ordinal     Int
  kind        SemesterKind @default(normal)
  creditCap   Int
  isHalfLoad  Boolean @default(false)
  enrollments Enrollment[]
  cgpaSnapshot CgpaSnapshot?
}
enum SemesterKind { normal transfer_semester }

model Enrollment {
  id            String  @id @default(uuid())
  semesterId    String
  courseCode    String
  attemptNumber Int
  pct           Float
  letter        String
  points        Float
  isRetake      Boolean @default(false)
  countsInCgpa  Boolean @default(true)
}

model CgpaSnapshot {
  id                 String  @id @default(uuid())
  studentId          String
  semesterId         String
  semesterGpa        Float
  cgpa               Float
  cumulativeCredits  Int
  isBaseSnapshot     Boolean @default(false)
}

model ProbationCounter {
  id          String  @id @default(uuid())
  studentId   String  @unique
  count       Int     @default(0)
  armed       Boolean @default(false)
  logs        ProbationCounterLog[]
}

model ProbationCounterLog {
  id              String  @id @default(uuid())
  probationCounterId String
  semesterId      String
  previousCount   Int
  newCount        Int
  reason          String
  createdAt       DateTime @default(now())
}

model TransferRecord {
  id                  String  @id @default(uuid())
  studentId           String
  type                String   // internal_department | external_faculty
  fromDepartmentId    String?
  toDepartmentId      String?
  fromFacultyId       String?
  toFacultyId         String?
  effectiveSemesterId String?
  recommendationBasis Json
  counterAction       String   // retained | reset
  createdAt           DateTime @default(now())
}

model CourseEquivalencyMap {
  id             String @id @default(uuid())
  sourceCourseCode String
  targetFacultyId  String
  targetCourseCode String?    // null = waived / free elective credit only
}

model RetakePreference {
  id              String @id @default(uuid())
  studentId       String
  semesterId      String
  considerRetakes Boolean
  answeredAt      DateTime @default(now())
}

model PlanningRun {           // audit trail for every §8 orchestration call
  id             String @id @default(uuid())
  studentId      String
  input          Json    // gate answer, mode, cap
  candidates     Json
  chosenPlan     Json
  projectedCGPA  Float
  trendSlope     Float?
  action         String  // SHOW_PLAN | RECOMMEND_INTERNAL_TRANSFER | RECOMMEND_FACULTY_TRANSFER
  createdAt      DateTime @default(now())
}

// §16 — Innovation & Venture Catalyst

model ProfessorProfile {
  id                  String   @id @default(uuid())
  facultyId           String
  departmentId        String
  name                String
  researchTags        String[]
  acceptingUndergrads Boolean  @default(true)
  projects            VentureProject[]
}

model VentureProject {
  id                  String   @id @default(uuid())
  professorId         String
  title               String
  description         String
  type                VentureProjectType
  requiredCourseCodes String[]
  preferredSkills     String[]
  capacity            Int
  isActive            Boolean  @default(true)
  matches             StudentVentureMatch[]
  createdAt           DateTime @default(now())
}
enum VentureProjectType { academic_research commercial_spinoff }

model StudentVentureMatch {
  id               String   @id @default(uuid())
  studentId        String
  ventureProjectId String
  matchScore       Float    // 0-1, §3.5 ventureFitScore output
  status           VentureMatchStatus @default(suggested)
  createdAt        DateTime @default(now())
  cvFileName       String?  // §16.4.1 — optional, attached when expressing interest
  cvDataUrl        String?  // base64 data: URL — no file-storage/CDN layer in this build
}
enum VentureMatchStatus { suggested applied accepted declined }
```

### 9.4 Theming (light / dark)

Product-owner follow-up: a night mode, available to all three parties.
Client-side only — the API has no concept of a theme.

- **Tokens, not one-off colors.** Every color in `styles.css` is a CSS
  custom property (`--paper`, `--ink`, `--accent`, `--rule`, `--good`,
  `--warn`, `--danger`, plus their `-soft` tints, and a handful of
  component-specific tokens: `--masthead-bg`/`--masthead-fg`,
  `--neutral-soft`/`--neutral-fg`, `--letter-b`/`--letter-d`, and the
  `--venture-*` set for the gold match card). `:root` defines the light
  values; a `[data-theme="dark"]` block (mirrored under a
  `prefers-color-scheme: dark` media query, guarded by
  `:not([data-theme="light"])`, so an explicit choice always wins over the
  OS setting in both directions) redefines every token that should change.
  `--masthead-bg`/`--masthead-fg` and `--neutral-soft`/`--neutral-fg`
  deliberately do NOT change — the masthead reads as a fixed dark banner in
  both themes, and the neutral badge stays a low-contrast gray pairing in
  both. The one non-CSS spot that needed touching was
  `CgpaTrendChart.tsx`'s inline SVG — its `fill`/`stroke` values moved from
  raw hex literals to `style={{ fill: 'var(--token)' }}` so the chart
  follows the theme like everything else (SVG presentation attributes set
  directly, e.g. `fill="#232017"`, don't resolve CSS variables the same
  reliable way `style` does).
- **Toggle:** a single "🌙 Dark mode" / "☀️ Light mode" button, next to
  "Log out" in every masthead (advisor, student portal, Faculty Console)
  and pinned to the top-right corner of the login page (the one screen
  with no masthead). `theme/ThemeContext.tsx` — same lightweight,
  localStorage-backed pattern as `auth/AuthContext.tsx` — holds the
  current theme and toggles it; `theme/ThemeToggle.tsx` is the shared
  button component.
- **Default & persistence:** on first visit, follows the OS's
  `prefers-color-scheme` and keeps following it live if the OS setting
  changes — until the user clicks the toggle once, at which point that
  explicit choice is written to `localStorage` and wins from then on,
  every session, regardless of what the OS does. `index.html` has a small
  inline script that reads the same `localStorage` key before React mounts
  and sets `data-theme` immediately, so there's no flash of the wrong
  theme on load.

---
## 10. UI Flow (screen-by-screen)

1. **Dashboard** (sidebar "student file", kept from prototype) — now also shows a `ProbationCounterPill` ("Warning 3 / 6" in seal-red once `count > 0`, hidden/green when 0) and the base-snapshot indicator ("CGPA calculated since: Transfer Semester, Fall 2025" when `activeBaseSnapshot` is set).
2. **Advise flow entry** — the existing three action-cards (Fastest graduation / Target CGPA / Best-fit department) PLUS the flow always opens with:
3. **Retake Gate screen** — single yes/no question (§5), blocking, before any subject is shown, then straight to step 4. (The **Venture Gate**/**Venture Interest Form**, §16.1, are NOT asked here — see the Venture Board tab, §16.5, where they now live entirely.)
4. **Plan Results screen** — course "slips," unchanged visual language from the prototype, now with a distinct visual style for `mandatory` (F-retake, required) slips vs optimizer-chosen slips, a `probation_repair` mode banner when active, and — purely additive, never blocking or replacing the course slips — a gold-highlighted **Venture Match card** (§16.4) at the top when §8 step 12 found a match above threshold.
5. **Transfer Recommendation card** (new, conditional) — only rendered when `action !== 'SHOW_PLAN'`. Shows:
   - The numeric basis: current CGPA, projected CGPA under the normal plan, trend slope, in plain language ("Your CGPA is projected to stay flat even with this semester's best plan").
   - Ranked best-fit department(s) (internal branch) or faculties (external branch), each with its weighted-sum breakdown (quiz/grades/alumni or dept-fit/basic-science-grades/alumni) shown as a bar, matching the prototype's `dept-card` styling.
   - Two buttons: "See the in-major plan anyway" (fallback to step 4 as-is) and "Start transfer review."
6. **Transfer Confirm screen** — for internal: simple confirm + remapped requirement-slot preview. For external: shows the **Transfer Semester preview** (which courses transfer, which don't and why, the resulting GPA/new base CGPA) before commit, and an explicit note that the warning counter will reset.
7. **Probation History screen** (new) — timeline of `ProbationCounterLog` entries, human-readable ("Fall 2024: CGPA 1.84 → warning 1/6", "Spring 2025: CGPA 2.05 → warning reset to 0/6"), so a student can see exactly why they're at their current count.
8. **Advisor Console** (new, role-gated) — same data as the student views plus the ability to override a recommendation, review/approve transfer executions, and see every `PlanningRun` for audit.
9. **Venture Board** (new, §16.5, Level 3+ only) — every matched `VentureProject` for this student, ranked by `matchScore`, each with the same weighted-sum breakdown styling as step 5's dept-fit bars (course competency / skill alignment / academic trajectory) plus the full description and an "Express Interest" button (§16.4).
10. **Venture management** (role-gated: `advisor`/`vice_president`, §16.6 — there is no separate professor role) — every `VentureProject` across every professor in one flat list (create/edit/toggle `isActive`), and per project a ranked, auto-generated list of the most qualified opted-in undergraduates with their `matchScore` breakdown and Accept/Decline actions on each `StudentVentureMatch`.

---

## 11. Worked Example Scenarios (cover every rule in this document)

All examples assume the ECE catalog/thresholds from the prototype unless noted. Ordinals are the student's own semester count, not calendar terms.

### A — Normal good-standing student (baseline `SHOW_PLAN` case)
Ahmed, Level 3, CGPA 3.10 after semester 4. `runAdvisingCycle`: retake gate → he has no D/F courses, so the question is effectively moot (no retake candidates exist). `packPlan` mode `'fast'`. `projectedCGPA` (3.24) > `cgpa` (3.10) and `trendSlope` positive over his last 4 snapshots → **`SHOW_PLAN`**. Probation counter stays at 0/6, unarmed=false but irrelevant since it never increments (CGPA never < 2.00).

### B — Retake-eligible student, gate = YES
Mona, Level 3, CGPA 2.55, has `ECE314: D+ (66%)` and `ECE316: D+ (68%)`, and `ECE314` gates two future courses (`ECE324`, `ECE326` chain). Gate answered **YES**. `ECE314` retake gets the `chainUnlockValue` boost from §5.1 and is prioritized over `ECE316`'s retake if both can't fit the 20-credit cap. Plan shown includes `ECE314` retake tagged "Retake · +1.0 pt · unlocks 2 downstream courses." CGPA still ≥ 2.00 throughout → counter stays 0/6.

### C — Retake-eligible student, gate = NO, with one mandatory F
Karim, Level 2, CGPA 2.05, has `MTH121: D (61%)` and `PHY121: F (52%)`. Gate answered **NO**. `MTH121` (a D, not an F) is dropped from consideration entirely per §5.2. `PHY121` (F) is still force-included as a `mandatory` slip labelled "Mandatory retake — required to graduate," unscored, reserved first in the knapsack. Remaining cap is filled by the optimizer from fresh courses only.

### D — First probation semester (counter arms, no dismissal risk yet)
Omar, Level 3, CGPA drops to 1.92 at the close of semester 6 (his first time under 2.00; counter was previously 0 and armed). §4.1 fires: `count = 1`, logged `increment_low_cgpa`. `creditCapFor` now returns 14. Next `runAdvisingCycle` uses `mode='probation_repair'`. If the resulting plan projects CGPA rising back toward 2.00 with a positive trend → still `SHOW_PLAN` (a single low semester with an improving plan does not itself trigger a transfer recommendation — only a flat/declining *trend* does).

### E — Mid-window recovery (counter reset, then re-armed) — full walkthrough of §4.4
| Semester ordinal | CGPA at close | Counter before | Action | Counter after |
|---|---|---|---|---|
| 5 | 1.88 | 0 | increment | **1** |
| 6 | 1.79 | 1 | increment | **2** |
| 7 | 2.04 | 2 | **reset_recovered** | **0** |
| 8 | 1.95 | 0 | increment | **1** |
| 9 | 1.70 | 1 | increment | **2** |

Note semester 9 is counter=2, *not* 4 — the semester-7 recovery truly zeroed it, exactly per the user's rule ("start again from the semesters that become lower than 2").

### F — Dismissal case (counter reaches 6)
Nourhan, continuously below 2.00 with no recovering semester for six consecutive **armed** semesters (ordinals 3–8, having already passed her first-semester unarmed period at ordinal 1 and having semester 2 also below 2.00 but that is where arming *begins* per §4.5 — so her count actually starts at semester 2). Counter path: sem 2 → 1, sem 3 → 2, sem 4 → 3, sem 5 → 4, sem 6 → 5, sem 7 → 6 → **`status = 'dismissed'`**, `freeze(student)`, dashboard shows the dismissal notice instead of any advising flow.

### G — Level-1 first-semester half-load (the GPA=CGPA special case, §4.5)
Yara, brand-new Level-1 student, semester 1 GPA = CGPA = 1.65 (< 2.00). `onFirstSemesterClose`: counter stays **unarmed**, `count` stays **0**, logged `not_armed_first_semester`. `nextSemesterCreditCap = 16`. Semester 2 opens with a 16-credit cap and the standard advising flow (retake gate, probation_repair mode since CGPA is still < 2.00). If semester 2 closes with CGPA still < 2.00 (say 1.80), **this is the first semester that counts**: §4.1 fires normally (arming happened at the start of semester 2's evaluation window) → `count = 1`. If instead semester 2 recovers to ≥ 2.00, counter stays at 0 throughout.

### H — Flat trend inside major → internal department transfer recommended
Sara, Level 2, CGPA 2.15, been roughly flat (2.10 → 2.12 → 2.15) for 3 semesters despite reasonable plans (`trendSlope ≈ 0.01`, just under the +0.01 "improving" bar) — actually let's make it clearly flat: 2.20 → 2.14 → 2.15, `trendSlope ≈ -0.02`. `runAdvisingCycle`: `improving = false` (declining trend even though CGPA ≥ 2.00). Best-fit department engine runs restricted to her faculty; her gateway grades and quiz strongly favor **CSE** over her current **ECE**. `simulateUnderDepartment` projects an improving trend under CSE's course pool (her programming grades are consistently strong; her signals/hardware grades are what's dragging ECE down). → **`RECOMMEND_INTERNAL_TRANSFER`** to CSE, in-major plan still shown as the alternative. If she confirms: §7.1 executes — credits carry over 1:1, shared/UR courses remap, ECE-only courses become `excessCredit`, **counter untouched** (stays at whatever it was, here 0).

### I — Still below 2.00 even under the best in-faculty alternative → faculty transfer recommended
Hassan, Level 2, CGPA 1.75, flat/declining trend, and `simulateUnderDepartment` shows that **no** department within his faculty (Engineering) projects an improving trend for him — his struggles are concentrated in math/physics-heavy foundational courses common to the whole faculty, not department-specific electives. → **`RECOMMEND_FACULTY_TRANSFER`**. `rankFacultiesByFit` surfaces a Faculty of Commerce/Business Informatics as a strong quiz+alumni fit (his weak courses there are less central). Recommendation shown with full numeric basis. This also covers the user's "if the performance as the CGPA remains lower than 2 ... recommend for him to go to another faculty" branch directly off low CGPA, independent of the trend check.

### J — Guard against repeat internal-transfer looping (§4.2.1)
Continuing Sara (Example H): suppose after transferring to CSE her trend is *still* flat two semesters later. `alreadyTransferredInternallyOnce(student)` is now true, so the engine skips straight to `RECOMMEND_FACULTY_TRANSFER` rather than suggesting a third department.

### K — External (faculty) transfer execution — Transfer Semester + base CGPA reset
Continuing Hassan (Example I), he confirms the faculty transfer to Business Informatics. `transferableCourses(Hassan)` = his LRA courses + his (already passed) `MTH111`, `MTH121`, `CSE211` (basic science/programming — equivalent in the target faculty). Suppose these 4 courses total 11 credits with a computed semester GPA of 2.60. §7.2.3 executes:
- New `Semester{kind:'transfer_semester'}` created, `CgpaSnapshot{cgpa:2.60, isBaseSnapshot:true}`.
- `student.activeBaseSnapshot` = this snapshot — **all future CGPA math starts from 2.60**, his old 1.75 ECE CGPA no longer factors into any displayed CGPA (though it remains in his historical transcript for records).
- `ProbationCounter.count = 0`, `armed = false` — logged `reset_faculty_transfer`.
- His next real semester in Business Informatics is treated like a first semester for arming purposes (per the documented extension in §7.2.3): if that semester's GPA also lands < 2.00, the counter still doesn't increment yet; the semester *after that* is where arming begins, mirroring §4.5 exactly.
- `student.level` recalculated from the 11 transferred credits → Level 1 (< 36 credits) in the new faculty.

### L — Insufficient trend history (new/transfer student, safe default)
Right after Hassan's transfer (Example K), he only has 1 `CgpaSnapshot` (the Transfer Semester itself) — `projectCGPATrend` requires ≥ 3 points, so `trendSlope` is returned as `null`/"insufficient history." Per §8 step 7, the engine defaults to `SHOW_PLAN` (not a transfer recommendation) until at least 3 real snapshots exist in the new faculty — a brand-new context is never immediately flagged for a *second* transfer before it's had a fair chance.

### M — Mandatory-retake credits exceed the probation cap
Fatma, CGPA 1.60 (14-credit cap), has three `F` courses totaling 9 credits, plus prerequisite chains meaning two of them are coreq-bundled with labs (2 more credits) = 11 mandatory credits reserved, leaving only 3 credits of cap for the optimizer — likely just one small elective, or none. Per §5.2's overflow rule, if a fourth mandatory F existed and pushed reserved credits past 14, the engine would keep the three with the highest `chainUnlockValue` and flag the remainder "carried to next semester — mandatory," rather than silently dropping cap-exceeding courses.

### N — High-Value Venture Match (§16)
Mohamed, Level 3 ECE student, CGPA 3.4. His transcript shows exceptional grades in embedded systems, microcontrollers, and machine-learning electives. §8 step 3 asks the Retake Gate (moot — no D/F courses) and the plan renders — the Venture Gate never comes up in this flow at all (§16.1). Separately, on the Venture Board tab, the Venture Gate asks *"Are you actively seeking research collaboration, lab placements, or startup spin-off opportunities this semester?"* — Mohamed answers **YES** and completes the Venture Interest Form there, tagging `embedded_systems`, `machine_learning`, and `rf_communications` as his interests.

§8 step 12 fires: the engine scores every active, not-at-capacity `VentureProject` against him via `ventureFitScore` (§3.5). One professor has listed a commercial spin-off titled *"Object Detection for Small Objects in Wide Land Fields Using Injected LoRa"* (`type: commercial_spinoff`, `requiredCourseCodes: [digital communications, machine-learning elective]`, `preferredSkills: [embedded_systems, machine_learning, rf_communications]`). Mohamed's three sub-scores:
- Course Competency (40%): strong marks in both required courses → **~0.95**
- Skill/Interest Alignment (40%): all three of his stated interests AND his top-performing elective categories overlap `preferredSkills` fully → **~0.95**
- Academic Trajectory (20%): CGPA 3.4 > 3.0 and an improving `trendSlope` → **1.0**

`ventureFitScore = 0.40×0.95 + 0.40×0.95 + 0.20×1.0 = 0.96` (92% in the worked request's rounding — both comfortably clear the 0.80 display threshold). The orchestrator's step 9 render is completely unaffected in its own right — `runAdvisingCycle` still independently produces `SHOW_PLAN` with Mohamed's normal course slips (his CGPA trend already qualifies him for tier 1, §4.2) — but step 12 injects a gold-highlighted card above them: *"Venture Match: Prof. [X] is seeking hardware/software integration specialists for a LoRa object-detection startup. Click to express interest."* Clicking it moves his `StudentVentureMatch` from `suggested` to `applied` and notifies the professor (§16.4) — the advising decision, probation counter, and course plan are untouched by any of this, exactly per §16.8's independence rule.

---
## 12. Edge Cases & Validation Rules Checklist

- **Never increment the counter twice for the same semester** — `onSemesterClose` must be idempotent (guard on `semester.closedAt` / a unique constraint on `ProbationCounterLog(semesterId)`).
- **Transfer Semester is never itself subject to §4.1's increment check** — only `kind='normal'` semesters run that routine; the Transfer Semester's own arming behavior is handled entirely by §7.2.3's dedicated logic.
- **A student can be simultaneously eligible for `RECOMMEND_INTERNAL_TRANSFER` and have `count > 0`** — these are independent systems (advising recommendation vs. dismissal tracking) and must both be shown; a probation student is not blocked from also seeing a department-fit suggestion.
- **`chainUnlockValue` must be memoized per catalog version**, not recomputed per student per request — it is a property of the course graph, not the student.
- **`equivalencyExists` with no mapping** must exclude a course from the Transfer Semester silently-but-visibly (shown in the preview as "does not transfer," never a crash).
- **Half-load (16) vs probation (14) conflict**: if a Level-1 student's semester-1 GPA < 2.00 (→16-credit next cap) but by some data-entry correction their semester-2 recompute also shows CGPA < 2.00 for reasons unrelated to arming, `creditCapFor` must still resolve to a single number — precedence order is: `isFirstSemesterOfLevel1 with low GPA → 16`, else `cgpa < 2.00 → 14`, else `20`. The 16-credit rule only ever applies once, to the semester immediately following a low first semester.
- **Dismissed students** must be fully locked out of `/advise`, `/transfer/*`, and course registration endpoints at the API layer (403), not just hidden in the UI.
- **`trendSlope` insufficient-history default** must never silently recommend a transfer — always fail safe to `SHOW_PLAN` with an explicit "trend unknown" flag shown in the UI (§11 Example L).
- **Weighted-sum weights are configuration, not constants** — every formula in §3 must read from `predictionWeights.json` (with the documented defaults) so the values can be recalibrated against real outcome data without a code change.
- **Audit trail is append-only** — `ProbationCounterLog` and `PlanningRun` rows are never updated or deleted, only inserted, for FERPA/registrar-audit defensibility.
- **Rounding**: all point/credit arithmetic in CGPA math uses full float precision internally; round only at display time (2 decimals), consistent with the prototype's `Math.round(x*100)/100` pattern for CGPA and `*10)/10` for percentages.

## 13. Testing & Acceptance Criteria

Each numbered rule below must have a corresponding automated test (unit-level in `test/unit/probation/*` and `test/unit/transfer/*`), named after the rule:

1. `counter increments exactly once per sub-2.00 armed semester`
2. `counter resets to 0 the semester CGPA recovers to ≥2.00` (Example E, exact table asserted)
3. `dismissal fires at count===6, not before, not after`
4. `first semester never arms the counter regardless of GPA` (Example G)
5. `counter arms starting from semester 2 evaluation onward`
6. `half-load cap (16) applies only to the semester immediately after a low first semester`
7. `internal transfer leaves counter value and armed-state untouched` (Example H)
8. `external transfer resets counter to 0 and sets armed=false` (Example K)
9. `CGPA after external transfer is computed only from the base snapshot forward, old faculty history excluded from displayed CGPA but retained in raw transcript`
10. `retake gate = NO excludes optional D/D+ retakes but still force-includes F-grade mandatory retakes, unscored`
11. `mandatory retakes are reserved in the knapsack before the optimizer runs on the remainder`
12. `chainUnlockValue is deterministic and cached, unaffected by student-specific data`
13. `internal-transfer recommendation is always attempted before a faculty-transfer recommendation, except when already transferred internally once` (Examples H vs J)
14. `faculty-transfer is recommended directly when CGPA < 2.00 even if a trend check hasn't run yet`
15. `insufficient CGPA history (<3 snapshots) never triggers a transfer recommendation` (Example L)
16. End-to-end (`advisingCycle.e2e.test.ts`): replay every scenario in §11 A–M against a seeded test database and assert the exact `action` and counter values described.

## 14. Build Roadmap (suggested milestones for the implementing agent)

| Phase | Deliverable |
|---|---|
| 0 | Repo scaffold (`packages/shared`, `packages/api`, `packages/web`), Prisma schema from §9.3, docker-compose, migrations run clean. |
| 1 | Port grading/level/CGPA core (§2) + catalog seed data (from the prototype's `CATALOG`, `ECE_ELECTIVE_POOL`, `UR_ELECTIVE_POOLS`) — unit tests green. |
| 2 | Prediction engine (§3): OLS routine, cohort/student trend, `expectedPct`, `chainUnlockValue`, `scoreCandidate`, `planPacker` — port + extend prototype logic, unit tests green including the synthetic-history fallback generator. |
| 3 | Retake gate (§5) end-to-end: API + UI screen, mandatory-F reservation logic, tests for Examples B/C/M. |
| 4 | Probation counter engine (§4.1, §4.4, §4.5) fully isolated and unit-tested against Examples D/E/F/G *before* wiring it into the orchestrator — this is the highest-risk logic, get it bulletproof standalone first. |
| 5 | Best-fit department/faculty engine (§6), ported from prototype's quiz+alumni logic, extended to faculty-level aggregation. |
| 6 | Orchestrator (`advisingCycle.service.ts`, §8) wiring everything together with the branch logic of §4.2 — integration tests for Examples A/H/I/J. |
| 7 | Transfer execution engine (§7): internal transfer, external transfer + Transfer Semester builder + equivalency mapping, base-snapshot CGPA anchoring — tests for Examples K/L. |
| 8 | Full UI (§10): dashboard, advise flow (retake gate → plan → transfer recommendation → transfer confirm), probation history timeline, advisor console. |
| 9 | Seed realistic demo personas covering every scenario in §11 (rename/expand the prototype's Ali/Mona/Omar set), smoke-test the whole flow through the UI for each. |
| 10 | Audit/reporting: `PlanningRun` + `ProbationCounterLog` viewers in the advisor console, CSV/PDF export for registrar review. |

---
## 15. Student Portal, Best-Case Projection, Dual-Approval Registration & Advisor Reporting

**Status note (added post-hand-off, build session 7):** §§1–14 above are the
original specification and were implemented first. This section is a
same-status extension requested directly by the product owner after the
first working build was demoed: a role-restricted student-facing view, a
"how good could this realistically get" projection alongside the existing
realistic one, a two-sided (advisor + student) approval gate before a
recommended course becomes a real registration, and a PDF roster report for
the advisor. Every rule below is as binding as §§1–14; where a judgment call
was needed to turn a plain-English request into an exact mechanism, it is
called out explicitly, the same way §7.2.3's Transfer-Semester-arming
extension was flagged in the original document.

### 15.1 Student Portal — same engine, restricted view

The student gets their own view of their own file — not a second
implementation of the advising engine, the *same* `runAdvisingCycle`/§3/§6
pipeline the advisor's screens already call, rendered through a stricter
component layer.

**The one hard rule:** a student view must never render a raw percentage —
not in the transcript, not in `expectedPct`, not in cohort/trend figures,
not anywhere. Only the letter grade (`expectedLetter`, transcript `letter`)
and CGPA (already a 0.00–4.00 aggregate, not a percentage) are shown. The
advisor's views are unchanged and keep showing percentages exactly as
before — this is a rendering-layer restriction, not a change to what the
engine computes or stores; the API still returns `expectedPct` in every
payload, the student-portal *components* simply never display that field.

Screens (mirrors §10's screen list, restricted to the signed-in student,
no roster of other students):
1. **Grades & Trend** — transcript (letters only) + the same §3.4 CGPA
   trend chart (already CGPA-only, needs no changes).
2. **Advise Me** — the same retake-gate → plan flow as §10 steps 3–4, with
   `expectedPct` hidden and the new §15.2 best-case figure shown alongside
   the letter.
3. **Target CGPA** and **Best-Fit Quiz** — unchanged from §10, reused as-is
   (the quiz never showed percentages; the target planner's letters-only
   variant hides its one `%` column).
4. **My Recommendations** (new) — the §15.3 dual-approval chooser.

**Judgment call, flagged, superseded by direct instruction (build session
8):** this build still has no real login system (§9's roles are a demo
header, not JWT sessions) — but per explicit product-owner instruction, the
two parties must be unable to reach each other's pages at all, not merely
lack a link to do so. §15.1 originally shipped a "switch demo student"
selector inside the portal and a same-app "view as student"/"advisor view"
cross-link; both are now REMOVED. In their place: a demo sign-in screen
(`/login` — "Sign in as Advisor" or "Sign in as [student name]", no
password, `packages/web/src/pages/Login/Login.tsx`) writes a session
(`{ role: 'advisor' }` or `{ role: 'student', studentId }`) to
`localStorage` (`packages/web/src/auth/AuthContext.tsx`), and every route is
wrapped in a guard (`packages/web/src/auth/RequireRole.tsx`) that redirects
away — not just hides a link — the instant a session tries to reach a page
outside its party: an advisor session hitting `/portal/*` bounces to their
own view; a student session hitting `/students/*` or `/advisor-console`, OR
another student's `/portal/:id`, bounces back to their own portal. The
percentage-hiding rendering restriction from the paragraph above is
unaffected by this change — it was already real and stays real.

### 15.2 Best-Case ("peak performance") Grade Projection

Every course already carries an `expectedPct`/`expectedLetter` — §3.1's
realistic, regression-based projection. This section adds a second,
optimistic figure alongside it, computed the same way in both the advisor
view (shown as a percentage) and the student portal (shown as a letter
only):

```
bestCasePct(course, student):
  comparable = student's transcript rows in the same UR-vs-non-UR category
               bucket as `course` (identical comparability rule to §3.1(b)'s
               studentTrendPct)
  if comparable is non-empty:
      return max(r.pct for r in comparable)          # the student's own best-ever result in a like-for-like course
  else if student.transcript is non-empty:
      return max(r.pct for r in student.transcript)   # fall back to their single best result overall
  else:
      return expectedPct(course, student)             # brand-new student, nothing to be "optimistic" relative to
```

This is deliberately **not** a regression or a trend — it is literally "the
best you personally have ever actually done in a course like this," turned
into a letter/points via the normal grade scale (§2.1), so the number is
always something the student has proven they can achieve, not a
statistical extrapolation.

**CGPA impact, shown alongside the letter (both views):** for the plan (or
a single swapped course), compute two projected CGPAs using the *existing*
§2.2 `computeCGPA` machinery — once with each course at its `expectedPoints`
(today's behavior, unchanged), once with each course at its `bestCasePoints`
— and show both, e.g. *"Expected: 2.15 → 2.30. At your best: 2.15 → 2.61."*
This is what "how it would affect his CGPA and make it better for him"
means concretely: two real `computeCGPA` runs over the same transcript, not
a hand-wavy estimate.

### 15.3 Course Proposal & Dual-Approval Registration Workflow

**Scope boundary, flagged:** mandatory F-grade retakes (§5.2) are *not*
part of this workflow — they are compulsory regardless of anyone's
approval, exactly as §5 already specifies, and are excluded from
`generateProposals` below. This workflow governs only the optimizer-chosen
(optional) part of a plan — the part where "which of several reasonable
courses" is actually a judgment call worth a human sign-off.

#### 15.3.1 Domain

| Entity | Key fields | Notes |
|---|---|---|
| **CourseProposal** | `id`, `studentId`, `slotKey`, `courseCode`, `origin` (`system`\|`advisor`), `replacesCourseCode` (set only when `origin='advisor'`), `expectedPct/Letter/Points`, `bestCasePct/Letter/Points`, `advisorApproved` (bool), `status` (`pending`\|`advisor_approved`\|`registered`\|`declined`), `createdAt` | One row per candidate course per "slot." |
| **RegisteredCourse** | `studentId`, `courseCode`, `semesterOrdinal`, `proposalId` | "Signed up for, not yet graded" — deliberately a *different* table from `EnrollmentRecord` (§1.1), which represents a completed, graded attempt. Registering a course never touches CGPA; a real grade only lands in the transcript later via the existing `recordEnrollment`/semester-close path (§4.1). |

A **slot** is identified by the system's original recommended course code
for that position in the plan. The advisor may add at most one alternate
proposal per slot (a second `CourseProposal` row, `origin='advisor'`,
`replacesCourseCode` pointing at the system's course code) — the student
then sees up to two options for that slot side by side.

#### 15.3.2 Lifecycle

```
1. generateProposals(studentId):
     plan = runAdvisingCycle(student, ports).plan   # §4.2/§8, unchanged
     optional = plan.filter(c => !c.mandatory)
     for c in optional:
         CourseProposal{ slotKey: c.courseCode, courseCode: c.courseCode,
                          origin: 'system', expectedPct: c.expectedPct,
                          bestCasePct: bestCasePct(c, student),           # §15.2
                          advisorApproved: false, status: 'pending' }

2. Advisor review (per slot, in the Advisor Console):
   a) approveAsIs(proposalId)     → advisorApproved = true, status = 'advisor_approved'
   b) proposeAlternate(slotKey, altCourseCode):
        # the SAME §3.1 scoring pipeline the system used, run on-demand for
        # the advisor's chosen course, so the advisor sees its real expected
        # + best-case grade BEFORE confirming — never a guess.
        scored = ports.scoreEligibleCourse(student, altCourseCode)
        CourseProposal{ slotKey, courseCode: altCourseCode, origin: 'advisor',
                         replacesCourseCode: slotKey, expectedPct: scored.expectedPct,
                         bestCasePct: bestCasePct(altCourseCode, student),
                         advisorApproved: true,        # the advisor authored it — self-approved
                         status: 'advisor_approved' }
   c) decline(proposalId) → status = 'declined' (removed from the student's options for that slot)

3. Student portal, "My Recommendations" (per slot):
     options = proposals where slotKey = this slot AND status != 'declined'
     show each option's course, expected letter, best-case letter (§15.1's
     letters-only rule), and whether it is advisor-approved
     student picks ONE option -> chooseProposal(studentId, proposalId):
         if proposal.advisorApproved:
             proposal.status = 'registered'
             RegisteredCourse{ studentId, courseCode: proposal.courseCode,
                                semesterOrdinal: <student's next ordinal>, proposalId }
             return { registered: true }
         else:
             # the student picked an option the advisor has not signed off
             # on for this slot (commonly: the plain system suggestion, when
             # the advisor either hasn't reviewed yet or only approved their
             # own alternate) — nothing is registered.
             return { registered: false, requiresAdvisorContact: true }
```

**Stated plainly, matching the request exactly:**
- "if the academic advisor saw the subjects recommendation and approved it
  and then it got into the student as well with approval" → step 2(a)/2(b)
  flips `advisorApproved`/`status`, which is immediately visible to the
  student's `GET /proposals` read in step 3 — no separate sync step needed,
  both sides read the same `CourseProposal` rows.
- "the subjects would be added to the system as the registered subjects
  automatically" → `chooseProposal` on an already advisor-approved option
  transitions straight to `registered` and writes a `RegisteredCourse` row
  in the same call — no third confirmation step.
- "the professor... modify the recommended subjects and choose another
  subject... the model calculate its expected points and take it as
  feedback" → step 2(b): the alternate's expected/best-case points are
  computed by the real engine at proposal time, not typed in by the
  advisor, so the advisor is choosing based on real projected impact.
- "view in the student portal the two recommendations of the system and
  the professor" → step 3's `options` list — both rows for the same
  `slotKey`, always shown together when both exist.
- "if the student choose the system option not the professor option it
  would show pop up... to contact the advisor" → the `requiresAdvisorContact`
  branch in step 3; the **general** rule implemented is "picking a
  not-yet-advisor-approved option always prompts contact-your-advisor,"
  which also correctly covers the case where the advisor has not reviewed
  the slot at all yet (no alternate exists, no explicit approval either) —
  a plain system suggestion is never silently auto-registered without a
  human advisor decision.

### 15.4 Advisor PDF Report

A **"Generate Report"** button in the Advisor Console produces a PDF
(generated client-side — no new backend runtime dependency, matching this
build's existing "in-memory demo, real math" philosophy) listing every
student under advisement with three counts per student, driven by a new
read-only aggregate route:

```
GET /api/advisor/report →
  [{ studentId, name, cgpa, probationCounter,
     pendingCount,          # CourseProposal.status === 'pending'
     advisorApprovedCount,  # status === 'advisor_approved' (approved, awaiting the student)
     registeredCount        # status === 'registered' }]
```

This directly answers "students under his supervision and whose subjects
is approved, and registered, still not registered yet" as three explicit
columns rather than a single ambiguous status.

### 15.5 API routes (extends §9.2)

```
POST   /api/students/:id/proposals/generate                    → §15.3.2 step 1
GET    /api/students/:id/proposals                              → grouped by slotKey, includes §15.2 best-case fields
POST   /api/advisor/proposals/:proposalId/approve                → §15.3.2 step 2(a)
POST   /api/advisor/proposals/:proposalId/decline                 → §15.3.2 step 2(c)
POST   /api/advisor/students/:id/proposals/:slotKey/alternate      → §15.3.2 step 2(b), body { courseCode }
POST   /api/students/:id/proposals/:proposalId/choose                → §15.3.2 step 3
GET    /api/students/:id/registered-courses                           → RegisteredCourse rows for the student's dashboard
GET    /api/advisor/report                                             → §15.4
```

### 15.6 Worked example (extends §11's style)

**Sara** (§11 Example H) is planning a semester; the system's optional pool
recommends `ECE314` among others (`expectedPct` 71, best-case 92 — her own
best-ever comparable-category result). Her advisor reviews the slot and,
believing `ECE322` suits her programming strengths better, proposes it as
an alternate: the engine scores `ECE322` for her on the spot
(`expectedPct` 84, best-case 95) and the advisor confirms — that proposal
is immediately `advisor_approved`. Sara opens **My Recommendations** and
sees both `ECE314` (system, not advisor-approved) and `ECE322` (advisor,
approved) side by side, letters only (`C`/`B+`... vs `B`/`A-`). If she
picks `ECE314`, a popup tells her to contact her advisor before it can be
registered — nothing changes server-side. She picks `ECE322` instead: it
flips to `registered`, a `RegisteredCourse` row is written, and her
advisor's next PDF report shows her `registeredCount` incremented by one.

---
## 16. Innovation & Venture Catalyst

**Status note:** requested directly by the product owner as a new major
subsystem, same binding status as every other section. It turns the system
from a purely graduation-focused tool into an active networking hub,
mapping a student's academic strengths, coursework, and stated interests
directly to professors' active research projects and commercial
spin-offs. It is **strictly additive**: nothing in §§1–15 changes behavior,
and every rule below is designed so that a student who never engages with
this feature experiences literally zero difference from the system
described in §§1–15 (§16.8 makes this explicit).

### 16.1 The Venture Gate

A secondary, **optional** preference, deliberately kept OUT of the "Advise
Me" wizard (product-owner follow-up — an earlier revision of this section
asked it inline, right after the Retake Gate; it was moved because these
two questions determine venture-project matching, not the course
recommendation, and living inside "Advise Me" made that boundary easy to
misread). It now lives entirely on its own — the **Venture Board tab**
(§16.5) — as a small "Your venture preferences" panel at the top of that
screen:

- **Trigger:** only shown to students at Level 3 or higher (`student.level
  >= 3`). Level 1–2 students never see it, on the Venture Board or
  anywhere else — not hidden-but-present, simply never rendered, never
  scored, no wasted engine work (§16.8).
- **Question, re-answerable at any time** (visiting the Venture Board tab
  shows the currently saved answer, highlighted, not a blank re-ask):
  *"Are you actively seeking research collaboration, lab placements, or
  startup spin-off opportunities this semester?"*
- **If NO (or never answered):** nothing renders below it except a short
  explanation — no ranked list, no scoring work — and, independently, "Advise
  Me" (§8 steps 3–11) proceeds exactly as it already does; this gate's
  answer is never read by the branch decision in §4.2, and asking/answering
  it never touches course recommendation in either direction.
- **If YES:** the **Venture Interest Form** renders in the same panel,
  below the toggle — a short multiple-choice form, structurally identical
  to §6's best-fit quiz (`QuizQuestion`/`QuizOption` with `traitTags[]`),
  asking about technical interest areas (e.g. *machine learning, circuit
  design, embedded systems, RF/communications, data science, robotics,
  commercialization/business*), pre-filled with any previously saved
  answers and editable/re-savable at any time. The answers are captured and
  stored the same way §6's quiz answers already are (one blob keyed by
  question id) — **not** a new persisted entity; §1.1/§9.3 deliberately
  don't add a table for this, to avoid duplicating a pattern the system
  already has. These answers are what `skillAlignmentScore` (§3.5b) reads
  as `student.ventureInterestAnswers`. Saving either the gate or the form
  immediately re-fetches the ranked project list below, so the effect of a
  changed answer is visible without leaving the tab.
- **§8 step 12's card injection** (the gold card on the Plan Results
  screen, both advisor and student) reads whatever the gate/form currently
  hold, wherever and whenever they were last answered — it has no idea
  they now live on a different tab, and needed no change.

### 16.2 Domain model

See §1.1 for the three new entities (`ProfessorProfile`, `VentureProject`,
`StudentVentureMatch`) and §9.3 for their Prisma shape. Two lifecycle notes
that don't fit a table cell:

- **`VentureProject.capacity`** is enforced at match time, not at read
  time: a project with `acceptedMatchCount >= capacity` is excluded from
  *new* `ventureFitScore` runs (§16.8) but existing `accepted` matches are
  never retroactively touched.
- **`StudentVentureMatch.status`** only ever moves forward:
  `suggested → applied → accepted | declined`. A `suggested` match is
  never persisted at all below the display threshold (§16.3) — it's cheap
  to recompute per request, so there's no reason to store noise a student
  never saw.

### 16.3 The Matching Engine

The formula itself (`ventureFitScore`) is specified in **§3.5**, alongside
the rest of the prediction engine — kept there, not here, so §3 stays the
single place every WS/LR formula in the system lives (matching how §6's
`fitScore` isn't re-derived in the department-transfer sections that use
it, either).

**The threshold rule:** a `VentureProject` is only surfaced as a
gold-highlighted card (§16.4) when `ventureFitScore >= predictionWeights
.ventureFit.matchThreshold` (default **0.80**, i.e. the ">80%" from the
request) — configuration, not a hard-coded constant, per §12's existing
rule for every other weighted-sum formula. Below threshold, a project can
still appear in the full ranked list on the **Venture Board** (§16.5,
step 10 of §10) — the 0.80 bar gates the *compact card injected into the
Plan Results screen*, not visibility into the ranked list itself.

### 16.4 Output: the Venture Match card

When §8 step 12 finds a score ≥ threshold, the **highest-scoring** project
only is injected as a card at the top of the Plan Results screen (§10 step
4) — gold-highlighted, visually distinct from both `mandatory` and
optimizer-chosen course slips, and never counted toward the credit cap or
the knapsack (§3.2/§5.2) in any way; it is not a course. The card shows the
project title, a one-line description, **which professor is hosting it**
(`VentureProject.professorId` resolved to a name at the API boundary — see
§16.4.1), and one action: **"Express Interest"**, which calls
`POST /venture-projects/:projectId/express-interest` (§9.2 — keyed by
project, not `matchId`, so it works uniformly whether or not a `suggested`
row already exists; see the note at the end of §16.5), flips the match's
status to `applied`, and notifies the professor (out of scope for this
document how the notification is delivered — email/in-app, an
implementation detail). Dismissing the card does not change match status —
it can still be found later on the Venture Board.

#### 16.4.1 CV attachment (extends "Express Interest")

Expressing interest optionally attaches a CV **in the same action** — a
file picker sits next to the "Express Interest" button, restricted to
`.pdf` (so the inline viewer below always has something it can render — a
resume in `.doc`/`.docx` would just download to the professor's machine
instead, defeating the point). If a file is selected it's read client-side
into a `data:` URL (no file-storage/CDN layer in this build — the CV lives
directly on the `StudentVentureMatch` row, `cvFileName`/`cvDataUrl`, same
"small, honest stand-in" philosophy as the rest of the in-memory store) and
sent in the same `apply` call. A CV is never required — clicking "Express
Interest" with nothing selected still fully counts as expressing interest;
the button label changes ("Express Interest" vs. "Express Interest & Submit
CV") purely as a confirmation of what will be sent. The professor's ranked
candidate list (§16.6) shows a **"View CV" button** for any candidate who
attached one, and "none" for candidates who haven't — clicking it opens an
in-page modal with the PDF rendered inline via an `<iframe src={dataUrl}>`
(the browser's own PDF viewer, no download prompt, no new tab, no separate
file-hosting layer) — reviewing the CV without ever leaving the Faculty
Console is what lets a professor judge genuine interest and fit beyond the
numeric score alone, per the request this section was added for.

### 16.5 Venture Board (student-facing screen, §10 step 9)

This tab is now the Venture Gate/Interest Form's only home (§16.1) — a
"Your venture preferences" panel sits at the top, the toggle and quiz form
described there, with the ranked list below it.

Unlike the single compact card, the ranked list shows **every** matched
project for this student (any `VentureProject` the student has a computed
score for, not just the ≥0.80 ones), ranked by `matchScore`, each rendered
with the same weighted-sum breakdown-bar styling §6's dept-fit cards
already use (course competency / skill alignment / academic trajectory as
three labeled segments), full description, **the hosting professor's
name**, and its own "Express Interest" action (§16.4.1's CV attachment
applies here too — every "Express Interest" entry point in the UI is the
same underlying action). Only ever reachable by Level 3+ students who've
answered the Venture Gate at least once (§16.1) — a Level 1–2 student, or a
Level 3+ student who's never answered YES, sees an empty state explaining
why, never a confusing blank ranked list.

**Express Interest is offered on every row, not only qualifying ones**
(product-owner follow-up): a project scoring below `matchThreshold` has no
persisted `StudentVentureMatch` yet (`matchId: null`, `status: "unscored"`
on the wire) — clicking "Express Interest" on it still works, going
straight to a fresh `applied` row (`applyToVentureProject`/
`POST /venture-projects/:projectId/express-interest`, §9.2) rather than
passing through `suggested` first (there's nothing left to suggest — the
student already decided). A project the student has already acted on
(`applied`/`accepted`/`declined`) shows its status badge instead of the
button. This does NOT change what the automatic §8 step 12 pass persists
or surfaces as the gold card — that's still threshold-gated, per §16.2 —
it only changes what an explicit student click is allowed to do.

**Demo fixture note:** EVERY seeded Level 3+, non-dismissed student —
Mohamed included — has a pre-answered Venture Gate (YES) + Interest Form
baked into the seed data (product-owner follow-up: "build the Venture
Board for all the students in the system"), so this screen — and every
project's candidate list on the Faculty Console side — is populated for
the whole eligible cohort without anyone having to click through "Advise
Me" or the Venture Board's own preferences panel first. Scores still vary
honestly by transcript (most of the probation-ladder personas score low
and never clear the display threshold, which is realistic, not a bug).
Ahmed's transcript was extended with two Semester 7 electives so he's a
second persona who genuinely clears the 0.80 threshold alongside Mohamed —
two independent full express-interest/CV demos. The preferences panel
itself is still fully editable regardless — pre-seeded is a starting
state, not a lock. Two groups are still deliberately excluded from the
pre-seed, both real business rules rather than a leftover "keep a demo
subject blank" exception (that exception was retired this round): Level
1–2 students never see the Venture Gate at all (§16.1/§16.8), and a
dismissed student (`nourhan-1`) is 403'd from every self-service route,
venture matching included, regardless of any stored answer.

### 16.6 Advisor & Vice President venture management (role: `advisor`/`vice_president` — REPLACES the old Faculty Console/`professor` role)

There is no separate professor login or Faculty Console anymore. Every
professor at E-JUST is already also an advisor, and posting/managing
`VentureProject`s was folded directly into the advisor console's own
Venture Board (and, per §17.2, the Vice President's) instead of living
behind a third, narrower role that duplicated the same capability:

- **Post/edit `VentureProject`s** — title, description, `type`,
  `requiredCourseCodes[]`, `preferredSkills[]`, `capacity`, an `isActive`
  toggle (an inactive project is immediately excluded from all new
  matching, §16.8), and the §17.5 research-portal fields. The advisor
  console attributes every project it creates to a fixed `'advisor-owned'`
  identity (not the logged-in advisor's own id) since ventures are managed
  collectively, not per-advisor; the Vice President's own Venture Board
  works identically, attributed to `'vp-owned'`.
- **A flat, cross-project view** — `GET /api/advisor/venture-projects`
  returns every `VentureProject` across every professor/advisor/VP in one
  shot, each still carrying its real owning `professorId`, so the console
  is "every venture in the system," not a single professor's own list.
- **Ranked candidate list per project + Accept/Decline** — same
  `ventureFitScore`/`matchScore` computation the student-facing routes
  use, same capacity enforcement (§16.2), same CV inline-preview
  (§16.4.1), now surfaced inside the flat project list above instead of a
  separate per-professor "my candidates" screen.
- **Two originally-seeded real professors** (`prof-kamel`/`prof-adel`)
  still exist purely as attribution data on their own pre-existing
  projects — "Hosted by Dr. Youssef Kamel" still renders correctly on a
  student's Venture Board — but there is no login and no route reachable
  as either of them anymore.

### 16.7 API routes

See §9.2's "§16 — Innovation & Venture Catalyst" block for the full route
list (student-facing gate/form/matches/apply; project create/edit and
match accept/decline, callable by the advisor/VP consoles above using
`'advisor-owned'`/`'vp-owned'` in place of a professor's own id).

### 16.8 Edge cases & independence rules (extends §12)

- **Level < 3 → the gate is never asked, never scored, and costs nothing.**
  Not a UI hide — `runAdvisingCycle`'s step 12 short-circuits before
  calling `ventureFitScore` at all, the same "don't call the expensive
  engine when its answer can't matter" principle tier-1 `SHOW_PLAN` already
  uses for the fit engine (§4.2's own optimization, noted in its service
  file).
- **A NO answer, or never answering, is indistinguishable from Level < 3**
  from the branch decision's point of view — in both cases step 12 does
  nothing and step 8's `action` (`SHOW_PLAN`/`RECOMMEND_INTERNAL_TRANSFER`/
  `RECOMMEND_FACULTY_TRANSFER`) is computed with zero awareness this
  feature exists.
- **Fully independent of probation/dismissal/transfer state** — a
  student's warning counter, dismissal status (aside from the standard
  403-when-dismissed lockout every student-facing route already has, §12),
  or an in-flight transfer recommendation never affects `ventureFitScore`
  or which projects are shown. The one exception, consistent with every
  other student-facing route: **a dismissed student's `/venture-matches`
  call still 403s** — dismissal is a full lockout, not feature-specific.
- **`isActive=false` or `capacity` reached → excluded from new matching**,
  never merely hidden after being scored — a full-project card should
  never be shown and then reveal itself unavailable on click.
- **`requiredCourseCodes` a student has never taken score 0 for that
  course**, not `null` and not excluded from the average — see §3.5a's
  exact wording; a project asking for courses entirely outside a student's
  history should score low, not crash or silently ignore that term.
- **All three sub-weights and the 0.80 display threshold are configuration**
  (`predictionWeights.json`'s `ventureFit` block), per §12's existing rule.
- **There is no `professor` role at all** (§16.6) — `VentureProject`
  create/edit/candidate-review is reachable only via the `advisor`/
  `vice_president` roles, which already have (and are meant to have) full
  student-record access — so this section's old "professor can't see
  `/students/*`" boundary rule no longer applies to anything; it's listed
  here as a removed rule, not a currently-enforced one.

## 17. AEGIS Rebrand, Multi-Advisor Model & Vice President Oversight

The system was rebuilt around a more realistic, hierarchical advising
structure — a single shared advisor account became 5 real advisor
identities, and a new Vice President role oversees all of them — plus a
new accountability workflow for advisor course overrides and a 3-stage
transfer approval chain. Rebranded as **AEGIS**; "E-JUST" remains the real
institution name (still used throughout `@ejust.edu.eg` emails and
existing docs), now shown as the subtitle beneath the primary "AEGIS"
product name.

### 17.1 Multi-Advisor Model

| Entity | Key fields | Notes |
|---|---|---|
| **Advisor** | `id`, `name`, `facultyId`, `departmentId` | 5 seeded advisors, each with exactly 25 students. |
| **Student** (extended) | `advisorId` | Every student, named or generated, belongs to exactly one advisor. |

The 13 hand-authored named personas from §11's worked examples keep every
field untouched and are distributed ~2-3 per advisor; the remaining ~112
students per the 25-per-advisor target are deterministically generated
(same `fillerHash`-seeded, never `Math.random`, approach the rest of this
build already uses) with a realistic spread of standings (strong/good/
average/at-risk/probation), reusing the existing `completeTranscript()`
gap-filler unchanged — each generated student needs only one anchor
attempt at a standing-appropriate percentage.

**Roster scoping** is real server-side filtering, not just a UI
narrowing: `GET /api/students` and `GET /api/advisor/report` both accept
an optional `?advisorId=` query param. The advisor console's own URLs are
unchanged from the single-advisor era (`/`, `/students`, etc.) — the
logged-in advisor's identity comes from the client's auth session state,
never a URL segment; a defense-in-depth check on the per-student advisor
pages redirects away if a typed-in student id belongs to a different
advisor's roster (§17.7's security note covers this in more depth).

### 17.2 Vice President Role

A single global account (no per-id identity, same shape the old
single-advisor account used to have) overseeing all 5 advisors:

- **Dashboard**: per-advisor summary (roster size, real average CGPA,
  computed server-side) with drill-down into any one advisor's full
  roster, **and** a flat, cross-advisor pending-approvals queue of every
  student's still-pending system proposal — both access models at once,
  not an either/or (confirmed against the request: "advisor-level
  aggregate data... but also have a button to directly approve a
  student's plan even if the student's own advisor hasn't approved it
  yet"). Approving from this queue calls the exact same
  `POST /api/advisor/proposals/:id/approve` route the advisor console
  uses — no separate VP-only approval logic, no role restriction on that
  route.
- **Transfer requests**: the advisor-approved queue awaiting final VP
  sign-off (§17.4), plus per-advisor in-flight counters (internal vs.
  external) on the dashboard.
- **Venture Board**: full parity with the advisor console's own Venture
  Board (create/manage projects, review candidates) — new projects are
  attributed to a `'vp-owned'` anchor identity ("Office of the Vice
  President"), mirroring the existing `'advisor-owned'` anchor the
  advisor console's own postings already used.
- **Advisor Oversight PDF report**: one click on the dashboard exports a
  PDF — one row per advisor (department, roster size, average CGPA) —
  mirroring the advisor's own §15.4/§17.3 roster report one level up: an
  advisor's row is highlighted whenever any student on their roster has
  a live §17.3 responsibility flag, with a footnote naming which
  student(s), so oversight isn't limited to reading numbers off a screen.

### 17.3 Advisor Responsibility Workflow

When an advisor proposes an alternate course for a slot (§15.3.2 step
2(b)) whose expected grade is **not strictly better** than the system's
own recommendation for that slot (a tie or a decrease), the advisor must
explicitly acknowledge responsibility before the alternate is created:

```
proposeAlternate(slotKey, altCourseCode, acknowledgedByAdvisorName?):
  scored = <same live scoring as §15.3.2 step 2(b), unchanged>
  belowOrEqualSystemGrade = scored.expectedPoints <= system[slotKey].expectedPoints
  if belowOrEqualSystemGrade and not acknowledgedByAdvisorName?.trim():
      reject 400 — "type your name to confirm you're taking responsibility"
  CourseProposal{ ..., belowOrEqualSystemGrade, acknowledgedByAdvisorName }
```

The advisor console shows a confirmation modal (course comparison, full
responsibility/retake-liability text, a name input, OK disabled until
non-blank) exactly when this condition is hit; a strictly-better
alternate is unaffected and proceeds exactly as §15.3.2 already
specified. Once such a course is **registered** (§15.3.2 step 3), both
the advisor's and the student's own proposal views offer a
"Download responsibility letter" button — a PDF (jsPDF, client-side, the
AEGIS logo, "My dear student {name}", "I am your advisor, Prof.
{name}", full text naming both course codes and the grade effect, full
retake-liability language, and "Advisor Signature: {typed name}").

The advisor's §15.4 PDF roster report highlights, in a distinct color,
every row for a student with a **live** (non-declined) advisor proposal
matching this condition, with a legend/footnote at the bottom naming the
affected students. The Vice President's per-advisor drill-down surfaces
the same flag for advisor-level oversight.

### 17.4 Transfer Pending Chain

§7's transfer execution (`executeInternalTransferForStudent`/
`executeExternalTransferForStudent`) is **unchanged** — it is now only
ever invoked from the very last step of a 3-stage approval chain instead
of directly from the student's "Confirm transfer" click:

```
TransferRequest{ id, studentId, advisorId, type, toFacultyId?,
                  toDepartmentId, status, createdAt,
                  advisorDecidedAt?, vpDecidedAt?, declineReason? }

status: pending_advisor -> pending_vp -> approved      (advisor then VP both approve)
                        -> advisor_declined              (advisor declines — chain ends)
                    pending_vp -> vp_declined            (VP declines — chain ends)
```

1. Student clicks "Request transfer" (internal or external, both types
   unified into one chain) → `pending_advisor`. Nothing on the student's
   record changes yet.
2. The student's advisor sees it in a "Transfer requests" queue; approve
   → `pending_vp` (still nothing executes); decline → `advisor_declined`,
   chain ends.
3. The Vice President sees advisor-approved requests in their own
   "Transfer requests" queue (visible to student, advisor, and VP
   throughout — not just at the final stage); approve → the existing
   execute\* function actually runs, `status = 'approved'`; decline →
   `vp_declined`, chain ends, nothing executes.

The VP dashboard's per-advisor counters count only requests still
`pending_advisor` or `pending_vp` ("in flight"), split internal vs.
external.

### 17.5 Venture Board Research Fields ("Research Portal")

`VentureProject` gains 5 optional fields so the Venture Board can surface
real published research alongside plain open positions — a project with
none of them behaves exactly as before this section:

```
authors?: { name, link? }[]
publishedPaperUrl?: string
conferenceName?: string
impactFactor?: number
labName?: string
```

Both the advisor console's and the Faculty Console's own create-project
forms gained the same 5 optional inputs (independently duplicated,
matching how `requiredCourseCodes`/`preferredSkills` are already
duplicated between the two forms); the Vice President's Venture Board
reuses the advisor console's create form with a different attribution
anchor (§17.2). Wherever a project renders (student-facing card, advisor/
VP "manage all ventures" list, Faculty Console's own list), whichever of
these 5 fields are actually present render in a themed "Published
research" panel.

### 17.6 CGPA Color-Key Legend

Every CGPA trend chart (student dashboard, advisor per-student Overview,
and any future reuse) shows a legend below the bars: green = good
standing (≥ 3.00), yellow = at-risk (2.00–2.99), red = probation
(< 2.00) — the same thresholds the bars themselves already used, now
made explicit rather than left to be inferred from color alone.

### 17.7 API routes (extends §9.2/§15.5/§16.7)

```
GET    /api/advisors                                              → the 5 advisors
GET    /api/advisors/:id
GET    /api/vp/advisors-summary                                   → §17.2 dashboard
GET    /api/vp/pending-proposals                                  → §17.2 flat queue
POST   /api/students/:id/transfer-requests                        → §17.4 step 1 (blockIfDismissed)
GET    /api/students/:id/transfer-requests
GET    /api/advisors/:advisorId/transfer-requests                 → §17.4 step 2 queue
POST   /api/advisor/transfer-requests/:id/approve|decline         → §17.4 step 2
GET    /api/vp/transfer-requests                                  → §17.4 step 3 queue + full history
GET    /api/vp/transfer-requests-summary                          → §17.2 in-flight counters
POST   /api/vp/transfer-requests/:id/approve|decline               → §17.4 step 3 (only path that executes)
```

The pre-existing `POST /students/:id/transfer/internal|external` routes
(§7) are unchanged and still directly reachable — only the student-facing
"Confirm transfer" button no longer calls them; the VP-approve handler
above calls the same underlying functions those routes always called.

---

*End of specification. This document, sections 1–17, is intended to be handed in full to a build agent as the single source of truth for implementation — all business rules from the request are covered in §4 (probation/dismissal), §5 (retake gate), §7 (transfers), §15 (student portal, best-case projection, dual-approval registration, advisor reporting), §16 (Innovation & Venture Catalyst — venture gate, ventureFitScore, Venture Board, Faculty Console), §17 (AEGIS rebrand, multi-advisor model, Vice President oversight, advisor responsibility workflow, transfer pending chain), with worked scenarios in §11/§15.6/§11.N and a corresponding test checklist in §13.*
