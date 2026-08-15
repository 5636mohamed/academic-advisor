// Spec §15.2 — the "peak performance" grade projection: not a regression,
// literally the student's own best-ever result in a comparable-category
// course, turned into a letter/points via the normal grade scale. Shown
// alongside (never instead of) §3.1's realistic expectedPct.
import { EnrollmentRecord, Course, CourseCategory, gradeFromPct } from '@advisor/shared';

const UR_CATEGORIES: CourseCategory[] = ['ur_core', 'ur_elective'];
const isUrCategory = (cat: CourseCategory) => UR_CATEGORIES.includes(cat);

export interface BestCaseResult {
  bestCasePct: number;
  bestCaseLetter: string;
  bestCasePoints: number;
}

/** §15.2's `bestCasePct` pseudocode, exactly: max comparable-category pct,
 *  else max overall pct, else fall back to the given `fallbackExpectedPct`
 *  (a brand-new student has nothing of their own to be optimistic against). */
export function bestCasePct(
  targetCourse: Pick<Course, 'category' | 'isUR'>,
  history: EnrollmentRecord[],
  courseByCode: Record<string, Pick<Course, 'category'>>,
  fallbackExpectedPct: number
): BestCaseResult {
  const targetIsUr = isUrCategory(targetCourse.category);
  const comparable = history.filter(r => {
    const c = courseByCode[r.courseCode];
    return c && isUrCategory(c.category) === targetIsUr;
  });

  let pct: number;
  if (comparable.length > 0) {
    pct = Math.max(...comparable.map(r => r.pct));
  } else if (history.length > 0) {
    pct = Math.max(...history.map(r => r.pct));
  } else {
    pct = fallbackExpectedPct;
  }

  const band = gradeFromPct(pct, targetCourse.isUR);
  return { bestCasePct: pct, bestCaseLetter: band.letter, bestCasePoints: band.pts };
}
