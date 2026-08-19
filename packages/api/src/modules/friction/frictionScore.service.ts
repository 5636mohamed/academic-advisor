// AI Features Blueprint §1.7 — the Friction Score formula.
//
//   frictionScore(week) = sum over milestones that week, across the given
//     course codes, of: baseWeight(type) x courseCreditHours x overlapPenalty
//
//   overlapPenalty = 1 + overlapPenaltyPerExtraMilestone x (milestonesInWeek - 1)
//
// Deadline CLUSTERING is the actual burnout driver, not raw milestone count
// in isolation — two exams in two different weeks is fine, two exams in the
// SAME week is the problem. That's why this multiplies by a penalty that
// only kicks in once a week has more than one milestone, rather than just
// summing weights.
import { MilestoneType, SyllabusMilestone, FrictionReading, FrictionTimeline, FrictionTrendReading } from '@advisor/shared';
import { ols, project, recencyWeights, clamp } from '../prediction/linearRegression';
import weights from '../../config/predictionWeights.json';
import { SEMESTER_WEEKS } from '../../db/seed/seedSyllabusMilestones';

export interface CourseCreditLookup {
  (courseCode: string): number | undefined;
}

/** Pure — every week 1..SEMESTER_WEEKS for the given set of registered
 *  courses, scored from the milestone template. Courses with no seeded
 *  template (shouldn't happen for anything in CATALOG, but defensive
 *  against a bad/unknown code) simply contribute nothing that week rather
 *  than throwing. */
export function weeklyFriction(
  courseCodes: string[],
  milestonesByCourse: Record<string, SyllabusMilestone[]>,
  creditsFor: CourseCreditLookup
): FrictionReading[] {
  const milestoneWeights = weights.friction.milestoneWeights as Record<MilestoneType, number>;
  const readings: FrictionReading[] = [];

  for (let week = 1; week <= SEMESTER_WEEKS; week++) {
    const thisWeek = courseCodes.flatMap(code =>
      (milestonesByCourse[code] ?? []).filter(m => m.weekNumber === week).map(m => ({ ...m, courseCode: code }))
    );
    const overlapPenalty = thisWeek.length > 0 ? 1 + weights.friction.overlapPenaltyPerExtraMilestone * (thisWeek.length - 1) : 1;

    const frictionScore = thisWeek.reduce((sum, m) => {
      const base = milestoneWeights[m.type] ?? 0;
      const credits = creditsFor(m.courseCode) ?? 1;
      return sum + base * credits * overlapPenalty;
    }, 0);

    readings.push({
      weekNumber: week,
      frictionScore: Math.round(frictionScore * 10) / 10,
      burnoutRisk: frictionScore > weights.friction.burnoutThreshold,
      contributingMilestones: thisWeek.map(m => ({ courseCode: m.courseCode, type: m.type, title: m.title })),
    });
  }

  return readings;
}

/** Recency-weighted trend over a computed timeline — same primitive and
 *  same halfLife tuning as studentTrend.ts/cohortTrend.ts (see
 *  linearRegression.ts's recencyWeights doc comment), reused rather than
 *  reimplemented: "is this week's spike part of a rising trend or a
 *  one-off" is the same shape of question as "is this student's grade
 *  trend improving or declining," just over a different y-axis. */
export function frictionTrend(readings: FrictionReading[]): { slope: number | null; reading: FrictionTrendReading } {
  const minPoints = weights.trend.minSnapshotsForTrend;
  if (readings.length < minPoints) return { slope: null, reading: 'insufficient_history' };

  const x = readings.map(r => r.weekNumber);
  const y = readings.map(r => r.frictionScore);
  const { b: slope } = ols(x, y, recencyWeights(x.length, weights.trend.recencyHalfLife));

  let reading: FrictionTrendReading;
  if (slope > weights.trend.improvingSlopeThreshold) reading = 'worsening'; // rising friction = worsening, not "improving"
  else if (slope < weights.trend.decliningSlopeThreshold) reading = 'improving';
  else reading = 'flat';

  return { slope: Math.round(slope * 1000) / 1000, reading };
}

export function buildFrictionTimeline(
  courseCodes: string[],
  milestonesByCourse: Record<string, SyllabusMilestone[]>,
  creditsFor: CourseCreditLookup
): FrictionTimeline {
  const readings = weeklyFriction(courseCodes, milestonesByCourse, creditsFor);
  return { readings, trend: frictionTrend(readings) };
}

/** Only used once, offline (packages/api/scratch/friction-percentile.ts,
 *  not committed — a throwaway script, same pattern as the OLS halfLife
 *  backtest), to pick a real burnoutThreshold from this system's own
 *  seeded data instead of an arbitrary number: every real student's
 *  completed transcript, grouped by the semesterOrdinal each course was
 *  actually completed in (a realistic 4-6-course single-semester load,
 *  NOT the student's whole multi-year transcript flattened into one
 *  14-week template — that inflated the first version of this measurement
 *  by ~10x), scored week-by-week — re-run once more after fixing a second
 *  measurement bug (every course's final exam was hardcoded to the exact
 *  same week 14, which trivially made week 14 the single worst week for
 *  everyone by construction; finals are now jittered across weeks 13-14
 *  like every other milestone type, so exam-period clustering is a real,
 *  varying signal instead of a guaranteed collision). Final numbers: 7,136
 *  non-zero weekly scores across 125 students; median 23.4, 85th
 *  percentile 81.6 -> burnoutThreshold=80 in predictionWeights.json.
 *  Exported purely so a future re-tuning pass (if
 *  the catalog/milestone generator ever changes) can reuse the percentile
 *  helper rather than re-deriving it from scratch. */
export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = clamp(Math.floor(p * (sortedAsc.length - 1)), 0, sortedAsc.length - 1);
  return sortedAsc[idx];
}

export { project };
