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
