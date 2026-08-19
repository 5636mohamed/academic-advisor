// Spec §3.1(a) — cohort/peer regression: projects a course's mean score one
// term ahead from its recent CourseOffering history.
import { CourseOffering } from '@advisor/shared';
import { ols, project, clamp, recencyWeights } from './linearRegression';
import weights from '../../config/predictionWeights.json';

const MIN_OFFERINGS_FOR_REGRESSION = 3;

export function cohortProjectedPct(offerings: CourseOffering[]): number | null {
  if (offerings.length < MIN_OFFERINGS_FOR_REGRESSION) return null; // caller falls back to synthetic seed data
  const sorted = [...offerings].sort((a, b) => a.year - b.year || a.term.localeCompare(b.term));
  const x = sorted.map((_, i) => i);
  const y = sorted.map(o => o.meanPct);
  // Recency-weighted for the same reason as studentTrend.ts — a course's
  // most recent offerings say more about where its difficulty/mean sits
  // now than an offering from years back.
  const fit = ols(x, y, recencyWeights(x.length, weights.trend.recencyHalfLife));
  const next = project(fit, sorted.length); // one term ahead of the last known term
  return clamp(next, 0, 100);
}
