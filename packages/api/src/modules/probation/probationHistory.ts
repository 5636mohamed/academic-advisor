// Replays a student's real CgpaSnapshot series through the actual §4.1/§4.5
// state-machine functions (onFirstSemesterClose, onSemesterClose) to produce
// a full ProbationCounterLog audit trail — this is what powers the §10.7
// "Probation History" screen's timeline and the `GET /students/:id/probation`
// route's `history[]`. Pure/deterministic: same snapshots in, same counter +
// log out, every time — never a substitute for the real event-sourced log a
// production system would keep from actually closing semesters one at a
// time, but a faithful reconstruction from the data this demo does have.
import { CgpaSnapshot, ProbationCounterState, ProbationCounterLogEntry } from '@advisor/shared';
import { onFirstSemesterClose } from './firstSemesterRule.service';
import { onSemesterClose } from './probationCounter.service';

export interface ProbationHistory {
  counter: ProbationCounterState;
  log: ProbationCounterLogEntry[];
}

export function replayProbationHistory(studentId: string, cgpaSnapshots: CgpaSnapshot[]): ProbationHistory {
  const sorted = [...cgpaSnapshots].sort((a, b) => a.semesterOrdinal - b.semesterOrdinal);
  if (sorted.length === 0) {
    return { counter: { studentId, count: 0, armed: false }, log: [] };
  }

  // Only treat the earliest snapshot as a genuine §4.5 "first semester"
  // (unarmed, doesn't count) when it's actually ordinal 1. A series that
  // starts later (a demo student whose earlier, unmodeled semesters already
  // happened) is assumed already armed throughout — otherwise the earliest
  // AVAILABLE snapshot would incorrectly eat one free low-CGPA semester it
  // was never entitled to.
  const first = sorted[0];
  const isGenuineFirstSemester = first.semesterOrdinal === 1;

  let counter: ProbationCounterState;
  const log: ProbationCounterLogEntry[] = [];
  let remaining = sorted;

  if (isGenuineFirstSemester) {
    const firstResult = onFirstSemesterClose({ studentId, semesterId: first.semesterId, gpaAtClose: first.cgpa });
    log.push(firstResult.logEntry);
    counter = firstResult.counter; // { count: 0, armed: false } — stays this way until semester 2 actually closes
    remaining = sorted.slice(1);
  } else {
    counter = { studentId, count: 0, armed: true };
  }

  // §4.5: "arming happens automatically once semester 2 begins evaluation" —
  // i.e. only once there IS a semester 2 to evaluate. A single-snapshot
  // (first-semester-only) student's counter must still read armed=false.
  let working: ProbationCounterState = { ...counter, armed: true };
  for (const snap of remaining) {
    const result = onSemesterClose({ studentId, semesterId: snap.semesterId, cgpaAtClose: snap.cgpa, counter: working });
    working = result.counter;
    counter = working;
    if (result.logEntry) log.push(result.logEntry);
    if (result.dismissed) break; // §4.1 freeze — no further semesters evaluated
  }

  return { counter, log };
}
