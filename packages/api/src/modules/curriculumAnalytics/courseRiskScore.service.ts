// Curriculum Analytics epic — the shared primitive both the Curriculum
// Health Monitor and the Course Bottleneck & Dependency Analyzer are built
// on (see docs/CURRICULUM_ANALYTICS_BLUEPRINT.md). Every input signal here
// is a direct reuse of an existing, already-proven function — nothing here
// re-derives a failure rate or re-walks the prereq graph a second way:
//
//   failureRate      <- passRateFromOfferings()   (prediction/offeringStats.ts)
//   downstreamImpact <- chainUnlockValue()         (prediction/chainUnlockValue.ts)
//   typical class size <- CATEGORY_BASELINE        (db/seed/seedCourseOfferings.ts)
//
// The one genuinely new formula this epic adds is cascadingDelaySemesters —
// an expected-additional-semesters estimate, because "graduation delay" is
// literally what was asked for, not an abstract 0-100 score standing in for
// it. healthScore is the retunable composite built on top of it.
import { Course, CourseOffering, CourseRiskProfile } from '@advisor/shared';
import { chainUnlockValue } from '../prediction/chainUnlockValue';
import { passRateFromOfferings } from '../prediction/offeringStats';
import { CATEGORY_BASELINE } from '../../db/seed/seedCourseOfferings';
import weights from '../../config/predictionWeights.json';

export interface CourseRiskInput {
  course: Course;
  /** This course's own CourseOffering history — OFFERINGS_BY_COURSE[course.code]. */
  offerings: CourseOffering[];
  /** The full cross-department catalog, for chainUnlockValue's own
   *  multi-level prereq walk — matches how chainUnlockValue is already
   *  called everywhere else in this system (the full CATALOG, not a
   *  department-scoped slice), since a shared/UR course's downstream
   *  impact can span departments. */
  catalog: Course[];
  /** This course's forecasted next-term enrolled headcount — from
   *  resourceForecast.service.ts's forecastCourseDemand(). Passed in
   *  rather than recomputed here so this module stays a pure function of
   *  its inputs and never duplicates Feature 1's own OLS-projection logic.
   *  A caller with no forecast handy yet may pass the most recent real
   *  historical `enrolled` count instead — demandPressure degrades
   *  gracefully to "how full did this course historically run," which is
   *  still a meaningful (if less forward-looking) signal. */
  forecastedNextTermEnrolled: number;
  /** Which real department(s) this course belongs to — from
   *  seedCatalog.ts's DEPARTMENTS_BY_COURSE_CODE, NOT course.departmentId
   *  (always null, see that field's own doc comment). Passed in rather
   *  than recomputed here so this stays a pure function of its inputs.
   *  Optional (defaults to `[]`) purely so synthetic test fixtures that
   *  don't care about department filtering don't all need to thread one
   *  through — every real caller in server.ts does pass it. */
  departments?: string[];
}

/** Straight-line interpolation from "1 term to get a retake seat" (today,
 *  every course runs every Fall+Spring — see the blueprint's §5 note on why
 *  there's no real offering-cadence data to regress against yet) up toward
 *  `maxWaitTermsAtSaturation` as demandPressure crosses `saturationThreshold`.
 *  Not a regression — there is nothing to fit a trend line to here, only a
 *  documented assumption about what happens once a course's real demand
 *  meaningfully outruns its typical historical class size. */
function retakeWaitTermsFor(demandPressure: number): number {
  const { saturationThreshold, maxWaitTermsAtSaturation } = weights.curriculumAnalytics.forecast;
  if (demandPressure <= 1) return 1;
  if (demandPressure >= saturationThreshold) return maxWaitTermsAtSaturation;
  const t = (demandPressure - 1) / (saturationThreshold - 1);
  return 1 + t * (maxWaitTermsAtSaturation - 1);
}

export function computeCourseRisk(input: CourseRiskInput): CourseRiskProfile {
  const { course, offerings, catalog, forecastedNextTermEnrolled, departments = [] } = input;

  // Real historical failure rate, pooled across every seeded offering —
  // passRateFromOfferings already falls back sanely (85% pass / 15% fail)
  // for a course with zero offering history, so there's nothing extra to
  // guard here.
  const failureRate = 100 - passRateFromOfferings(offerings);

  // How many courses, decayed by distance, does completing this one
  // unlock — 0 for a genuine leaf course with no dependents.
  const downstreamImpact = chainUnlockValue(course.code, catalog);

  const typicalClassSize = CATEGORY_BASELINE[course.category].classSize;
  const demandPressure = typicalClassSize > 0 ? forecastedNextTermEnrolled / typicalClassSize : 1;

  const retakeWaitTerms = retakeWaitTermsFor(demandPressure);
  // P(a given attempt needs a retake) x how long until a retake seat is
  // realistically available x diminishing-but-real amplification from how
  // many other courses this one gates (log2, not linear — a course gating
  // 8 others is worse than one gating 1, but not literally 8x worse).
  const cascadingDelaySemesters = (failureRate / 100) * retakeWaitTerms * Math.log2(1 + downstreamImpact);

  const h = weights.curriculumAnalytics.health;
  // Every term below is independently capped at contributing at most its
  // own configured weight, same as chainWeight's min(...,1) and
  // delayWeight's min(...,3)/3 already are — demandWeight previously had
  // no such cap, which would have let a heavily-oversubscribed course
  // swing the raw score arbitrarily negative before the final clamp caught
  // it, distorting the relative balance the four weights (which sum to
  // 100) are supposed to guarantee.
  const rawHealth =
    100 -
    h.failureWeight * (failureRate / 100) -
    h.chainWeight * Math.min(downstreamImpact / weights.chainUnlock.depth, 1) -
    h.demandWeight * Math.min(Math.max(demandPressure - 1, 0), 1) -
    h.delayWeight * (Math.min(cascadingDelaySemesters, 3) / 3);
  let healthScore = Math.round(Math.max(0, Math.min(100, rawHealth)) * 10) / 10;

  // Real bug reported live: a leaf course (zero downstream dependents, so
  // chainWeight/delayWeight both contribute nothing — cascadingDelaySemesters
  // is itself 0 whenever downstreamImpact is 0, since it's multiplied by
  // log2(1+downstreamImpact)) can lose AT MOST failureWeight (35) points
  // from the weighted sum above — leaving a course where roughly half of
  // every attempt fails scoring ~82, comfortably above atRiskThreshold and
  // rendered with a green "healthy" badge. A course more than half of
  // students fail is never healthy, full stop, regardless of how isolated
  // it is in the prereq graph — this is a hard ceiling layered ON TOP of
  // the weighted formula (same "explicit override on top of a scored
  // system" shape as §5.2's mandatory-F-retake rule elsewhere in this
  // app), not a replacement for it: `Math.min` means this only ever pulls
  // a score DOWN, a course that already scores worse on its own merits
  // (bad chain position, high demand pressure) is untouched. The ceiling
  // itself keeps sliding down past the threshold (majorityFailCeilingSlope)
  // so a 95%-failure leaf course still reads worse than a 51%-failure one,
  // rather than every majority-fail course collapsing to one tied value.
  if (failureRate >= h.majorityFailThreshold) {
    const overThreshold = failureRate - h.majorityFailThreshold;
    const ceiling = h.majorityFailCeiling - overThreshold * h.majorityFailCeilingSlope;
    healthScore = Math.min(healthScore, Math.round(ceiling * 10) / 10);
  }

  return {
    courseCode: course.code,
    courseName: course.name,
    departmentId: course.departmentId,
    category: course.category,
    isUR: course.isUR,
    isBasicScience: course.isBasicScience,
    departments,
    courseLevel: course.level,
    failureRate: Math.round(failureRate * 10) / 10,
    downstreamImpact: Math.round(downstreamImpact * 100) / 100,
    demandPressure: Math.round(demandPressure * 100) / 100,
    cascadingDelaySemesters: Math.round(cascadingDelaySemesters * 100) / 100,
    healthScore,
  };
}
