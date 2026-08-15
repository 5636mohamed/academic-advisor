// Spec §4.5 — Level-1 first-semester special case (GPA == CGPA), and the
// §7.2.3 extension applying the SAME unarmed treatment to a faculty
// transfer's Transfer Semester.
import { ProbationCounterState, ProbationCounterLogEntry } from '@advisor/shared';

export interface CloseFirstSemesterInput {
  studentId: string;
  semesterId: string;
  gpaAtClose: number; // == cgpa, since it's the only semester on record
}

export interface CloseFirstSemesterResult {
  counter: ProbationCounterState;   // always { count: 0, armed: false }
  logEntry: ProbationCounterLogEntry;
  nextSemesterCreditCap: 16 | 20;   // half-load trigger, §2.4
}

export function onFirstSemesterClose(input: CloseFirstSemesterInput): CloseFirstSemesterResult {
  const { studentId, semesterId, gpaAtClose } = input;

  const counter: ProbationCounterState = { studentId, count: 0, armed: false };
  const logEntry: ProbationCounterLogEntry = {
    studentId,
    semesterId,
    previousCount: 0,
    newCount: 0,
    reason: 'not_armed_first_semester',
    createdAt: new Date().toISOString(),
  };

  return {
    counter,
    logEntry,
    nextSemesterCreditCap: gpaAtClose < 2.00 ? 16 : 20,
  };
}

/** §7.2.3 — a Transfer Semester (external/faculty transfer) is treated with
 *  the same "fresh GPA==CGPA start, unarmed" logic as a genuine first
 *  semester. Arming begins from the student's NEXT real semester in the new
 *  faculty, mirroring §4.5 exactly. This is a documented design extension,
 *  not an explicit rule from the original request — flagged in spec §7.2.3. */
export function onTransferSemesterClose(input: CloseFirstSemesterInput): CloseFirstSemesterResult {
  return onFirstSemesterClose(input);
}
