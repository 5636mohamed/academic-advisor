// Spec §3.4 — projects (1) the CGPA a recommended plan would yield if grades
// land as expected, and (2) the slope of the student's OWN historical CGPA
// series, which together drive the §4.2 branch decision (show plan vs.
// recommend a department/faculty transfer).
import { CgpaSnapshot } from '@advisor/shared';
import { ols, recencyWeights } from './linearRegression';
import weights from '../../config/predictionWeights.json';

export type TrendReading = 'improving' | 'flat' | 'declining' | 'insufficient_history';

export function projectCGPATrend(snapshots: CgpaSnapshot[]): { slope: number | null; reading: TrendReading } {
  const minPoints = weights.trend.minSnapshotsForTrend;
  if (snapshots.length < minPoints) {
    return { slope: null, reading: 'insufficient_history' };
  }
  const sorted = [...snapshots].sort((a, b) => a.semesterOrdinal - b.semesterOrdinal);
  const x = sorted.map(s => s.semesterOrdinal);
  const y = sorted.map(s => s.cgpa);
  // Recency-weighted so a recent turnaround (or slump) is reflected in the
  // improving/declining call faster than plain OLS would, without letting
  // a single latest snapshot dominate outright (halfLife=5, same tuning as
  // studentTrend/cohortTrend — see recencyWeights' doc comment).
  const { b: slope } = ols(x, y, recencyWeights(x.length, weights.trend.recencyHalfLife));

  let reading: TrendReading;
  if (slope > weights.trend.improvingSlopeThreshold) reading = 'improving';
  else if (slope < weights.trend.decliningSlopeThreshold) reading = 'declining';
  else reading = 'flat';

  return { slope: Math.round(slope * 1000) / 1000, reading };
}

/** Whether a recommended plan, combined with the student's real trajectory,
 *  counts as "improving" for the purposes of the §4.2 branch decision. */
export function isImprovingCase(currentCgpa: number, projectedCgpa: number, trend: { slope: number | null; reading: TrendReading }): boolean {
  const planImproves = projectedCgpa > currentCgpa + 0.01;
  if (trend.reading === 'insufficient_history') return planImproves; // §11 Example L — fail safe, no transfer yet
  return planImproves && trend.reading !== 'declining';
}
