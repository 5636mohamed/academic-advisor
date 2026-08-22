// Real prediction-engine epic — replaces studentTrend.ts's regression-
// projected "student ability" signal with the two real statistics
// explicitly asked for: the student's own mean score and modal (most
// frequently earned) letter grade, both scoped to comparable-category
// history (program/faculty vs ur_*) so a run of easy LRA marks doesn't
// distort a projection for a hard core course — same scoping
// studentTrend.ts already established, kept unchanged since it's sound.
//
// Follow-up (live user request): a flat mean/mode alone can't tell two
// students with the identical 75% average apart — one who started at 60%
// and is climbing, and one who started at 90% and is sliding, read
// identically to the old formula even though a realistic predictor should
// treat them very differently. This adds the personal counterpart to
// cohortTrend.ts's subject-wide rising/declining/consistent/inconsistent
// classification — "is THIS student's own performance in this subject
// area trending up or down over their real semester history" — over the
// exact same comparable-category pool the mean/mode already use, so mean,
// mode, and trend never disagree about which courses they're describing.
// linearRegression.ts's own header comment already named this
// "student ability trend" as one of the three trend signals this module
// was built to support; this is that third one, finally wired in.
import { EnrollmentRecord, Course, CourseCategory, GradeBand, ENG_SCALE, UR_SCALE } from '@advisor/shared';
import { clamp, ols, recencyWeights } from './linearRegression';
import { modalLetter } from './gradeDistribution';
import weights from '../../config/predictionWeights.json';

const MIN_COMPARABLE_FOR_MEAN_MODE = 3;
// Same floor as the mean/mode fallback and cohortTrend.ts's own
// MIN_OFFERINGS_FOR_TREND, but counted in DISTINCT semesters (see the
// per-semester aggregation below) — fewer than 3 semesters of comparable
// grades can't support a meaningful slope, so trend stays 'consistent'
// (no adjustment) rather than reacting to noise from 1-2 data points.
const MIN_SEMESTERS_FOR_TREND = 3;
const UR_CATEGORIES: CourseCategory[] = ['ur_core', 'ur_elective'];

function isUrCategory(cat: CourseCategory) {
  return UR_CATEGORIES.includes(cat);
}

export type StudentTrendLabel = 'rising' | 'declining' | 'consistent' | 'inconsistent';

export interface StudentMeanMode {
  mean: number; // 0-100
  modeLetter: string | null; // null only if every comparable attempt is somehow tied with no clear winner — modalLetter's own null case
  modePct: number; // modeLetter's band minimum, or `mean` when there's no clear mode (e.g. a single attempt)
  /** This student's own comparable-category grades over time — rising,
   *  declining, noisy ("inconsistent"), or 'consistent' (either genuinely
   *  flat, or too little chronological history to tell — both read the
   *  same way here: no adjustment). */
  trend: StudentTrendLabel;
  /** The additive adjustment expectedPct.ts applies for this student's own
   *  trend — separate from (and summed with) cohortTrend.ts's subject-wide
   *  trendAdjustment, exposed here for the same reason that one is: so a
   *  caller/test can check the exact number without re-deriving it. */
  trendAdjustment: number;
}

/** `declining`/`rising` take priority over `inconsistent` when a student's
 *  own comparable-category record is BOTH drifting AND noisy — mirrors
 *  cohortTrend.ts's classifyTrend precedence exactly, same reasoning (a
 *  clear direction is more actionable than "it's noisy"). */
function classifyStudentTrend(slopePerTerm: number, stdDev: number): StudentTrendLabel {
  const cfg = weights.expectedPct;
  if (slopePerTerm >= cfg.studentTrendSlopePerTermThreshold) return 'rising';
  if (slopePerTerm <= -cfg.studentTrendSlopePerTermThreshold) return 'declining';
  if (stdDev >= cfg.studentInconsistencyStdDevThreshold) return 'inconsistent';
  return 'consistent';
}

function studentTrendAdjustmentFor(trend: StudentTrendLabel): number {
  const cfg = weights.expectedPct;
  if (trend === 'rising') return cfg.studentRisingBonus;
  if (trend === 'declining') return -cfg.studentDecliningPenalty;
  if (trend === 'inconsistent') return -cfg.studentInconsistencyPenalty;
  return 0;
}

/** Real bug reported live: a student with a strong recent record could
 *  still land a low expectedPct because the old formula weighted a
 *  regression-projected COHORT number nearly as heavily as the student's
 *  own trend. This function is the new student-side half of the fix — a
 *  student's own real mean and modal grade, not blended with any cohort
 *  signal yet (expectedPct.ts does that blending). */
export function studentMeanAndMode(
  targetCourse: Pick<Course, 'category' | 'isUR'>,
  history: EnrollmentRecord[],
  courseByCode: Record<string, Pick<Course, 'category'>>
): StudentMeanMode | null {
  const targetIsUr = isUrCategory(targetCourse.category);
  const comparable = history.filter(r => {
    const c = courseByCode[r.courseCode];
    return c && isUrCategory(c.category) === targetIsUr;
  });

  // Falls back to ALL graded courses (comparable or not) when there isn't
  // enough comparable-category history yet — same "some real signal beats
  // none" reasoning studentTrend.ts already used, not a new judgment call.
  const pool = comparable.length >= MIN_COMPARABLE_FOR_MEAN_MODE ? comparable : history;
  if (pool.length === 0) return null;

  const mean = clamp(pool.reduce((s, r) => s + r.pct, 0) / pool.length, 0, 100);

  const scale: GradeBand[] = targetCourse.isUR ? UR_SCALE : ENG_SCALE;
  const letterCounts: Record<string, number> = {};
  for (const r of pool) letterCounts[r.letter] = (letterCounts[r.letter] ?? 0) + 1;
  const modeLetter = modalLetter(letterCounts, scale);
  const modePct = modeLetter ? (scale.find(b => b.letter === modeLetter)?.min ?? mean) : mean;

  // Trend over that SAME pool, aggregated to one point PER SEMESTER (mean
  // pct that semester), not one point per course record. A student's real
  // transcript is lock-step — a dozen-plus comparable courses can land in
  // the same semesterOrdinal at once (especially the synthetic gap-filled
  // ones completeTranscript adds) — fitting a slope over raw per-course
  // index would mostly be measuring which-course-came-first noise within
  // one semester, not genuine drift across semesters. Same x-axis choice
  // cgpaTrendProjection.ts already uses for the analogous CGPA-trajectory
  // fit (real semesterOrdinal, not a synthetic 0..n index).
  const bySemester = new Map<number, number[]>();
  for (const r of pool) {
    const bucket = bySemester.get(r.semesterOrdinal);
    if (bucket) bucket.push(r.pct); else bySemester.set(r.semesterOrdinal, [r.pct]);
  }
  const semesterPoints = [...bySemester.entries()]
    .map(([ordinal, pcts]) => ({ ordinal, avgPct: pcts.reduce((s, v) => s + v, 0) / pcts.length }))
    .sort((a, b) => a.ordinal - b.ordinal);

  let trend: StudentTrendLabel = 'consistent';
  if (semesterPoints.length >= MIN_SEMESTERS_FOR_TREND) {
    const x = semesterPoints.map(p => p.ordinal);
    const y = semesterPoints.map(p => p.avgPct);
    const { b: slope } = ols(x, y, recencyWeights(x.length, weights.trend.recencyHalfLife));
    // Variance across the student's own SEMESTER-level averages — "does
    // this student's performance swing widely term to term", not
    // "how much do individual courses within one term differ from each
    // other" (ordinary in-semester course-difficulty variation isn't
    // personal inconsistency).
    const yMean = y.reduce((s, v) => s + v, 0) / y.length;
    const stdDev = Math.sqrt(y.reduce((s, v) => s + (v - yMean) ** 2, 0) / y.length);
    trend = classifyStudentTrend(slope, stdDev);
  }

  return { mean, modeLetter, modePct, trend, trendAdjustment: studentTrendAdjustmentFor(trend) };
}
