// Spec §4.1 (increment/dismiss) + §4.4 (mid-window recovery reset).
// This is the single highest-risk piece of logic in the whole system per
// the build roadmap (§14 phase 4) — kept pure/framework-free and covered
// exhaustively by test/unit/probation/*.test.ts (spec §11 Examples D-G).
import { ProbationCounterState, ProbationCounterLogEntry, ProbationLogReason, DISMISSAL_THRESHOLD } from '@advisor/shared';

export interface CloseSemesterInput {
  studentId: string;
  semesterId: string;
  cgpaAtClose: number;
  counter: ProbationCounterState;
}

export interface CloseSemesterResult {
  counter: ProbationCounterState;
  logEntry: ProbationCounterLogEntry | null;
  dismissed: boolean;
}

/** Implements the general (non-first-semester) close routine, spec §4.1.
 *  Must be called with counter.armed === true; §4.5's first-semester rule
 *  (and §7.2.3's Transfer-Semester variant) are the only paths that leave
 *  a counter unarmed, and they call firstSemesterRule.service.ts instead. */
export function onSemesterClose(input: CloseSemesterInput): CloseSemesterResult {
  const { studentId, semesterId, cgpaAtClose, counter } = input;

  if (!counter.armed) {
    // Defensive no-op: an unarmed counter should never reach this function in
    // correct orchestration, but we fail safe rather than silently mutating.
    return { counter, logEntry: null, dismissed: false };
  }

  const previousCount = counter.count;
  let newCount = previousCount;
  let reason: ProbationLogReason | null = null;

  if (cgpaAtClose < 2.00) {
    newCount = previousCount + 1;
    reason = 'increment_low_cgpa';
  } else if (previousCount > 0) {
    newCount = 0;
    reason = 'reset_recovered'; // §4.4 — mid-window recovery, NOT a lifetime tally
  }
  // else: already 0 and still >= 2.00 -> nothing changes, no log row (matches
  // spec §4.1's "else: already 0, nothing to log")

  const nextCounter: ProbationCounterState = { studentId, count: newCount, armed: true };
  const logEntry: ProbationCounterLogEntry | null = reason
    ? { studentId, semesterId, previousCount, newCount, reason, createdAt: new Date().toISOString() }
    : null;

  return {
    counter: nextCounter,
    logEntry,
    dismissed: newCount >= DISMISSAL_THRESHOLD,
  };
}
