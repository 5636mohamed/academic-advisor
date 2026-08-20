// Real prediction-engine epic — replaces studentTrend.ts's regression-
// projected "student ability" signal with the two real statistics
// explicitly asked for: the student's own mean score and modal (most
// frequently earned) letter grade, both scoped to comparable-category
// history (program/faculty vs ur_*) so a run of easy LRA marks doesn't
// distort a projection for a hard core course — same scoping
// studentTrend.ts already established, kept unchanged since it's sound.
import { EnrollmentRecord, Course, CourseCategory, GradeBand, ENG_SCALE, UR_SCALE } from '@advisor/shared';
import { clamp } from './linearRegression';
import { modalLetter } from './gradeDistribution';

const MIN_COMPARABLE_FOR_MEAN_MODE = 3;
const UR_CATEGORIES: CourseCategory[] = ['ur_core', 'ur_elective'];

function isUrCategory(cat: CourseCategory) {
  return UR_CATEGORIES.includes(cat);
}

export interface StudentMeanMode {
  mean: number; // 0-100
  modeLetter: string | null; // null only if every comparable attempt is somehow tied with no clear winner — modalLetter's own null case
  modePct: number; // modeLetter's band minimum, or `mean` when there's no clear mode (e.g. a single attempt)
}

/** Real bug reported live: a student with a strong recent record could
 *  still land a low expectedPct because the old formula weighted a
 *  regression-projected COHORT number nearly as heavily as the student's
 *  own trend. This function is the new student-side half of the fix — a
 *  student's own real mean and modal grade, not blended with any cohort
 *  signal yet (expectedPct.ts does that blending). */
export function studentMeanAndMode(
  targetCourse: Pick<Course, 'category' | 'isUR'>,
  history: EnrollmentRecord[],
  courseByCode: Record<string, Pick<Course, 'category'>>
): StudentMeanMode | null {
  const targetIsUr = isUrCategory(targetCourse.category);
  const comparable = history.filter(r => {
    const c = courseByCode[r.courseCode];
    return c && isUrCategory(c.category) === targetIsUr;
  });

  // Falls back to ALL graded courses (comparable or not) when there isn't
  // enough comparable-category history yet — same "some real signal beats
  // none" reasoning studentTrend.ts already used, not a new judgment call.
  const pool = comparable.length >= MIN_COMPARABLE_FOR_MEAN_MODE ? comparable : history;
  if (pool.length === 0) return null;

  const mean = clamp(pool.reduce((s, r) => s + r.pct, 0) / pool.length, 0, 100);

  const scale: GradeBand[] = targetCourse.isUR ? UR_SCALE : ENG_SCALE;
  const letterCounts: Record<string, number> = {};
  for (const r of pool) letterCounts[r.letter] = (letterCounts[r.letter] ?? 0) + 1;
  const modeLetter = modalLetter(letterCounts, scale);
  const modePct = modeLetter ? (scale.find(b => b.letter === modeLetter)?.min ?? mean) : mean;

  return { mean, modeLetter, modePct };
}
