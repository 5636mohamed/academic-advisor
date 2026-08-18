// Spec §16 — Innovation & Venture Catalyst.
export type VentureProjectType = 'academic_research' | 'commercial_spinoff';
export type VentureMatchStatus = 'suggested' | 'applied' | 'accepted' | 'declined';

export interface ProfessorProfile {
  id: string;
  facultyId: string;
  departmentId: string;
  name: string;
  researchTags: string[];
  acceptingUndergrads: boolean;
}

/** VP epic — the "research portal" fields an advisor (or the VP, posting
 *  the same way) can optionally attach to a project, letting the Venture
 *  Board also surface real published research, not just open positions. */
export interface VentureAuthor {
  name: string;
  link?: string;
}

export interface VentureProject {
  id: string;
  professorId: string;
  title: string;
  description: string;
  type: VentureProjectType;
  requiredCourseCodes: string[];
  preferredSkills: string[];
  capacity: number;
  isActive: boolean;
  createdAt: string;
  /** All optional — a project can be posted as a plain open position with
   *  none of these, exactly as before this epic. */
  authors?: VentureAuthor[];
  publishedPaperUrl?: string;
  conferenceName?: string;
  impactFactor?: number;
  labName?: string;
  /** Graduation Project epic — marks this venture as a student capstone
   *  project rather than a faculty-initiated one. Deliberately orthogonal
   *  to `type`, not a third value of it: a graduation project can pursue
   *  either an `academic_research` outcome (feeds a paper/thesis) or a
   *  `commercial_spinoff` one (feeds a startup) — `type` already captures
   *  which track, this flag just says the project originates as someone's
   *  graduation project either way. Optional/undefined = a regular
   *  faculty-posted venture, same as every project before this epic. */
  isGraduationProject?: boolean;
}

export interface StudentVentureMatch {
  id: string;
  studentId: string;
  ventureProjectId: string;
  matchScore: number; // 0-1, §3.5 ventureFitScore output
  status: VentureMatchStatus;
  createdAt: string;
  /** §16.4 — attached when the student expresses interest, optional but
   *  encouraged. Stored as a data: URL (base64) — this demo has no file
   *  storage/CDN, so the CV lives directly on the match row, same "small,
   *  honest stand-in" philosophy as the rest of the in-memory store. */
  cvFileName?: string;
  cvDataUrl?: string;
}

/** §3.5's three sub-scores, always returned alongside `matchScore` so the
 *  UI can render the breakdown bar (course competency / skill alignment /
 *  academic trajectory) the same way §6's dept-fit cards already do. */
export interface VentureFitBreakdown {
  total: number;
  courseCompetencyScore: number;
  skillAlignmentScore: number;
  academicTrajectoryScore: number;
}

export interface VentureMatchResult extends VentureFitBreakdown {
  project: VentureProject;
  matchId: string | null; // null until a StudentVentureMatch row has been persisted (§16.2)
  status: VentureMatchStatus | 'unscored'; // 'unscored' = below threshold, never persisted
}
