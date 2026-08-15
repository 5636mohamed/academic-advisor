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
}
