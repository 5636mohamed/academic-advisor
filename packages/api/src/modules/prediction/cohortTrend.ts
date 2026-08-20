// Real prediction-engine epic — the cohort/subject-history side of the
// blend: real mean, real modal grade, and a real trend classification
// (rising/declining/consistent/inconsistent), all from a course's actual
// 3-year CourseOffering history — the "last 3 years grades recorded in
// this recommended subject: what is the mean, what is the mode... and
// consider the trend" the fix was explicitly asked for, "like you did
// with the student" (studentStats.ts's own mean+mode treatment).
import { CourseOffering, gradeFromPct, ENG_SCALE, UR_SCALE } from '@advisor/shared';
import { ols, recencyWeights, clamp } from './linearRegression';
import { combineDistributions, modalLetterByDensity, pctForLetter } from './gradeDistribution';
import weights from '../../config/predictionWeights.json';

const MIN_OFFERINGS_FOR_TREND = 3;

export type CohortTrendLabel = 'rising' | 'declining' | 'consistent' | 'inconsistent';

export interface CohortMeanModeTrend {
  mean: number; // real enrollment-weighted mean across the offering history
  modeLetter: string | null;
  modePct: number; // modeLetter's band minimum, or `mean` when there's no clear mode
  trend: CohortTrendLabel;
  /** The additive adjustment expectedPct.ts applies for this trend —
   *  exposed here (not just the label) so a caller/test can check the
   *  exact number without re-deriving it from config. */
  trendAdjustment: number;
}

/** `declining`/`rising` take priority over `inconsistent` when a course is
 *  BOTH drifting AND noisy — a clear direction is more actionable
 *  information than "it's noisy," and only one label is shown at a time
 *  (this is a classification, not a set of independent flags). */
function classifyTrend(slopePerTerm: number, avgStdDev: number): CohortTrendLabel {
  const cfg = weights.expectedPct;
  if (slopePerTerm >= cfg.trendSlopePerTermThreshold) return 'rising';
  if (slopePerTerm <= -cfg.trendSlopePerTermThreshold) return 'declining';
  if (avgStdDev >= cfg.inconsistencyStdDevThreshold) return 'inconsistent';
  return 'consistent';
}

function trendAdjustmentFor(trend: CohortTrendLabel): number {
  const cfg = weights.expectedPct;
  if (trend === 'rising') return cfg.risingBonus;
  if (trend === 'declining') return -cfg.decliningPenalty;
  if (trend === 'inconsistent') return -cfg.inconsistencyPenalty;
  return 0;
}

export function cohortMeanModeTrend(offerings: CourseOffering[], isUR: boolean): CohortMeanModeTrend | null {
  if (offerings.length === 0) return null;
  const sorted = [...offerings].sort((a, b) => a.year - b.year || a.term.localeCompare(b.term));

  const totalEnrolled = sorted.reduce((s, o) => s + o.enrolled, 0);
  const mean = totalEnrolled > 0
    ? clamp(sorted.reduce((s, o) => s + o.meanPct * o.enrolled, 0) / totalEnrolled, 0, 100)
    : clamp(sorted.reduce((s, o) => s + o.meanPct, 0) / sorted.length, 0, 100);

  // Uses DENSITY (headcount ÷ band width), not raw headcount — see
  // modalLetterByDensity's own doc comment for the real bug this fixes
  // (the grade bands are wildly unequal width, so a raw-count comparison
  // lets the wide F band win purely by being wide, even when the course's
  // real mean sits comfortably in the D/D+ range).
  const scale = isUR ? UR_SCALE : ENG_SCALE;
  const distributionsPresent = sorted.filter(o => o.gradeDistribution).map(o => o.gradeDistribution!);
  const combined = distributionsPresent.length > 0 ? combineDistributions(distributionsPresent) : null;
  const modeLetter = combined ? modalLetterByDensity(combined, scale) : gradeFromPct(mean, isUR).letter;
  const modePct = modeLetter ? (pctForLetter(modeLetter, isUR) ?? mean) : mean;

  let trend: CohortTrendLabel = 'consistent';
  if (sorted.length >= MIN_OFFERINGS_FOR_TREND) {
    const x = sorted.map((_, i) => i);
    const y = sorted.map(o => o.meanPct);
    // Recency-weighted for the same reason every other trend fit in this
    // system is — a course's most recent offerings say more about where
    // its trajectory sits now than one from years back.
    const fit = ols(x, y, recencyWeights(x.length, weights.trend.recencyHalfLife));
    const avgStdDev = sorted.reduce((s, o) => s + o.stdDevPct, 0) / sorted.length;
    trend = classifyTrend(fit.b, avgStdDev);
  }

  return { mean, modeLetter, modePct, trend, trendAdjustment: trendAdjustmentFor(trend) };
}
