// Spec §1.1 Enrollment / CgpaSnapshot
export interface EnrollmentRecord {
  courseCode: string;
  attemptNumber: number;
  pct: number;
  letter: string;
  points: number;
  isRetake: boolean;
  countsInCgpa: boolean;
  semesterOrdinal: number;
}

export type Transcript = Record<string, EnrollmentRecord>; // latest attempt per code, replacement rule applied

export interface CgpaSnapshot {
  semesterId: string;
  semesterOrdinal: number;
  semesterGpa: number;
  cgpa: number;
  cumulativeCredits: number;
  isBaseSnapshot: boolean;
}
