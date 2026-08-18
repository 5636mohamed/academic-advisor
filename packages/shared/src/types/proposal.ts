// Spec §15.3 — the course proposal / dual-approval registration workflow.
export type ProposalOrigin = 'system' | 'advisor';
export type ProposalStatus = 'pending' | 'advisor_approved' | 'registered' | 'declined';

export interface CourseProposal {
  id: string;
  studentId: string;
  /** Groups a system proposal with (at most one) advisor alternate for the
   *  same position in the plan — the system's original course code. */
  slotKey: string;
  courseCode: string;
  origin: ProposalOrigin;
  /** Set only when origin === 'advisor': which system course this replaces. */
  replacesCourseCode?: string;
  expectedPct: number;
  expectedLetter: string;
  expectedPoints: number;
  /** §15.2 — the student's own best-ever comparable-category result. */
  bestCasePct: number;
  bestCaseLetter: string;
  bestCasePoints: number;
  advisorApproved: boolean;
  status: ProposalStatus;
  createdAt: string;
  /** Advisor-responsibility epic — set only when origin === 'advisor' AND
   *  this alternate's expectedPoints is <= the system's own recommendation
   *  for the same slot (a genuinely worse-or-equal pick), computed once at
   *  creation time and never re-derived (the system's own recommendation
   *  could theoretically change later; this is a snapshot of the
   *  comparison at the moment the advisor actually made the call). When
   *  true, the advisor had to type their name to confirm — see
   *  acknowledgedByAdvisorName below — and the resulting registration
   *  gets a signed responsibility letter (lib/pdfReport.ts). */
  belowOrEqualSystemGrade?: boolean;
  /** The advisor's typed name from the responsibility-confirmation modal —
   *  only ever set when belowOrEqualSystemGrade is true; a strictly-better
   *  alternate never prompts for this (there's no responsibility to take
   *  on for a recommendation that's better than the system's own). */
  acknowledgedByAdvisorName?: string;
}

/** §15.3.1 — "signed up for, not yet graded." Deliberately separate from
 *  EnrollmentRecord (a completed, graded attempt) — registering a course
 *  never touches CGPA. */
export interface RegisteredCourse {
  studentId: string;
  courseCode: string;
  semesterOrdinal: number;
  proposalId: string;
  registeredAt: string;
}

/** §15.4 — one row per student in the advisor's PDF report. */
export interface AdvisorReportRow {
  studentId: string;
  name: string;
  cgpa: number;
  probationCount: number;
  pendingCount: number;
  advisorApprovedCount: number;
  registeredCount: number;
  /** Advisor-responsibility epic — true if this student has at least one
   *  still-live (not declined) advisor-authored proposal whose expected
   *  grade was below or equal to the system's own recommendation for that
   *  slot. Drives the PDF report's row-highlighting + legend. */
  hasBelowOrEqualAdvisorProposal: boolean;
}
