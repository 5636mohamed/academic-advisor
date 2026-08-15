// Spec §7.2.3 — external (inter-faculty) transfer execution: the Transfer
// Semester's GPA becomes the new BASE CGPA (all future computeCGPA() calls
// anchor here, old-faculty history stays in the raw transcript but stops
// factoring into any displayed CGPA), the probation counter resets to 0 and
// goes unarmed (treated exactly like a fresh §4.5 first semester — a
// documented, flagged extension, not a literal handbook rule), and the
// student's level is recalculated from the transferred credit total.
import { CgpaSnapshot, TransferRecord, ProbationCounterState, ProbationCounterLogEntry } from '@advisor/shared';
import { levelFromCredits } from '../grading/level';
import { TransferSemesterPreview } from './transferSemester.builder';

export interface ExecuteExternalTransferInput {
  studentId: string;
  fromFacultyId: string;
  toFacultyId: string;
  toDepartmentId: string;
  transferSemester: TransferSemesterPreview; // built via buildTransferSemester, §7.2.2
  /** Needed only for the audit-log row (previousCount -> 0) — the counter
   *  ITSELF is unconditionally reset by this function regardless of what it
   *  was before, per spec §7.2.3. */
  counterCountBeforeTransfer: number;
}

export interface ExecuteExternalTransferResult {
  facultyId: string;
  departmentId: string;
  level: number;
  activeBaseSnapshot: CgpaSnapshot; // isBaseSnapshot: true — the new anchor, spec §7.2.3
  transferRecord: TransferRecord;
  counter: ProbationCounterState; // { count: 0, armed: false }
  probationLog: ProbationCounterLogEntry;
}

/** Spec §7.2.3 `executeExternalTransfer`. Assumes `transferSemester` was
 *  already built by `buildTransferSemester` (§7.2.2) — this function only
 *  handles turning that preview into the actual state transition (base
 *  snapshot, counter reset, level recompute, TransferRecord). */
export function executeExternalTransfer(input: ExecuteExternalTransferInput): ExecuteExternalTransferResult {
  const { studentId, fromFacultyId, toFacultyId, toDepartmentId, transferSemester, counterCountBeforeTransfer } = input;

  const activeBaseSnapshot: CgpaSnapshot = {
    semesterId: transferSemester.semesterId,
    semesterOrdinal: transferSemester.ordinal,
    semesterGpa: transferSemester.gpa,
    cgpa: transferSemester.gpa, // GPA == CGPA at this fresh anchor point, same as a genuine first semester
    cumulativeCredits: transferSemester.totalCredits,
    isBaseSnapshot: true,
  };

  const transferRecord: TransferRecord = {
    studentId,
    type: 'external_faculty',
    fromFacultyId,
    toFacultyId,
    toDepartmentId,
    effectiveSemesterId: transferSemester.semesterId,
    counterAction: 'reset',
    recommendationBasis: null,
  };

  // Spec §7.2.3: "the warning counter ... would be reset, as the faculty
  // transfer makes the warning reset" — AND treated with the same unarmed
  // rule as §4.5 (arming begins only from the student's next real semester
  // in the new faculty).
  const counter: ProbationCounterState = { studentId, count: 0, armed: false };
  const probationLog: ProbationCounterLogEntry = {
    studentId,
    semesterId: transferSemester.semesterId,
    previousCount: counterCountBeforeTransfer,
    newCount: 0,
    reason: 'reset_faculty_transfer',
    createdAt: new Date().toISOString(),
  };

  return {
    facultyId: toFacultyId,
    departmentId: toDepartmentId,
    level: levelFromCredits(transferSemester.totalCredits),
    activeBaseSnapshot,
    transferRecord,
    counter,
    probationLog,
  };
}
