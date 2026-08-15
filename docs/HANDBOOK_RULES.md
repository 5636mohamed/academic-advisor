# Handbook Rules — plain-language source of truth

This file restates every business rule in `BUILD_SPEC.md` in plain language,
each one cross-referenced to the spec section it comes from and the file(s)
that implement it. Keep this in sync when a rule changes — this is the
document a non-engineer (advisor, registrar, committee) should be able to
read end to end without touching code.

## Grading

- **Two grading scales.** Engineering/program/faculty/school courses use a
  60% pass floor; university-requirement (LRA/UR) courses use a 50% pass
  floor. Same letter bands (A+ → F), same 1.00–4.00 point scale either way.
  *Spec §2.1 · [`packages/shared/src/grading/engScale.ts`](../packages/shared/src/grading/engScale.ts), [`urScale.ts`](../packages/shared/src/grading/urScale.ts)*
- **Retakes replace, never average.** If you retake a course, the new grade
  fully replaces the old one in your CGPA — the old attempt stays on your
  transcript for the record, but contributes nothing to CGPA math.
  *Spec §2.2 · [`packages/api/src/modules/grading/cgpa.ts`](../packages/api/src/modules/grading/cgpa.ts)*
- **Levels are driven by earned credits**, not semesters enrolled: Level 1
  (0–35 credits), 2 (36–71), 3 (72–107), 4 (108–143), 5 (144–160).
  *Spec §2.3 · [`packages/api/src/modules/grading/level.ts`](../packages/api/src/modules/grading/level.ts)*
- **Registration cap has three tiers**: 20 credits normally, 14 while on
  probation (CGPA < 2.00), or 16 for exactly one semester — the one
  immediately following a Level-1 student's low first semester (the
  "half-load" rule, see below).
  *Spec §2.4 · [`level.ts`](../packages/api/src/modules/grading/level.ts)*

## The probation counter ("warning ladder")

- **What increments it.** At the close of every *armed*, *normal* semester,
  if CGPA < 2.00 the counter goes up by exactly one. It never increments
  more than once per semester, no matter how many individual courses were
  failed.
  *Spec §4.1 · [`probationCounter.service.ts`](../packages/api/src/modules/probation/probationCounter.service.ts)*
- **Recovery resets it, not just pauses it.** The moment a semester's CGPA
  is back to ≥ 2.00, the counter drops to 0 — it is *not* a lifetime tally
  of every bad semester ever, it's "how many semesters in a row, since the
  last recovery, has CGPA been under 2.00."
  *Spec §4.4 · same file, `reset_recovered` branch*
- **Dismissal fires at exactly 6.** Not 5, not 7. The moment the counter
  would reach 6, the student's status becomes `dismissed` and every
  advising/transfer/registration endpoint returns 403.
  *Spec §4.1/§12 · [`dismissal.service.ts`](../packages/api/src/modules/probation/dismissal.service.ts)*
- **The first semester never counts, win or lose.** A brand-new Level-1
  student's semester-1 CGPA (which is also their GPA — there's nothing else
  yet) never increments the counter, even if it's well below 2.00. If it
  *is* below 2.00, their next semester gets the 16-credit half-load instead.
  Arming for the counter begins with semester 2's outcome.
  *Spec §4.5 · [`firstSemesterRule.service.ts`](../packages/api/src/modules/probation/firstSemesterRule.service.ts)*
- **A faculty transfer resets it to 0 and re-arms from scratch,** treated
  exactly like a brand-new first semester (the Transfer Semester's GPA does
  not itself count against the student — only the semester after it does).
  This is a deliberate, documented extension of the Level-1 first-semester
  rule to the transfer case, not a literal handbook instruction — flagged in
  spec §7.2.3 for registrar review.
  *Spec §7.2.3 · [`externalTransfer.service.ts`](../packages/api/src/modules/transfer/externalTransfer.service.ts)*
- **An internal (same-faculty) transfer leaves the counter completely
  alone** — neither incremented nor reset.
  *Spec §7.1 · [`internalTransfer.service.ts`](../packages/api/src/modules/transfer/internalTransfer.service.ts)*

## The advising recommendation (what the system tells a student to do)

Two rules run side by side and can disagree in which case the **stricter/
more recent** one wins — see `AMENDMENT 1` below for the warning-ladder
override.

**A. Trend-based (original rule, applies once the ladder is at 0/6):**
1. If the recommended plan is projected to raise CGPA *and* the student's
   real multi-semester trend isn't declining → show the plan, done.
2. If the trend is flat or declining → recommend the best-fit *department*
   within the student's own faculty first (quiz + gateway grades + alumni
   outcomes, 50/30/20 weighted) — never jump straight to a faculty
   recommendation while an untried in-faculty option exists.
3. If CGPA is still projected below 2.00 even under the best in-faculty
   department, or no in-faculty department would help → recommend a
   **faculty** transfer instead. A student only gets ONE internal-department
   recommendation ever — after that, straight to faculty-level.
   *Spec §4.2, §4.2.1 · [`advisingCycle.service.ts`](../packages/api/src/modules/advising/advisingCycle.service.ts)*

**B. Warning-ladder rule (AMENDMENT 1, takes over once warning count ≥ 1):**
- Warning 1 or 2 → normal recommendation (show the plan), regardless of trend.
- Warning 3 → recommend an internal department transfer (or straight to
  faculty-level if the student already used their one internal transfer).
- Warning 4 or 5 → recommend a faculty transfer.
- Warning 6 → dismissal already happened; advising doesn't run again.
  *Documented in full, with rationale, in the header comment of
  [`advisingCycle.service.ts`](../packages/api/src/modules/advising/advisingCycle.service.ts)*

**Why `probation_repair` mode exists:** whenever CGPA is below 2.00, the
course-ranking formula itself changes — expected grade quality is weighted
higher, credit throughput lower. The priority is raising CGPA first, speed
to graduation second, until the student is back above 2.00.
*Spec §4.3 · [`candidateScore.ts`](../packages/api/src/modules/prediction/candidateScore.ts)*

## The retake gate (asked before any course list is shown)

Every planning run opens with: *"Would you like the plan to consider
retaking courses you could improve on?"*

- **Yes** → D/D+/F retakes are eligible for the ranked plan, and get an
  extra bonus for retakes that unblock the most future courses (not just
  the biggest point gain).
- **No** → optional D/D+ retakes are dropped entirely, **except** any course
  currently graded F, which is *always* force-included as a "Mandatory
  retake — required to graduate," unscored, reserved in the credit cap
  before anything else is optimized.
- **If mandatory F-retakes don't all fit the credit cap** (common on the
  14-credit probation cap), the ones that unblock the most future courses
  are kept; the rest carry to next semester.
  *Spec §5 · [`retakePreference.service.ts`](../packages/api/src/modules/retakeGate/retakePreference.service.ts), [`planPacker.ts`](../packages/api/src/modules/prediction/planPacker.ts)*

## Transfers

- **Internal (same faculty, different department).** Credits carry over
  1:1. Shared/UR/faculty/school courses remap automatically to the new
  department's requirements; department-specific courses with no
  equivalent become "excess credit" — still counted toward the 160-credit
  graduation total, just not tied to a specific requirement slot anymore.
  *Spec §7.1 · [`internalTransfer.service.ts`](../packages/api/src/modules/transfer/internalTransfer.service.ts)*
- **External (different faculty).** Only passed UR/LRA courses and
  "basic science" courses (shared Math/Physics/Chemistry/Intro-Programming)
  are even considered, and only if the registrar has an equivalency mapping
  for the target faculty — anything without one visibly does not transfer.
  The resulting "Transfer Semester" GPA becomes the new base CGPA: every
  later CGPA figure is computed from that point forward only; the old
  faculty's grades stay on the transcript for the record but stop counting.
  *Spec §7.2 · [`transferSemester.builder.ts`](../packages/api/src/modules/transfer/transferSemester.builder.ts), [`externalTransfer.service.ts`](../packages/api/src/modules/transfer/externalTransfer.service.ts)*

## Prediction math (how the system guesses a grade or a fit)

- **Every score is a weighted sum of a few 0–1 signals**, and every weight
  lives in [`predictionWeights.json`](../packages/api/src/config/predictionWeights.json)
  — not hard-coded — so an academic committee can retune it without
  touching code.
- **A course's expected score** blends (a) a linear-regression trend of how
  the *cohort* has scored in that course recently, (b) a linear-regression
  trend of how *this student* has scored in comparable courses, and (c) a
  small nudge for historically easy/hard courses.
  *Spec §3.1 · [`expectedPct.ts`](../packages/api/src/modules/prediction/expectedPct.ts)*
- **A course's "unlock value"** is not just how many courses it directly
  gates — it's the whole downstream chain, decayed by depth, because
  passing one gateway course can cascade into several future terms.
  *Spec §3.3 · [`chainUnlockValue.ts`](../packages/api/src/modules/prediction/chainUnlockValue.ts)*
- **Department/faculty fit** = 50% quiz answers (trait-matched) + 30% grades
  in that department's gateway courses + 20% alumni outcomes (employment
  rate + satisfaction).
  *Spec §6 · [`deptFitEngine.ts`](../packages/api/src/modules/fitEngine/deptFitEngine.ts)*

## Non-negotiable safety rules (§12)

- A dismissed student is locked out of advising, transfers, and
  registration **at the API layer** (403), not just hidden in the UI.
- With fewer than 3 real CGPA data points, the trend is "unknown" and the
  system defaults to showing the plan rather than guessing a transfer
  recommendation.
- Every probation-counter change and every transfer is logged to an
  append-only audit trail — nothing is ever silently overwritten.
