// AI Features Blueprint §1.7 — the Friction Score formula.
//
//   frictionScore(week) = sum over NOT-YET-DONE milestones that week, across
//     the given course codes, of: baseWeight(type) x courseCreditHours x overlapPenalty
//
//   overlapPenalty = 1 + overlapPenaltyPerExtraMilestone x (remainingMilestonesInWeek - 1)
//
// Deadline CLUSTERING is the actual burnout driver, not raw milestone count
// in isolation — two exams in two different weeks is fine, two exams in the
// SAME week is the problem. That's why this multiplies by a penalty that
// only kicks in once a week has more than one milestone, rather than just
// summing weights.
//
// "Recalculate week heaviness" (the task-checkbox feature): a milestone the
// student has marked done is excluded from BOTH the weight sum and the
// overlap-penalty count — it no longer contributes to how heavy the week
// feels, and it no longer counts as one of the colliding deadlines driving
// the clustering penalty either (a done task can't collide with anything
// anymore). It's still returned in `contributingMilestones` (with
// `done: true`) so the UI can show the full task list, including what's
// already checked off — only the score itself treats it as gone.
//
// "Move a task a week or two later" (the task-movement feature): only
// MOVABLE_TYPES can move — an assignment/quiz/lab_report is genuinely the
// student's own to reschedule, a midterm/final/project_deadline has a
// real institutional date nobody can just personally defer. `weekOverrides`
// (milestoneId -> new week) relocates a milestone's CONTRIBUTION to that
// week for every score/overlap calculation — it still originates from its
// real course, just counted where the student says they'll actually do it.
import { MilestoneType, SyllabusMilestone, FrictionReading, FrictionTimeline, FrictionTrendReading, TaskMoveRecommendation } from '@advisor/shared';
import { ols, project, recencyWeights, clamp } from '../prediction/linearRegression';
import weights from '../../config/predictionWeights.json';
import { SEMESTER_WEEKS } from '../../db/seed/seedSyllabusMilestones';

export const MOVABLE_MILESTONE_TYPES: MilestoneType[] = ['assignment', 'quiz', 'lab_report'];
export const MAX_MOVE_WEEKS = 2;

export interface CourseCreditLookup {
  (courseCode: string): number | undefined;
}

/** Pure — every week 1..SEMESTER_WEEKS for the given set of registered
 *  courses, scored from the milestone template. Courses with no seeded
 *  template (shouldn't happen for anything in CATALOG, but defensive
 *  against a bad/unknown code) simply contribute nothing that week rather
 *  than throwing. `doneIds` (default empty) excludes those milestones from
 *  the score/overlap-penalty math while still listing them, marked done —
 *  see this file's header for why. `weekOverrides` (default empty)
 *  relocates a milestone to a different week, same section. */
export function weeklyFriction(
  courseCodes: string[],
  milestonesByCourse: Record<string, SyllabusMilestone[]>,
  creditsFor: CourseCreditLookup,
  doneIds: ReadonlySet<string> = new Set(),
  weekOverrides: Readonly<Record<string, number>> = {}
): FrictionReading[] {
  const milestoneWeights = weights.friction.milestoneWeights as Record<MilestoneType, number>;

  // Effective-week membership computed once for the whole set — the
  // override applies regardless of which week we're currently scoring,
  // not re-derived per iteration.
  const allMilestones = courseCodes.flatMap(code => (milestonesByCourse[code] ?? []).map(m => ({ ...m, courseCode: code })));
  const effectiveWeekOf = (m: SyllabusMilestone) => weekOverrides[m.id] ?? m.weekNumber;

  const readings: FrictionReading[] = [];
  for (let week = 1; week <= SEMESTER_WEEKS; week++) {
    const thisWeek = allMilestones.filter(m => effectiveWeekOf(m) === week);
    const remaining = thisWeek.filter(m => !doneIds.has(m.id));
    const overlapPenalty = remaining.length > 0 ? 1 + weights.friction.overlapPenaltyPerExtraMilestone * (remaining.length - 1) : 1;

    const frictionScore = remaining.reduce((sum, m) => {
      const base = milestoneWeights[m.type] ?? 0;
      const credits = creditsFor(m.courseCode) ?? 1;
      return sum + base * credits * overlapPenalty;
    }, 0);

    readings.push({
      weekNumber: week,
      frictionScore: Math.round(frictionScore * 10) / 10,
      burnoutRisk: frictionScore > weights.friction.burnoutThreshold,
      contributingMilestones: thisWeek.map(m => ({ id: m.id, courseCode: m.courseCode, type: m.type, title: m.title, done: doneIds.has(m.id) })),
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
  creditsFor: CourseCreditLookup,
  doneIds: ReadonlySet<string> = new Set(),
  weekOverrides: Readonly<Record<string, number>> = {}
): FrictionTimeline {
  const readings = weeklyFriction(courseCodes, milestonesByCourse, creditsFor, doneIds, weekOverrides);
  return { readings, trend: frictionTrend(readings) };
}

/** For every burnout-risk week, suggest moving ONE movable (assignment/
 *  quiz/lab_report — never an exam/deadline) milestone out of it, to
 *  whichever of the next MAX_MOVE_WEEKS weeks currently has the LOWEST
 *  friction score — a real comparison against those weeks' actual current
 *  readings, not a static rule. Among a burnout week's movable candidates,
 *  picks the LOWEST base-weight one (a quiz before an assignment before a
 *  lab report, per predictionWeights.json's own ordering) — the least
 *  disruptive single move to actually recommend, since moving everything
 *  at once isn't the point (the student can always move more than one). */
export function recommendTaskMoves(
  readings: FrictionReading[],
  milestonesByCourse: Record<string, SyllabusMilestone[]>,
  doneIds: ReadonlySet<string> = new Set()
): TaskMoveRecommendation[] {
  const milestoneWeights = weights.friction.milestoneWeights as Record<MilestoneType, number>;
  const byId = new Map<string, SyllabusMilestone>();
  for (const list of Object.values(milestonesByCourse)) for (const m of list) byId.set(m.id, m);

  const recommendations: TaskMoveRecommendation[] = [];
  for (const reading of readings) {
    if (!reading.burnoutRisk) continue;
    const movableCandidates = reading.contributingMilestones
      .filter(m => !m.done && MOVABLE_MILESTONE_TYPES.includes(m.type))
      .map(m => ({ ...m, weight: milestoneWeights[m.type] ?? 0 }))
      .sort((a, b) => a.weight - b.weight);
    if (movableCandidates.length === 0) continue; // nothing movable this week (e.g. only exams collided)

    const best = movableCandidates[0];
    const template = byId.get(best.id);
    if (!template) continue;

    const candidateWeeks = Array.from({ length: MAX_MOVE_WEEKS }, (_, i) => reading.weekNumber + i + 1).filter(w => w <= SEMESTER_WEEKS);
    if (candidateWeeks.length === 0) continue; // already at/near the end of the semester

    const targetWeek = candidateWeeks.reduce((lightest, w) => {
      const score = readings.find(r => r.weekNumber === w)?.frictionScore ?? Infinity;
      const lightestScore = readings.find(r => r.weekNumber === lightest)?.frictionScore ?? Infinity;
      return score < lightestScore ? w : lightest;
    }, candidateWeeks[0]);

    recommendations.push({
      weekNumber: reading.weekNumber,
      milestoneId: best.id,
      courseCode: best.courseCode,
      title: best.title,
      suggestedNewWeek: targetWeek,
      currentWeekScoreBefore: reading.frictionScore,
      targetWeekScoreBefore: readings.find(r => r.weekNumber === targetWeek)?.frictionScore ?? 0,
    });
  }
  return recommendations;
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
