// Spec §4.2 — the advising-cycle orchestrator. This is the module that
// actually wires together: retake gate (§5) → candidate pool → packPlan
// (§3.2/§5.2) → semester/CGPA projection (§3.4) → the three-way branch
// (SHOW_PLAN / RECOMMEND_INTERNAL_TRANSFER / RECOMMEND_FACULTY_TRANSFER,
// §4.2, with the infinite-department-hop guard from §4.2.1).
//
// ### AMENDMENT 1 (post-session-4, per direct product-owner instruction) —
// warning-ladder-driven tier escalation, layered on top of §4.2's original
// trend-based branch:
//
//   "for the 1st and 2nd warning: normal recommendation, but if the
//    student stays like that into the 3rd warning: internal transfer
//    recommendation, then the 4th: faculty transfer recommendation."
//
// This ties the RECOMMEND_INTERNAL_TRANSFER / RECOMMEND_FACULTY_TRANSFER
// tiers directly to `ProbationCounterState.count` (the same "N/6 warnings"
// counter §4.1/§4.4 already track) for any student currently ON the
// warning ladder (count >= 1). The original §4.2 trend-based logic
// (`isImprovingCase`, best-fit department simulation, etc.) is preserved
// UNCHANGED as the fallback for students with count === 0 — i.e. students
// who have never had a low-CGPA semester at all, like §11 Example H's Sara
// (CGPA 2.15, always >= 2.00, so her counter never increments). Without
// that fallback, Sara could never receive an internal-transfer suggestion
// under a purely counter-driven rule, which would silently break Example H
// and the "count > 0 and a dept-fit suggestion are independent systems"
// bullet in §12 — that §12 bullet is now superseded for count >= 1 by this
// amendment (a probation-ladder student's tier is no longer independent of
// count; it IS count, once count >= 1), but stays true for count === 0.
// Flagging this explicitly rather than silently editing §12's text, so a
// future reviewer sees exactly what changed and why.
//
// Concretely, the new precedence (§4.2 branch, amended):
//   count === 0            -> ORIGINAL trend-based tier logic (unchanged)
//   count === 1 or 2       -> SHOW_PLAN ("normal recommendation")
//   count === 3            -> RECOMMEND_INTERNAL_TRANSFER
//                              (or straight to faculty transfer if the
//                              §4.2.1 guard already fired once)
//   count >= 4 (and < 6)   -> RECOMMEND_FACULTY_TRANSFER
//   count >= 6             -> dismissal already fired in onSemesterClose
//                              (§4.1) before advising ever runs again —
//                              out of scope for this function.
//
// Every sub-computation this file needs (expectedPct, chainUnlockValue,
// scoreCandidate, packPlan, computeCGPA, projectCGPATrend, the §6 fit
// engine) already exists as a pure function/module EXCEPT for two things
// that need real data (course offerings, quiz/alumni tables, a student's
// full transcript) to run:
//   1. turning a raw EligibleCourse into a fully scored candidate
//      (expectedPct → letter/points → chainUnlockValue → CandidateForScoring)
//   2. the §6 fit-engine queries (recommendDepartments / rankFacultiesByFit
//      / simulateUnderDepartment) and the §7 TransferRecord lookup
//
// Those are injected as `AdvisingCyclePorts` (a small hexagonal-style seam)
// so this file can be complete, typed, and unit-testable with fixtures
// TODAY, before the repository layer (§9.1) or the fit engine (§6, item 3
// in PROGRESS.md) exist. When those are built, the caller (the /advise
// route controller) supplies real, repository-backed implementations of
// these ports — nothing in this file changes.
//
// NOTE on `Student.cgpa`: the shared `Student` type (packages/shared/src/
// types/student.ts) does not declare a `cgpa` field yet — only
// cumulativeEarnedCredits/level. Every function below therefore takes
// `Student & { cgpa: number }` explicitly rather than reading a field that
// doesn't exist on the type. The repository layer computes this via
// `grading/cgpa.ts#computeCGPA` and attaches it before calling in. Adding
// `cgpa` directly to the shared `Student` type is a one-line follow-up worth
// doing once the repository layer exists — flagging here rather than
// silently widening a shared type from inside this module.
import { CgpaSnapshot, PlanMode, CandidateCourseScore, AdvisingAction, Student, ProbationCounterState } from '@advisor/shared';
import { buildCandidatePool, EligibleCourse } from '../retakeGate/retakePreference.service';
import { packPlan, PackPlanResult, Bundle } from '../prediction/planPacker';
import { scoreCandidate, CandidateForScoring } from '../prediction/candidateScore';
import { creditCapFor } from '../grading/level';
import { projectCGPATrend, isImprovingCase, TrendReading } from '../prediction/cgpaTrendProjection';

export type StudentWithCgpa = Student & { cgpa: number };

/** A candidate that has already been run through §3.1 (expectedPct) and
 *  §3.3 (chainUnlockValue) — everything scoreCandidate/packPlan need, plus
 *  display fields for the UI's plan table (§10). */
export interface ScoredCandidate extends CandidateForScoring {
  courseCode: string;
  coreq: string[];
  oldPoints: number | null;
  expectedPct: number;
  expectedLetter: string;
}

export interface DeptFitResult {
  id: string;
  name: string;
  total: number;
  quizScore: number;
  gwScore: number;
  alumScore: number;
}

export interface SimulateUnderDepartmentResult {
  projectedCGPA: number;
  trend: { slope: number | null; reading: TrendReading };
}

export interface AdvisingCyclePorts {
  /** §5 — the yes/no gate, asked before any course list is shown. */
  getRetakeGateAnswer(studentId: string): Promise<boolean> | boolean;
  /** All courses the student is currently eligible to register for, both
   *  fresh and eligible-for-retake, per §1.2/§5's eligibility rules. */
  getEligibleCourses(studentId: string): Promise<EligibleCourse[]> | EligibleCourse[];
  /** §3.1(a)(b)(c) + §3.3 — scores one eligible course into a full
   *  ScoredCandidate. Called once per eligible course. */
  scoreEligibleCourse(
    student: StudentWithCgpa,
    course: EligibleCourse,
    retakeGateYes: boolean
  ): Promise<ScoredCandidate> | ScoredCandidate;
  /** Whether the student is in the special post-low-first(/transfer)-semester
   *  half-load window, §2.4/§4.5. */
  isPostLowFirstSemester(studentId: string): Promise<boolean> | boolean;
  /** §3.4(1) — simulate the recommended plan's grades landing as expected
   *  and recompute CGPA (respecting the student's active base snapshot,
   *  §7.2.3). */
  projectPlanCGPA(student: StudentWithCgpa, plan: PackPlanResult): Promise<number> | number;
  /** §3.4(2) input — the student's own historical CGPA snapshot series. */
  getCgpaSnapshots(studentId: string): Promise<CgpaSnapshot[]> | CgpaSnapshot[];
  /** §6 — restricted to departments within student.facultyId. */
  recommendDepartments(student: StudentWithCgpa): Promise<DeptFitResult[]> | DeptFitResult[];
  /** §4.2 tier 2 — re-run §3.4 as if the student were in `deptId`. */
  simulateUnderDepartment(
    student: StudentWithCgpa,
    deptId: string
  ): Promise<SimulateUnderDepartmentResult> | SimulateUnderDepartmentResult;
  /** §6, faculty-level aggregate — used only in the tier-3 branch. */
  rankFacultiesByFit(student: StudentWithCgpa): Promise<DeptFitResult[]> | DeptFitResult[];
  /** §4.2.1 guard — has this student already executed one
   *  TransferRecord(type='internal_department')? */
  alreadyTransferredInternallyOnce(studentId: string): Promise<boolean> | boolean;
  /** AMENDMENT 1 — the same warning counter §4.1/§4.4 already track,
   *  needed here to drive the count-based tier escalation (1st/2nd =
   *  normal, 3rd = internal transfer, 4th+ = faculty transfer). */
  getProbationCounter(studentId: string): Promise<ProbationCounterState> | ProbationCounterState;
}

export type AdvisingActionResult = AdvisingAction & {
  suggestedDepartmentId?: string;
  suggestedFaculties?: DeptFitResult[];
};

function toCandidateCourseScore(member: ScoredCandidate, mode: PlanMode, mandatory: boolean): CandidateCourseScore {
  return {
    courseCode: member.courseCode,
    isRetake: member.isRetake,
    oldPoints: member.oldPoints,
    expectedPct: member.expectedPct,
    expectedLetter: member.expectedLetter,
    expectedPoints: member.expectedPoints,
    deltaPts: member.deltaPts,
    chainUnlockValue: member.chainUnlockValue,
    passRate: member.passRate,
    score: scoreCandidate(member, mode),
    mandatory,
  };
}

function bundlesToPlan(mandatoryBundles: Bundle[], optimizedBundles: Bundle[], mode: PlanMode): CandidateCourseScore[] {
  const mandatory = mandatoryBundles.flatMap(b => b.members.map(m => toCandidateCourseScore(m as ScoredCandidate, mode, true)));
  const optional = optimizedBundles.flatMap(b => b.members.map(m => toCandidateCourseScore(m as ScoredCandidate, mode, false)));
  return [...mandatory, ...optional];
}

/** §4.2's branch, factored out as a pure function so it can be unit-tested
 *  against fixed inputs without touching any port or awaiting anything.
 *  `runAdvisingCycle` below is the only caller.
 *
 *  AMENDMENT 1 (see file header): `warningCount` now takes precedence over
 *  the original trend-based tiering whenever it's >= 1. Pass 0 to get the
 *  exact original §4.2 trend-based behavior (this is also the default, so
 *  every call site/test written before this amendment keeps working
 *  unmodified). */
export function decideAdvisingAction(params: {
  currentCgpa: number;
  plan: CandidateCourseScore[];
  projectedCGPA: number;
  trend: { slope: number | null; reading: TrendReading };
  bestInternalDept: DeptFitResult | null;
  simulateBestInternal: SimulateUnderDepartmentResult | null;
  alreadyTransferredInternallyOnce: boolean;
  facultyFit: DeptFitResult[];
  /** AMENDMENT 1 — warning-ladder count (same as ProbationCounterState.count).
   *  0 = not currently on the ladder -> falls back to trend-based tiering. */
  warningCount?: number;
}): AdvisingActionResult {
  const {
    currentCgpa,
    plan,
    projectedCGPA,
    trend,
    bestInternalDept,
    simulateBestInternal,
    alreadyTransferredInternallyOnce,
    facultyFit,
    warningCount = 0,
  } = params;

  // --- AMENDMENT 1: warning-ladder-driven tier escalation takes over the
  // moment a student is actually on the ladder (warningCount >= 1). This
  // intentionally runs BEFORE the original trend-based tiering below —
  // see the file header for why, and for what this supersedes in §12. ---
  if (warningCount >= 1 && warningCount <= 2) {
    // "for the 1st and 2nd warning: normal recommendation" — show the plan
    // regardless of what the trend signal alone would have said.
    return {
      action: 'SHOW_PLAN',
      plan,
      projectedCGPA,
      trendSlope: trend.slope,
      explain: 'probation_warning_1_or_2_normal_recommendation',
    };
  }

  // --- Product-owner refinement: NEITHER the warning-ladder tiers below
  // NOR the original trend-based Tier 2/3 further down were ever meant to
  // push a transfer on a student who is currently doing well — a
  // comfortably-above-3.0 CGPA is "good performing" full stop, even if
  // their trend recently dipped (e.g. right after a department switch) or
  // their warning history says otherwise. Placed AFTER the 1st/2nd-warning
  // check above (no conflict — that's already SHOW_PLAN) but BEFORE the
  // ladder's own transfer tiers, and again further down between Tier 1 and
  // Tier 2/3 — never before Tier 1 itself, so a genuinely improving >3.0
  // case still gets Tier 1's own more specific explain reason rather than
  // this generic one. A narrower version of this guard once only covered
  // warningCount >= 3 and missed the Tier 2 trend-based branch entirely,
  // which had no upper CGPA bound at all. ---
  if (currentCgpa > 3.0 && warningCount >= 3) {
    return {
      action: 'SHOW_PLAN',
      plan,
      projectedCGPA,
      trendSlope: trend.slope,
      explain: 'cgpa_comfortably_above_3_no_transfer_needed',
    };
  }

  if (warningCount === 3) {
    // "if stayed like that into the 3rd: internal transfer recommendation"
    // — still subject to the §4.2.1 anti-loop guard: if this student has
    // already used their one internal hop, escalate straight to faculty.
    if (bestInternalDept && !alreadyTransferredInternallyOnce) {
      return {
        action: 'RECOMMEND_INTERNAL_TRANSFER',
        plan,
        projectedCGPA,
        trendSlope: trend.slope,
        explain: 'probation_warning_3_internal_transfer_recommended',
        suggestedDepartmentId: bestInternalDept.id,
      };
    }
    return {
      action: 'RECOMMEND_FACULTY_TRANSFER',
      plan,
      projectedCGPA,
      trendSlope: trend.slope,
      explain: 'probation_warning_3_internal_transfer_already_used_escalating_to_faculty',
      suggestedFaculties: facultyFit,
    };
  }

  if (warningCount >= 4 && warningCount < 6) {
    // "then the 4th: faculty transfer recommendation" — and every warning
    // after the 4th (5th) stays at this tier too, since 6 is dismissal
    // territory (handled entirely outside this function, §4.1) and
    // nothing in between 4 and 6 should regress back to a weaker tier.
    return {
      action: 'RECOMMEND_FACULTY_TRANSFER',
      plan,
      projectedCGPA,
      trendSlope: trend.slope,
      explain: 'probation_warning_4_plus_faculty_transfer_recommended',
      suggestedFaculties: facultyFit,
    };
  }

  // --- warningCount === 0 (or >= 6, which shouldn't reach here — a
  // dismissed student is locked out before advising runs again, §12):
  // fall back to the ORIGINAL §4.2 trend-based tiering, unchanged. ---

  // Tier 1 — does the recommended plan itself, combined with the student's
  // real trajectory, count as improving? (§3.4, both signals.)
  if (isImprovingCase(currentCgpa, projectedCGPA, trend)) {
    return {
      action: 'SHOW_PLAN',
      plan,
      projectedCGPA,
      trendSlope: trend.slope,
      explain: 'plan_projected_to_raise_cgpa',
    };
  }

  // Same product-owner refinement as above, for the original Tier 2/3
  // trend-based branches: Tier 1 just failed (this student's trend doesn't
  // read as "improving" by that stricter test — e.g. a real dip right
  // after a department switch), but a CGPA comfortably above 3.0 is still
  // "doing well" and was never meant to get a transfer pushed on it either
  // way. Tier 2 below had no upper CGPA bound at all before this existed.
  if (currentCgpa > 3.0) {
    return {
      action: 'SHOW_PLAN',
      plan,
      projectedCGPA,
      trendSlope: trend.slope,
      explain: 'cgpa_comfortably_above_3_no_transfer_needed',
    };
  }

  // Tier 2 — flat/declining: is there a better-fit department in the SAME
  // faculty that would plausibly turn the trend around, and hasn't this
  // student already tried an internal hop once before (§4.2.1)?
  if (
    bestInternalDept &&
    simulateBestInternal &&
    currentCgpa >= 2.0 &&
    simulateBestInternal.projectedCGPA > currentCgpa &&
    (simulateBestInternal.trend.slope ?? -Infinity) > -0.01 &&
    !alreadyTransferredInternallyOnce
  ) {
    return {
      action: 'RECOMMEND_INTERNAL_TRANSFER',
      plan,
      projectedCGPA,
      trendSlope: trend.slope,
      explain: 'flat_or_declining_trend_but_better_fit_department_available_in_faculty',
      suggestedDepartmentId: bestInternalDept.id,
    };
  }

  // Tier 3 — CGPA is still below 2.00, or no in-faculty alternative helps:
  // escalate to a faculty-level transfer recommendation.
  return {
    action: 'RECOMMEND_FACULTY_TRANSFER',
    plan,
    projectedCGPA,
    trendSlope: trend.slope,
    explain: currentCgpa < 2.0 ? 'cgpa_remains_below_2_after_projection' : 'no_departmental_alternative_improves_trend',
    suggestedFaculties: facultyFit,
  };
}

/** Full orchestration, §4.2 (+ AMENDMENT 1, see file header): gate →
 *  candidates → pack → project → warning-count check → branch. */
export async function runAdvisingCycle(student: StudentWithCgpa, ports: AdvisingCyclePorts): Promise<AdvisingActionResult> {
  // §5 — always asked first.
  const retakeGateYes = await ports.getRetakeGateAnswer(student.id);
  const eligible = await ports.getEligibleCourses(student.id);

  // §5.1/§5.2 — split into pool (mode-scored, optional) vs mandatory
  // (F-grade retakes, always force-included regardless of the gate answer).
  const { pool, mandatory } = buildCandidatePool({ eligible, considerRetakes: retakeGateYes });

  const scoredPool: ScoredCandidate[] = await Promise.all(pool.map(c => ports.scoreEligibleCourse(student, c, retakeGateYes)));
  const scoredMandatory: ScoredCandidate[] = await Promise.all(
    mandatory.map(c => ports.scoreEligibleCourse(student, c, retakeGateYes))
  );

  // Fetched once, ahead of the cap/mode decision below, so it can double
  // as the "has this student ever closed a real semester yet" signal too —
  // an empty snapshot series is this app's actual definition of "no real
  // grade history exists" (a snapshot is only ever written when a
  // semester CLOSES, §4.1), which is exactly the cold-start case (a
  // brand-new Level-1/semester-1 student). Without this, student.cgpa=0
  // (no grade at all, not poor performance) tripped the same
  // 'probation_repair' mode and 14-credit cap a student who actually
  // EARNED a sub-2.0 GPA gets — a real bug the cold-start trial persona's
  // own first plan-generation surfaced.
  const snapshots = await ports.getCgpaSnapshots(student.id);
  const hasCompletedAnyCourse = snapshots.length > 0;

  const isHalfLoad = await ports.isPostLowFirstSemester(student.id);
  const cap = creditCapFor({ isPostLowFirstSemester: isHalfLoad, cgpa: student.cgpa, hasCompletedAnyCourse });
  const mode: PlanMode = student.cgpa < 2.0 && hasCompletedAnyCourse ? 'probation_repair' : 'fast'; // §4.3

  const planResult = packPlan({ mandatory: scoredMandatory, pool: scoredPool, cap, mode });

  const projectedCGPA = await ports.projectPlanCGPA(student, planResult); // §3.4(1)
  const trend = projectCGPATrend(snapshots); // §3.4(2)

  const plan = bundlesToPlan(planResult.mandatoryBundles, planResult.optimizedBundles, mode);

  // AMENDMENT 1 — the warning-ladder count. Fetched unconditionally: it's
  // cheap (a single counter row), and we need it to know whether we can
  // still take the tier-1 trend-only short-circuit below at all.
  const counter = await ports.getProbationCounter(student.id);
  const warningCount = counter.count;

  // Tier 1 can be decided without touching the (expensive) fit-engine
  // ports at all — but ONLY when the student isn't on the warning ladder
  // (warningCount === 0). Once warningCount >= 1, AMENDMENT 1 means the
  // count itself decides the tier, so we can't short-circuit purely off
  // the trend signal anymore — warningCount === 3 still needs
  // bestInternalDept, and warningCount >= 4 still needs facultyFit, even
  // if the trend/projection alone would have looked "improving."
  if (warningCount === 0 && isImprovingCase(student.cgpa, projectedCGPA, trend)) {
    return decideAdvisingAction({
      currentCgpa: student.cgpa,
      plan,
      projectedCGPA,
      trend,
      bestInternalDept: null,
      simulateBestInternal: null,
      alreadyTransferredInternallyOnce: false,
      facultyFit: [],
      warningCount,
    });
  }

  // warningCount is 1 or 2: decideAdvisingAction returns SHOW_PLAN
  // unconditionally for these and never looks at bestInternalDept/
  // facultyFit, so skip the fit-engine ports here too — same
  // short-circuit spirit as the tier-1 case above, just gated on the
  // ladder instead of the trend.
  if (warningCount === 1 || warningCount === 2) {
    return decideAdvisingAction({
      currentCgpa: student.cgpa,
      plan,
      projectedCGPA,
      trend,
      bestInternalDept: null,
      simulateBestInternal: null,
      alreadyTransferredInternallyOnce: false,
      facultyFit: [],
      warningCount,
    });
  }

  // --- Every remaining case (warningCount === 0 with a non-improving
  // trend, warningCount === 3, or warningCount >= 4) needs the fit-engine
  // signals: either for the original trend-based tier 2/3, or for
  // AMENDMENT 1's count-driven internal/faculty suggestions. ---
  const deptFit = await ports.recommendDepartments(student); // §6
  const bestInternalDept = deptFit.length > 0 ? [...deptFit].sort((a, b) => b.total - a.total)[0] : null;
  const simulateBestInternal = bestInternalDept ? await ports.simulateUnderDepartment(student, bestInternalDept.id) : null;
  const alreadyInternal = await ports.alreadyTransferredInternallyOnce(student.id); // §4.2.1
  const facultyFit = await ports.rankFacultiesByFit(student); // §6 — computed eagerly here so the
  // tier-3 fallback never has to await mid-branch; cheap relative to the
  // fit-engine call we already paid for above.

  return decideAdvisingAction({
    currentCgpa: student.cgpa,
    plan,
    projectedCGPA,
    trend,
    bestInternalDept,
    simulateBestInternal,
    alreadyTransferredInternallyOnce: alreadyInternal,
    facultyFit,
    warningCount,
  });
}
