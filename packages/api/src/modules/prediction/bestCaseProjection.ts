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

/** §15.2's `bestCasePct` pseudocode: max comparable-category pct, else max
 *  overall pct, else fall back to the given `expectedPct` (a brand-new
 *  student has nothing of their own to be optimistic against).
 *
 *  Every real caller already passes this course's own live §3.1
 *  `expectedPct` as that argument — not just for the brand-new-student
 *  fallback case, but as this course's realistic prediction, full stop. So
 *  it doubles as a floor: "best case" is a peak-performance CEILING over
 *  the realistic expectation, never a floor under it. Without this, a
 *  student whose own historical best in a comparable category happens to
 *  be mediocre (or outright failing) could see a course whose *realistic*
 *  expected grade is fine but whose "best case" reads as an F — a genuinely
 *  confusing, apparently-broken-looking pairing reported directly against
 *  live data, even though each number was individually correct for what it
 *  measures. Clamping keeps bestCasePct >= expectedPct always, so the UI
 *  never has to explain why "best case" looks worse than "expected". */
export function bestCasePct(
  targetCourse: Pick<Course, 'category' | 'isUR'>,
  history: EnrollmentRecord[],
  courseByCode: Record<string, Pick<Course, 'category'>>,
  expectedPct: number
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
    pct = expectedPct;
  }
  pct = Math.max(pct, expectedPct);

  const band = gradeFromPct(pct, targetCourse.isUR);
  return { bestCasePct: pct, bestCaseLetter: band.letter, bestCasePoints: band.pts };
}
