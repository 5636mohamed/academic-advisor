// Spec §3.1(b) — the student's OWN ability regression, restricted to
// comparable-category courses (program/faculty vs ur_*) so a run of easy
// LRA marks doesn't distort a projection for a hard core course.
import { EnrollmentRecord, Course, CourseCategory } from '@advisor/shared';
import { ols, project, clamp } from './linearRegression';

const MIN_COMPARABLE_FOR_REGRESSION = 3;
const UR_CATEGORIES: CourseCategory[] = ['ur_core', 'ur_elective'];

function isUrCategory(cat: CourseCategory) {
  return UR_CATEGORIES.includes(cat);
}

export function studentTrendPct(
  targetCourse: Pick<Course, 'category'>,
  history: EnrollmentRecord[],
  courseByCode: Record<string, Pick<Course, 'category'>>
): number | null {
  const targetIsUr = isUrCategory(targetCourse.category);
  const comparable = history
    .filter(r => {
      const c = courseByCode[r.courseCode];
      return c && isUrCategory(c.category) === targetIsUr;
    })
    .sort((a, b) => a.semesterOrdinal - b.semesterOrdinal);

  if (comparable.length < MIN_COMPARABLE_FOR_REGRESSION) {
    // fallback: overall average of ALL comparable-or-not graded courses
    if (history.length === 0) return null; // caller falls back to cohort mean
    return clamp(history.reduce((s, r) => s + r.pct, 0) / history.length, 0, 100);
  }

  const x = comparable.map((_, i) => i);
  const y = comparable.map(r => r.pct);
  const fit = ols(x, y);
  const next = project(fit, comparable.length);
  return clamp(next, 0, 100);
}
