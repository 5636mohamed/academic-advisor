// Spec §1.1 Student entity
export type StudentStatus =
  | 'active' | 'probation' | 'dismissed'
  | 'transferred_internal' | 'transferred_external' | 'graduated';

export interface Student {
  id: string;
  name: string;
  facultyId: string;
  departmentId: string;
  status: StudentStatus;
  activeBaseSnapshotId: string | null; // §7.2.3 anchor
  cumulativeEarnedCredits: number;
  level: number;
  /** Which of the 5 named advisors owns this student's roster slot — see
   *  types/advisor.ts. Every student has exactly one. */
  advisorId: string;
}
