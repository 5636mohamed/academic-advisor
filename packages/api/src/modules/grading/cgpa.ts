// Spec §2.2 — CGPA computation with the grade-replacement rule (never averaged)
// and base-snapshot awareness (§7.2.3 — CGPA computed only from the active
// Transfer Semester forward once a faculty transfer has happened).
import { CgpaSnapshot, EnrollmentRecord, Course } from '@advisor/shared';

export interface CgpaInput {
  /** All enrollment rows across the student's history, latest attempt already
   *  resolved per course code by the caller (repository layer is expected to
   *  pass one row per course code — the *latest* countsInCgpa=true attempt). */
  latestAttempts: EnrollmentRecord[];
  courseByCode: Record<string, Pick<Course, 'credits'>>;
  /** If set, only enrollments with semesterOrdinal >= this value are counted —
   *  this is how the Transfer Semester becomes the new CGPA anchor (§7.2.3). */
  sinceSemesterOrdinal?: number;
}

export function computeCGPA(input: CgpaInput): number {
  const { latestAttempts, courseByCode, sinceSemesterOrdinal } = input;
  let totalPts = 0;
  let totalCr = 0;
  for (const rec of latestAttempts) {
    if (rec.letter === 'W') continue; // withdrawals excluded entirely
    if (sinceSemesterOrdinal !== undefined && rec.semesterOrdinal < sinceSemesterOrdinal) continue;
    const course = courseByCode[rec.courseCode];
    if (!course) continue;
    totalPts += rec.points * course.credits;
    totalCr += course.credits;
  }
  const cgpa = totalCr > 0 ? totalPts / totalCr : 0;
  return Math.round(cgpa * 100) / 100;
}

/** Resolves a raw list of all attempts (including superseded ones) down to
 *  one row per course code — the latest countsInCgpa attempt — implementing
 *  the handbook's replacement rule at the data layer. */
export function latestAttemptPerCourse(allAttempts: EnrollmentRecord[]): EnrollmentRecord[] {
  const byCode = new Map<string, EnrollmentRecord>();
  for (const rec of allAttempts) {
    if (!rec.countsInCgpa) continue;
    const existing = byCode.get(rec.courseCode);
    if (!existing || rec.attemptNumber > existing.attemptNumber) {
      byCode.set(rec.courseCode, rec);
    }
  }
  return [...byCode.values()];
}

/** Derives a CGPA-snapshot point for EVERY semester the student has actually
 *  recorded a grade in, directly from `allAttempts` — rather than trusting a
 *  separately hand-maintained snapshot list, which is easy to leave sparse
 *  (a demo student can easily have graded attempts in semesters a snapshot
 *  was never authored for). Each point is a genuine "CGPA as of that
 *  semester" recomputation: only attempts that had happened BY that semester
 *  count, and a later retake correctly doesn't retroactively count into an
 *  earlier semester's point (the replacement rule is semester-aware here,
 *  not just "latest overall"). `sinceSemesterOrdinal` mirrors
 *  `getCurrentCgpa`'s own anchor handling so a post-transfer trend line
 *  matches the student's real active CGPA basis. */
export function deriveCgpaTrend(
  allAttempts: EnrollmentRecord[],
  courseByCode: Record<string, Pick<Course, 'credits'>>,
  sinceSemesterOrdinal?: number
): CgpaSnapshot[] {
  const relevant = sinceSemesterOrdinal === undefined ? allAttempts : allAttempts.filter(a => a.semesterOrdinal >= sinceSemesterOrdinal);
  const ordinals = [...new Set(relevant.filter(a => a.countsInCgpa).map(a => a.semesterOrdinal))].sort((a, b) => a - b);

  return ordinals.map((ordinal, i) => {
    const upToHere = relevant.filter(a => a.semesterOrdinal <= ordinal);
    const latestUpToHere = latestAttemptPerCourse(upToHere);
    const cgpa = computeCGPA({ latestAttempts: latestUpToHere, courseByCode, sinceSemesterOrdinal });
    const cumulativeCredits = latestUpToHere.reduce((s, rec) => s + (courseByCode[rec.courseCode]?.credits ?? 0), 0);

    // This semester's own GPA — credits-weighted average of attempts
    // actually recorded in this specific semester (not cumulative).
    const thisSemester = latestAttemptPerCourse(relevant.filter(a => a.semesterOrdinal === ordinal));
    let pts = 0;
    let cr = 0;
    for (const rec of thisSemester) {
      const credits = courseByCode[rec.courseCode]?.credits;
      if (!credits) continue;
      pts += rec.points * credits;
      cr += credits;
    }
    const semesterGpa = cr > 0 ? Math.round((pts / cr) * 100) / 100 : cgpa;

    return {
      semesterId: `derived-sem-${ordinal}`,
      semesterOrdinal: ordinal,
      semesterGpa,
      cgpa,
      cumulativeCredits,
      isBaseSnapshot: i === 0,
    };
  });
}
