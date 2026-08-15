// Spec §3.1(a) — cohort/peer regression: projects a course's mean score one
// term ahead from its recent CourseOffering history.
import { CourseOffering } from '@advisor/shared';
import { ols, project, clamp } from './linearRegression';

const MIN_OFFERINGS_FOR_REGRESSION = 3;

export function cohortProjectedPct(offerings: CourseOffering[]): number | null {
  if (offerings.length < MIN_OFFERINGS_FOR_REGRESSION) return null; // caller falls back to synthetic seed data
  const sorted = [...offerings].sort((a, b) => a.year - b.year || a.term.localeCompare(b.term));
  const x = sorted.map((_, i) => i);
  const y = sorted.map(o => o.meanPct);
  const fit = ols(x, y);
  const next = project(fit, sorted.length); // one term ahead of the last known term
  return clamp(next, 0, 100);
}
