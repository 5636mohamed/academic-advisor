// Spec §7.2.1/§7.2.2 — builds the "Transfer Semester": the set of a
// student's already-passed LRA/UR + basic-science courses that carry over
// into the new faculty, filtered by whether a `CourseEquivalencyMap` row
// exists for each one. This is a pure function — no DB access — so it can
// be unit-tested directly (spec §11 Example K) and reused both by the
// `/transfer/preview` dry-run route and the real `/transfer/external` commit.
import { CourseCategory } from '@advisor/shared';
import { CourseEquivalencyEntry, equivalencyExists } from './courseEquivalency';

export interface TransferableCourseCandidate {
  courseCode: string;
  category: CourseCategory;
  isBasicScience: boolean;
  credits: number;
  pct: number;
  letter: string;
  points: number;
}

/** Spec §7.2.1 — `transferableCourses(student)`: passed LRA/UR courses
 *  (`ur_core`/`ur_elective`) OR courses flagged `isBasicScience` (shared
 *  Math/Physics/Chemistry/Intro-Programming, §7.2.1's "basic science
 *  subjects"). This is the eligibility filter BEFORE the equivalency check —
 *  a course can be transferable-category but still excluded from the actual
 *  Transfer Semester if no equivalency row exists for the target faculty. */
export function transferableCourses(passedCourses: TransferableCourseCandidate[]): TransferableCourseCandidate[] {
  return passedCourses.filter(c => c.category === 'ur_core' || c.category === 'ur_elective' || c.isBasicScience);
}

export interface TransferredCourseLine {
  courseCode: string;
  mappedToCourseCode: string | null; // null = waived/free-elective credit only
  pct: number;
  letter: string;
  points: number;
  credits: number;
}

export interface ExcludedCourseLine {
  courseCode: string;
  reason: 'no_equivalency';
}

export interface BuildTransferSemesterInput {
  toFacultyId: string;
  semesterId: string;
  ordinal: number;
  passedCourses: TransferableCourseCandidate[];
  equivalencyMap: CourseEquivalencyEntry[];
}

export interface TransferSemesterPreview {
  semesterId: string;
  ordinal: number;
  transferredCourses: TransferredCourseLine[];
  excludedCourses: ExcludedCourseLine[];
  gpa: number; // spec §7.2.2 — weighted-sum over just these courses' points*credits
  totalCredits: number;
}

/** Spec §7.2.2 `buildTransferSemester` — pure preview/build function. The
 *  caller (§7.2.3's `executeExternalTransfer` or the `/transfer/preview`
 *  route) decides whether this is just shown to the student or actually
 *  persisted as a `Semester{kind:'transfer_semester'}` + `CgpaSnapshot`. */
export function buildTransferSemester(input: BuildTransferSemesterInput): TransferSemesterPreview {
  const { toFacultyId, semesterId, ordinal, passedCourses, equivalencyMap } = input;
  const eligible = transferableCourses(passedCourses);

  const transferredCourses: TransferredCourseLine[] = [];
  const excludedCourses: ExcludedCourseLine[] = [];

  for (const course of eligible) {
    const entry = equivalencyMap.find(
      e => e.sourceCourseCode === course.courseCode && e.targetFacultyId === toFacultyId
    );
    if (!entry) {
      // No equivalency row at all -> does not transfer, spec §7.2.2 /
      // §12 "silently-but-visibly" (visible in `excludedCourses`, never a crash).
      excludedCourses.push({ courseCode: course.courseCode, reason: 'no_equivalency' });
      continue;
    }
    transferredCourses.push({
      courseCode: course.courseCode,
      mappedToCourseCode: entry.targetCourseCode, // may be null = waived/free-elective
      pct: course.pct,
      letter: course.letter,
      points: course.points,
      credits: course.credits,
    });
  }

  const totalPts = transferredCourses.reduce((s, c) => s + c.points * c.credits, 0);
  const totalCredits = transferredCourses.reduce((s, c) => s + c.credits, 0);
  const gpa = totalCredits > 0 ? Math.round((totalPts / totalCredits) * 100) / 100 : 0;

  return { semesterId, ordinal, transferredCourses, excludedCourses, gpa, totalCredits };
}

// Re-export for callers that only need the equivalency check itself.
export { equivalencyExists };
