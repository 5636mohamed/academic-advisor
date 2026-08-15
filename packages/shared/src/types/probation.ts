// Spec §4 — probation counter & dismissal state machine types
export type ProbationLogReason =
  | 'increment_low_cgpa'
  | 'reset_recovered'
  | 'reset_faculty_transfer'
  | 'unchanged_internal_transfer'
  | 'not_armed_first_semester';

export interface ProbationCounterState {
  studentId: string;
  count: number;        // 0..6
  armed: boolean;
}

export interface ProbationCounterLogEntry {
  studentId: string;
  semesterId: string;
  previousCount: number;
  newCount: number;
  reason: ProbationLogReason;
  createdAt: string;
}

export const DISMISSAL_THRESHOLD = 6;
