// Curriculum Analytics epic, Feature 1 — Academic Resource Demand
// Forecasting. See docs/CURRICULUM_ANALYTICS_BLUEPRINT.md. Reuses the same
// weighted-OLS trend machinery (ols/recencyWeights/project) every other
// trend projection in this system already uses (cgpaTrendProjection.ts,
// cohortTrend.ts, studentTrend.ts) — this is a new SERIES to project
// (enrolled headcount instead of a grade percentage), not new math.
import { Course, CourseOffering, DemandForecast, DepartmentDemandForecast } from '@advisor/shared';
import { ols, recencyWeights, project, clamp } from '../prediction/linearRegression';
import { CATEGORY_BASELINE } from '../../db/seed/seedCourseOfferings';
import weights from '../../config/predictionWeights.json';

/** Standard deviation of the fit's own residuals — an honest uncertainty
 *  band derived from how well the line actually matched history, not a
 *  fabricated fixed +/- number. 0 for <2 points (nothing to measure
 *  spread against). */
function residualStdDev(x: number[], y: number[], fit: { a: number; b: number }): number {
  if (x.length < 2) return 0;
  const residuals = x.map((xi, i) => y[i] - (fit.a + fit.b * xi));
  const mean = residuals.reduce((s, r) => s + r, 0) / residuals.length;
  const variance = residuals.reduce((s, r) => s + (r - mean) ** 2, 0) / residuals.length;
  return Math.sqrt(variance);
}

export function forecastCourseDemand(course: Course, offerings: CourseOffering[]): DemandForecast {
  const chronological = [...offerings].sort((a, b) => a.year - b.year || a.term.localeCompare(b.term));
  const x = chronological.map((_, i) => i);
  const y = chronological.map(o => o.enrolled);

  const typicalClassSize = CATEGORY_BASELINE[course.category].classSize;
  const fit = ols(x, y, recencyWeights(x.length, weights.trend.recencyHalfLife));
  const rawNext = x.length > 0 ? project(fit, x.length) : typicalClassSize;
  const nextTermEnrolled = Math.round(clamp(rawNext, 0, typicalClassSize * 3));
  const confidenceBand = Math.round(residualStdDev(x, y, fit));

  const forecastedSections = typicalClassSize > 0 ? Math.max(1, Math.ceil(nextTermEnrolled / typicalClassSize)) : 1;

  return {
    courseCode: course.code,
    courseName: course.name,
    departmentId: course.departmentId,
    history: chronological.map(o => ({ term: o.term, year: o.year, enrolled: o.enrolled })),
    nextTermEnrolled,
    confidenceBand,
    forecastedSections,
    forecastedSeatsNeeded: nextTermEnrolled,
    // 1:1 with sections — explicitly an assumption (see the shared type's
    // own doc comment): this app has no real Instructor entity to draw a
    // genuine staffing figure from.
    forecastedInstructorLoad: forecastedSections,
    trendSlope: Math.round(fit.b * 100) / 100,
  };
}

export function forecastDepartmentDemand(
  departmentId: string,
  departmentCatalog: Course[],
  offeringsByCourse: Record<string, CourseOffering[]>
): DepartmentDemandForecast {
  const courses = departmentCatalog.map(c => forecastCourseDemand(c, offeringsByCourse[c.code] ?? []));
  return {
    departmentId,
    totalNextTermEnrolled: courses.reduce((s, c) => s + c.nextTermEnrolled, 0),
    totalForecastedSections: courses.reduce((s, c) => s + c.forecastedSections, 0),
    totalForecastedInstructorLoad: courses.reduce((s, c) => s + c.forecastedInstructorLoad, 0),
    courses,
  };
}

export function forecastAllDepartments(
  catalogByDepartment: Record<string, Course[]>,
  offeringsByCourse: Record<string, CourseOffering[]>
): DepartmentDemandForecast[] {
  return Object.keys(catalogByDepartment).map(deptId =>
    forecastDepartmentDemand(deptId, catalogByDepartment[deptId], offeringsByCourse)
  );
}
