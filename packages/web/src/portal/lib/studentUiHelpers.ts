// Small, purely-presentational helpers shared by the redesigned student
// portal pages. Every number here is derived from real API data — nothing
// fabricated — just formatted/labeled to match /UI Design Student/*.pdf.

/** §2.3 level → the same "Nth Year (standing)" phrasing the mockup uses. */
export function levelLabel(level: number): string {
  const YEARS = ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth'];
  const STANDING = ['', 'Freshman', 'Sophomore', 'Junior', 'Senior', 'Senior+'];
  const y = YEARS[level] ?? `${level}th`;
  const s = STANDING[level] ?? '';
  return `${y} Year${s ? ` (${s})` : ''}`;
}

/** Mirrors packages/api/src/modules/grading/level.ts's creditCapFor, minus
 *  the half-load (post-low-first-semester) tier, which isn't exposed on the
 *  student summary DTO — the two tiers that matter for this display
 *  (probation vs. standard) are both derivable from `cgpa` alone. */
export function creditCapDisplay(cgpa: number): { cap: number; reason: string } {
  if (cgpa < 2.0) return { cap: 14, reason: 'Reduced due to probation' };
  return { cap: 20, reason: 'Standard registration limit' };
}

/** §2.1's ENG_SCALE — grades below C (D+, D, F) are what university regulations
 *  "highly encourage repeating" (retake-gate.pdf's own wording). F on record
 *  is a mandatory retake to graduate; D/D+ are recommended, not required. */
export function gradeRecommendation(letter: string): { label: string; tone: 'danger' | 'warn' | 'neutral' } {
  if (letter === 'F') return { label: 'Mandatory Retake', tone: 'danger' };
  if (letter === 'D' || letter === 'D+') return { label: 'Retake Recommended', tone: 'warn' };
  return { label: 'Passed', tone: 'neutral' };
}

/** §1.1 CourseCategory → the plain-English "category tag" the course-plan
 *  roster (course-plan.pdf) shows next to each row. */
export function categoryTag(category: string): string {
  switch (category) {
    case 'core':
    case 'program':
      return 'Core Requirement';
    case 'faculty':
      return 'Faculty Core';
    case 'school':
      return 'School Core';
    case 'ur_core':
      return 'General University';
    case 'ur_elective':
      return 'General Elective';
    case 'program_elective':
      return 'Program Elective';
    default:
      return 'Special';
  }
}

export function letterClass(letter: string) {
  return `su-letter-${letter.replace('+', 'p')}`;
}
