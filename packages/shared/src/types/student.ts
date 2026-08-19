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
  /** Cold-start recommendation inputs (§ "new Level 1, no records yet"
   *  trial case) — Egyptian Thanaweya Amma (G12) final percentage and
   *  university entrance exam percentage, both 0-100. Optional: only a
   *  brand-new Level 1/semester-1 student with zero completed courses
   *  actually needs these (see coldStart.service.ts) — every other
   *  student's real transcript already carries far more predictive
   *  signal, so these are never used once real grades exist. */
  g12Score?: number;
  entranceExamScore?: number;
}
