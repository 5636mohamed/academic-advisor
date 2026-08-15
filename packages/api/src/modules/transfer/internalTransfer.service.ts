// Spec §7.1 — internal (intra-faculty, department-to-department) transfer.
// Pure function: credits carry over 1:1, transcript is never reset, the
// probation counter is explicitly left UNTOUCHED (spec's own words: "the
// warning counter remains as it is"), and courses that only existed in the
// old department's plan (no equivalent requirement slot in the new one) are
// flagged `excessCredit` — still counted toward the 160-credit graduation
// total, just no longer mapped to a specific requirement slot.
import { CourseCategory, TransferRecord, ProbationCounterLogEntry } from '@advisor/shared';
import { levelFromCredits } from '../grading/level';

export interface PassedCourseForRemap {
  courseCode: string;
  category: CourseCategory;
}

export interface ExecuteInternalTransferInput {
  studentId: string;
  facultyId: string; // unchanged by an internal transfer
  fromDepartmentId: string;
  toDepartmentId: string;
  effectiveSemesterId: string;
  cumulativeEarnedCredits: number; // unchanged — carries over 1:1, spec §7.1
  passedCourses: PassedCourseForRemap[];
  /** Course codes that map to a requirement slot in the NEW department's
   *  curriculum (its own program courses + every shared faculty/school/UR
   *  course, which always remap). Anything passed but NOT in this set is
   *  `excessCredit` per spec §7.1. */
  newDepartmentCourseCodes: Set<string>;
  /** Counter value at the moment of transfer — spec §7.1: "ProbationCounter
   *  is explicitly left untouched," so this is echoed back unchanged in both
   *  the returned state and the audit log (previousCount === newCount). */
  counterCountAtTransfer: number;
}

export interface ExecuteInternalTransferResult {
  departmentId: string;
  level: number; // recalculated from cumulativeEarnedCredits, but credits are unchanged so this is usually a no-op
  excessCreditCourseCodes: string[];
  transferRecord: TransferRecord;
  probationLog: ProbationCounterLogEntry;
}

/** Spec §7.1 `executeInternalTransfer`. Shared/UR/faculty/school courses
 *  remap automatically (they're always in `newDepartmentCourseCodes`);
 *  department-specific `program`-category courses only remap if the new
 *  department's own catalog claims that exact code — anything else becomes
 *  `excessCredit`. */
export function executeInternalTransfer(input: ExecuteInternalTransferInput): ExecuteInternalTransferResult {
  const {
    studentId,
    facultyId,
    fromDepartmentId,
    toDepartmentId,
    effectiveSemesterId,
    cumulativeEarnedCredits,
    passedCourses,
    newDepartmentCourseCodes,
    counterCountAtTransfer,
  } = input;

  const excessCreditCourseCodes = passedCourses
    .filter(c => !newDepartmentCourseCodes.has(c.courseCode))
    .map(c => c.courseCode);

  const transferRecord: TransferRecord = {
    studentId,
    type: 'internal_department',
    fromDepartmentId,
    toDepartmentId,
    fromFacultyId: facultyId,
    toFacultyId: facultyId, // unchanged — this is an intra-faculty move
    effectiveSemesterId,
    counterAction: 'retained',
    recommendationBasis: null,
  };

  // Spec §7.1: "ProbationCounter is explicitly left untouched" — logged as
  // an unchanged entry for the audit trail, not a real state transition.
  const probationLog: ProbationCounterLogEntry = {
    studentId,
    semesterId: effectiveSemesterId,
    previousCount: counterCountAtTransfer,
    newCount: counterCountAtTransfer,
    reason: 'unchanged_internal_transfer',
    createdAt: new Date().toISOString(),
  };

  return {
    departmentId: toDepartmentId,
    level: levelFromCredits(cumulativeEarnedCredits),
    excessCreditCourseCodes,
    transferRecord,
    probationLog,
  };
}
