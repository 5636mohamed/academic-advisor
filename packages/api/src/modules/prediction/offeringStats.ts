// Small pure helpers that turn a course's real CourseOffering history
// (seedCourseOfferings.ts) into the two other real signals expectedPct's
// blend needs — difficulty tier and pass-rate/confidence — instead of the
// hardcoded 'moderate' / 85 placeholders repositoryBackedPorts.ts used
// before real offering data existed.
import { CourseOffering } from '@advisor/shared';
import { DifficultyTier } from './expectedPct';

export function averageMeanPct(offerings: CourseOffering[]): number | null {
  if (offerings.length === 0) return null;
  return offerings.reduce((s, o) => s + o.meanPct, 0) / offerings.length;
}

/** Historically tough (<68 avg) / low-risk (>=82 avg) / moderate otherwise —
 *  same rough thresholds the ENG_SCALE grade bands imply for a "hard vs.
 *  easy" course. */
export function tierFromOfferings(offerings: CourseOffering[]): DifficultyTier['tier'] {
  const avg = averageMeanPct(offerings);
  if (avg === null) return 'moderate';
  if (avg >= 82) return 'low-risk';
  if (avg < 68) return 'historically tough';
  return 'moderate';
}

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
