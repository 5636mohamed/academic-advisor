// Spec §4.2 tier 2's `simulateUnderDepartment(student, bestInternalDept)` —
// re-runs §3.4's actual projection math (real §2.2 `computeCGPA`, real §3.1
// OLS regression) as if the student's next semester were drawn from a
// candidate department's course pool, instead of the linear-fudge heuristic
// this port used to return (see PROGRESS.md item 1 / repositoryBackedPorts.ts
// history). What's genuinely real here: the arithmetic (computeCGPA's
// weighted average, the same `ols` routine §3.4 uses for the student's own
// CGPA trend). What's still an approximation, flagged explicitly rather than
// silently presented as spec-complete: this demo only has ONE full course
// catalog seeded (ECE, see seedCatalog.ts) — there is no separate CSE/MCE
// course list to draw a "real" next-semester candidate pool from. So instead
// of a full candidate-pool/knapsack re-run (§3.1-§3.2 in full), the signal
// fed into computeCGPA is the student's own demonstrated performance in the
// target department's *gateway* courses (already-graded, real data) applied
// to a normal-size hypothetical course load. If/when per-department catalogs
// are seeded, replace `assumedNextSemesterPoints` below with a real
// buildCandidatePool -> packPlan -> expectedPct chain against that catalog —
// nothing else here should need to change.
import { Transcript, CgpaSnapshot } from '@advisor/shared';
import { computeCGPA } from '../grading/cgpa';
import { ols } from '../prediction/linearRegression';
import { TrendReading } from '../prediction/cgpaTrendProjection';
import weights from '../../config/predictionWeights.json';

export interface DepartmentGatewayProfile {
  id: string;
  gatewayCourseCodes: string[];
}

export interface SimulateUnderDepartmentInput {
  transcript: Transcript;
  courseByCode: Record<string, { credits: number }>;
  cgpaSnapshots: CgpaSnapshot[]; // student's REAL historical series, §3.4(2)
  dept: DepartmentGatewayProfile;
  nextSemesterOrdinal: number;
  hypotheticalCreditLoad?: number; // a normal-size next semester, default 15
}

export interface SimulateUnderDepartmentResult {
  projectedCGPA: number;
  trend: { slope: number | null; reading: TrendReading };
}

/** The student's own demonstrated points-per-credit in the target
 *  department's gateway courses (real grades, if any), falling back to
 *  their overall transcript average, then a neutral 2.5 for a
 *  brand-new/transfer student with no history at all. */
function assumedNextSemesterPoints(transcript: Transcript, gatewayCourseCodes: string[]): number {
  const gatewayPoints = gatewayCourseCodes.map(code => transcript[code]?.points).filter((p): p is number => p !== undefined);
  if (gatewayPoints.length > 0) return gatewayPoints.reduce((s, p) => s + p, 0) / gatewayPoints.length;

  const overallPoints = Object.values(transcript).map(r => r.points);
  if (overallPoints.length > 0) return overallPoints.reduce((s, p) => s + p, 0) / overallPoints.length;

  return 2.5;
}

export function simulateUnderDepartment(input: SimulateUnderDepartmentInput): SimulateUnderDepartmentResult {
  const { transcript, courseByCode, cgpaSnapshots, dept, nextSemesterOrdinal, hypotheticalCreditLoad = 15 } = input;

  const assumedPoints = assumedNextSemesterPoints(transcript, dept.gatewayCourseCodes);

  // Real §2.2 computeCGPA arithmetic over the actual transcript PLUS one
  // synthetic hypothetical-semester attempt, rather than a constant offset.
  const existingAttempts = Object.values(transcript);
  const syntheticCode = `__simulated_next_semester_under_${dept.id}__`;
  const syntheticAttempt = {
    courseCode: syntheticCode,
    attemptNumber: 1,
    pct: 0,
    letter: '',
    points: assumedPoints,
    isRetake: false,
    countsInCgpa: true,
    semesterOrdinal: nextSemesterOrdinal,
  };
  const projectedCGPA = computeCGPA({
    latestAttempts: [...existingAttempts, syntheticAttempt],
    courseByCode: { ...courseByCode, [syntheticCode]: { credits: hypotheticalCreditLoad } },
  });

  // Real §3.4 OLS trend: the student's own last snapshots plus this
  // projected point as one more data point on the same series.
  const minPoints = weights.trend.minSnapshotsForTrend;
  const recentReal = [...cgpaSnapshots].sort((a, b) => a.semesterOrdinal - b.semesterOrdinal).slice(-(minPoints - 1));
  const seriesX = [...recentReal.map(s => s.semesterOrdinal), nextSemesterOrdinal];
  const seriesY = [...recentReal.map(s => s.cgpa), projectedCGPA];

  if (seriesX.length < minPoints) {
    return { projectedCGPA, trend: { slope: null, reading: 'insufficient_history' } };
  }

  const { b: slope } = ols(seriesX, seriesY);
  const reading: TrendReading =
    slope > weights.trend.improvingSlopeThreshold ? 'improving' : slope < weights.trend.decliningSlopeThreshold ? 'declining' : 'flat';

  return { projectedCGPA, trend: { slope: Math.round(slope * 1000) / 1000, reading } };
}
