// Spec §5 — the retake yes/no gate, asked before any course list is shown.
// Splits eligible courses into: fresh courses, optional retakes (D/D+),
// and mandatory retakes (F — always included regardless of the gate answer).
import { Course } from '@advisor/shared';

export interface EligibleCourse {
  course: Course;
  isRetake: boolean;
  oldLetter: string | null;
  oldPoints: number | null;
}

export interface BuildCandidatePoolInput {
  eligible: EligibleCourse[];
  considerRetakes: boolean; // the gate answer, §5
}

export interface CandidatePool {
  pool: EligibleCourse[];      // scored/optimized by the weighted-sum engine
  mandatory: EligibleCourse[]; // F-grade retakes — required to graduate, unscored, reserved first
}

export function buildCandidatePool(input: BuildCandidatePoolInput): CandidatePool {
  const { eligible, considerRetakes } = input;

  const mandatory = eligible.filter(e => e.isRetake && e.oldLetter === 'F');
  const optional = eligible.filter(e => e.isRetake && e.oldLetter !== 'F');
  const fresh = eligible.filter(e => !e.isRetake);

  const pool = considerRetakes ? [...fresh, ...optional] : fresh;
  // §5.2: gate = NO drops optional D/D+ retakes entirely; F retakes are
  // ALWAYS force-included via `mandatory`, regardless of the gate answer.

  return { pool, mandatory };
}
