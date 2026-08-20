// Small pure helper that turns a course's real CourseOffering history
// (seedCourseOfferings.ts) into a real pass-rate/confidence signal —
// instead of the hardcoded 85 placeholder repositoryBackedPorts.ts used
// before real offering data existed. The difficulty-tier classification
// that used to live here was removed as part of the real prediction-
// engine fix — cohortTrend.ts's cohortMeanModeTrend() now derives a
// richer, trend-aware signal (rising/declining/consistent/inconsistent)
// from the same offering history instead of a single static average.
import { CourseOffering } from '@advisor/shared';

/** Real historical pass rate (0-100), pooled across every seeded offering —
 *  falls back to the old neutral 85 only when a course genuinely has no
 *  offering history (shouldn't happen once every CATALOG course is seeded,
 *  but stays defensive). */
export function passRateFromOfferings(offerings: CourseOffering[], fallback = 85): number {
  const totalEnrolled = offerings.reduce((s, o) => s + o.enrolled, 0);
  if (totalEnrolled === 0) return fallback;
  const totalPassed = offerings.reduce((s, o) => s + o.passed, 0);
  return Math.round((totalPassed / totalEnrolled) * 1000) / 10;
}
