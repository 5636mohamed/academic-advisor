// Curriculum Analytics epic, Feature 2 — Curriculum Health Monitor. See
// docs/CURRICULUM_ANALYTICS_BLUEPRINT.md. Every course's risk profile comes
// from courseRiskScore.service.ts's computeCourseRisk() (the shared
// primitive this and the Bottleneck & Dependency Analyzer are both built
// on) — this module's own job is purely the department/faculty-level
// rollup around it, not a second scoring formula.
import { Course, CourseOffering, CurriculumHealthReport } from '@advisor/shared';
import { computeCourseRisk } from './courseRiskScore.service';
import { forecastCourseDemand } from './resourceForecast.service';
import weights from '../../config/predictionWeights.json';

/** `departmentId: null` builds the VP's unscoped, every-department report;
 *  a real departmentId scopes to that one department's own catalog only
 *  (the Advisor route's own-home-department view). `catalog` is always the
 *  FULL cross-department catalog (CATALOG, already deduplicated by code —
 *  see seedCatalog.ts's dedupeByCode) — used directly as the VP's course
 *  list AND passed through to computeCourseRisk's own chainUnlockValue
 *  walk either way, since a shared/UR course's downstream impact can span
 *  departments even when reporting on just one.
 *
 *  Real double-counting risk this deliberately avoids: `catalogByDepartment[
 *  dept]` (ECE_CATALOG etc.) is each department's OWN full requirement
 *  list, which already includes every shared/UR course its students take
 *  — so flattening every department's array together for the VP's
 *  unscoped view would count a course like MTH111 (shared across all 10
 *  programs) ten times over, not once. `catalog` (the already-deduplicated
 *  CATALOG) is the correct, single source of truth for "every real course
 *  in the system" — it's what gets used for departmentId === null, never
 *  a re-flattened-and-hopefully-deduped copy of catalogByDepartment. */
export function buildHealthMonitor(
  departmentId: string | null,
  catalogByDepartment: Record<string, Course[]>,
  catalog: Course[],
  offeringsByCourse: Record<string, CourseOffering[]>,
  // §"categorized, not all shown like that": real department membership
  // for the frontend's filter bar — see seedCatalog.ts's
  // DEPARTMENTS_BY_COURSE_CODE doc comment for why this can't just be
  // course.departmentId (always null). Optional so synthetic test
  // fixtures that don't care about it don't all need to thread one
  // through — server.ts's real caller does pass it.
  departmentsByCourseCode: Record<string, string[]> = {}
): CurriculumHealthReport {
  const scopedCourses = departmentId === null ? catalog : (catalogByDepartment[departmentId] ?? []);

  const allCourses = scopedCourses.map(course => {
    const offerings = offeringsByCourse[course.code] ?? [];
    const forecastedNextTermEnrolled = forecastCourseDemand(course, offerings).nextTermEnrolled;
    const departments = departmentsByCourseCode[course.code] ?? [];
    return computeCourseRisk({ course, offerings, catalog, forecastedNextTermEnrolled, departments });
  });

  const atRiskThreshold = weights.curriculumAnalytics.health.atRiskThreshold;
  const averageHealthScore = allCourses.length > 0
    ? Math.round((allCourses.reduce((s, c) => s + c.healthScore, 0) / allCourses.length) * 10) / 10
    : 100;

  const worstCourses = [...allCourses].sort((a, b) => a.healthScore - b.healthScore).slice(0, 5);

  return {
    departmentId,
    averageHealthScore,
    coursesAtRisk: allCourses.filter(c => c.healthScore < atRiskThreshold).length,
    totalCourses: allCourses.length,
    worstCourses,
    allCourses,
  };
}
