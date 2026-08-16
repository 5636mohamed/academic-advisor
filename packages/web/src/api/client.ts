// Typed fetch client for every route this frontend calls. Talks to the
// Express demo server (packages/api/src/server.ts) via the /api proxy set
// up in vite.config.ts. Deliberately plain fetch + small helpers rather
// than a data-fetching library — keeps the surface easy to read alongside
// the routes it calls.
import { EnrollmentRecord, CgpaSnapshot, ProbationCounterState, ProbationCounterLogEntry, Course } from '@advisor/shared';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  }
  return res.json();
}

export interface StudentSummary {
  id: string;
  name: string;
  facultyId: string;
  departmentId: string;
  level: number;
  status: string;
  cgpa: number;
  probationCounter: ProbationCounterState;
}

export interface TransferRecordDTO {
  studentId: string;
  type: 'internal_department' | 'external_faculty';
  fromDepartmentId?: string;
  toDepartmentId?: string;
  fromFacultyId?: string;
  toFacultyId?: string;
  effectiveSemesterId?: string;
  counterAction: 'retained' | 'reset';
}

// §15.3.1 — one row per graded attempt OR registered-but-ungraded course,
// merged and sorted by semester (see the API's getTranscriptWithRegistered
// doc comment). `status: 'registered'` rows have every grade field null.
export type TranscriptRowStatus = 'completed' | 'registered';
export interface TranscriptRowDTO {
  courseCode: string;
  semesterOrdinal: number;
  status: TranscriptRowStatus;
  attemptNumber: number | null;
  pct: number | null;
  letter: string | null;
  points: number | null;
  isRetake: boolean;
  countsInCgpa: boolean;
  registeredAt: string | null;
}

export interface StudentDetail extends StudentSummary {
  activeBaseSnapshotId: string | null;
  transcript: TranscriptRowDTO[];
  cgpaSnapshots: CgpaSnapshot[];
  quizAnswers: Record<string, string>;
  transferRecords: TransferRecordDTO[];
}

// The full catalog, one row per course, annotated with this student's
// status on it — backs the per-semester Curriculum tab.
export type CurriculumCourseStatus = 'passed' | 'needs_retake' | 'registered' | 'eligible' | 'locked';
export interface CurriculumCourseDTO {
  course: Course;
  status: CurriculumCourseStatus;
  letter: string | null;
  pct: number | null;
  points: number | null;
  attemptNumber: number | null;
  registeredAt: string | null;
}

export interface EligibleCourseDTO {
  course: { code: string; name: string; credits: number; category: string };
  isRetake: boolean;
  oldLetter: string | null;
  oldPoints: number | null;
}

export interface DeptFitResultDTO {
  id: string;
  name: string;
  total: number;
  quizScore: number;
  gwScore: number;
  alumScore: number;
}

export interface PlanCourseDTO {
  courseCode: string;
  isRetake: boolean;
  oldPoints: number | null;
  expectedPct: number;
  expectedLetter: string;
  expectedPoints: number;
  deltaPts: number | null;
  chainUnlockValue: number;
  passRate: number;
  score: number;
  mandatory: boolean;
  /** §15.2 — the student's own best-ever comparable-category result. */
  bestCasePct: number;
  bestCaseLetter: string;
  bestCasePoints: number;
}

export interface AdvisingActionDTO {
  action: 'SHOW_PLAN' | 'RECOMMEND_INTERNAL_TRANSFER' | 'RECOMMEND_FACULTY_TRANSFER';
  plan: PlanCourseDTO[];
  projectedCGPA: number;
  trendSlope: number | null;
  explain: string;
  suggestedDepartmentId?: string;
  suggestedFaculties?: DeptFitResultDTO[];
  // Product-owner decision: project/venture recommendations only ever show
  // on the Venture Board — /advise's response no longer carries one (see
  // server.ts). No `ventureMatch` field here on purpose.
}

export interface QuizQuestionDTO {
  id: string;
  text: string;
  options: Array<{ id: string; label: string; traitTags: string[] }>;
}

// §15.3 — course proposal / dual-approval registration workflow
export type ProposalOrigin = 'system' | 'advisor';
export type ProposalStatus = 'pending' | 'advisor_approved' | 'registered' | 'declined';

export interface CourseProposalDTO {
  id: string;
  studentId: string;
  slotKey: string;
  courseCode: string;
  origin: ProposalOrigin;
  replacesCourseCode?: string;
  expectedPct: number;
  expectedLetter: string;
  expectedPoints: number;
  bestCasePct: number;
  bestCaseLetter: string;
  bestCasePoints: number;
  advisorApproved: boolean;
  status: ProposalStatus;
  createdAt: string;
}

export interface RegisteredCourseDTO {
  studentId: string;
  courseCode: string;
  semesterOrdinal: number;
  proposalId: string;
  registeredAt: string;
}

export interface AdvisorReportRowDTO {
  studentId: string;
  name: string;
  cgpa: number;
  probationCount: number;
  pendingCount: number;
  advisorApprovedCount: number;
  registeredCount: number;
}

export interface ChooseProposalResultDTO {
  proposal: CourseProposalDTO;
  registered: boolean;
  requiresAdvisorContact: boolean;
}

export interface ProposalsWithImpactDTO {
  proposals: CourseProposalDTO[];
  expectedProjectedCGPA: number;
  bestCaseProjectedCGPA: number;
}

// Dry-run preview of an advisor-proposed alternate's expected/best-case
// grade, scored live but never persisted — lets the advisor see the
// consequence of a swap before committing to proposing it.
export interface AlternateScorePreviewDTO {
  courseCode: string;
  expectedPct: number;
  expectedLetter: string;
  expectedPoints: number;
  bestCasePct: number;
  bestCaseLetter: string;
  bestCasePoints: number;
}

// §16 — Innovation & Venture Catalyst
export type VentureProjectType = 'academic_research' | 'commercial_spinoff';
export type VentureMatchStatus = 'suggested' | 'applied' | 'accepted' | 'declined' | 'unscored';

export interface VentureProjectDTO {
  id: string;
  professorId: string;
  /** Enriched at the API boundary (server.ts's withProfessorName) — not
   *  part of the core VentureProject domain type. */
  professorName?: string;
  title: string;
  description: string;
  type: VentureProjectType;
  requiredCourseCodes: string[];
  preferredSkills: string[];
  capacity: number;
  isActive: boolean;
  createdAt: string;
}

export interface VentureMatchResultDTO {
  project: VentureProjectDTO;
  matchId: string | null;
  status: VentureMatchStatus;
  total: number;
  courseCompetencyScore: number;
  skillAlignmentScore: number;
  academicTrajectoryScore: number;
}

export interface VentureQuizQuestionDTO {
  id: string;
  text: string;
  options: Array<{ id: string; label: string; traitTags: string[] }>;
}

export interface ProfessorSummaryDTO {
  id: string;
  facultyId: string;
  departmentId: string;
  name: string;
  researchTags: string[];
  acceptingUndergrads: boolean;
}

export interface ProfessorDetailDTO extends ProfessorSummaryDTO {
  projects: VentureProjectDTO[];
}

export interface VentureCandidateDTO {
  studentId: string;
  studentName: string;
  matchId: string | null;
  status: VentureMatchStatus;
  total: number;
  courseCompetencyScore: number;
  skillAlignmentScore: number;
  academicTrajectoryScore: number;
  /** §16.4/§16.6 — present once the student has expressed interest with a CV attached. */
  cvFileName?: string;
  cvDataUrl?: string;
}

export interface AdvisorVentureProjectRowDTO {
  project: VentureProjectDTO;
  candidates: VentureCandidateDTO[];
  acceptedCount: number;
  pendingCount: number;
}

export const api = {
  listStudents: () => request<StudentSummary[]>('/students'),
  getStudent: (id: string) => request<StudentDetail>(`/students/${id}`),
  getEligibleCourses: (id: string) => request<EligibleCourseDTO[]>(`/students/${id}/eligible-courses`),
  getCurriculum: (id: string) => request<CurriculumCourseDTO[]>(`/students/${id}/curriculum`),
  enroll: (id: string, courseCode: string, pct: number, semesterOrdinal: number) =>
    request<{ newCgpa: number; recordedAttempt: EnrollmentRecord }>(`/students/${id}/enroll`, {
      method: 'POST',
      body: JSON.stringify({ courseCode, pct, semesterOrdinal }),
    }),
  setRetakePreference: (id: string, considerRetakes: boolean) =>
    request<{ ok: true; considerRetakes: boolean }>(`/students/${id}/retake-preference`, {
      method: 'POST',
      body: JSON.stringify({ considerRetakes }),
    }),
  setQuizAnswers: (id: string, answers: Record<string, string>) =>
    request<{ ok: true; quizAnswers: Record<string, string> }>(`/students/${id}/quiz`, {
      method: 'POST',
      body: JSON.stringify(answers),
    }),
  advise: (id: string) => request<AdvisingActionDTO>(`/students/${id}/advise`, { method: 'POST' }),
  planFast: (id: string) => request<unknown>(`/students/${id}/plan/fast`),
  planTarget: (id: string, cgpa: number) => request<unknown>(`/students/${id}/plan/target?cgpa=${cgpa}`),
  departmentFit: (id: string) => request<DeptFitResultDTO[]>(`/students/${id}/department-fit`),
  facultyFit: (id: string) => request<DeptFitResultDTO[]>(`/students/${id}/faculty-fit`),
  probation: (id: string) => request<{ count: number; armed: boolean; history: ProbationCounterLogEntry[] }>(`/students/${id}/probation`),
  cgpaTrend: (id: string) =>
    request<{ snapshots: CgpaSnapshot[]; trendSlope: number | null; reading: string }>(`/students/${id}/cgpa-trend`),
  transferInternal: (id: string, toDepartmentId: string) =>
    request<unknown>(`/students/${id}/transfer/internal`, { method: 'POST', body: JSON.stringify({ toDepartmentId }) }),
  transferExternal: (id: string, toFacultyId: string, toDepartmentId: string) =>
    request<unknown>(`/students/${id}/transfer/external`, {
      method: 'POST',
      body: JSON.stringify({ toFacultyId, toDepartmentId }),
    }),
  transferPreview: (id: string, toFacultyId: string) =>
    request<{
      transferredCourses: Array<{ courseCode: string; mappedToCourseCode: string | null; pct: number; letter: string; credits: number }>;
      excludedCourses: Array<{ courseCode: string; reason: string }>;
      gpa: number;
      totalCredits: number;
    }>(`/students/${id}/transfer/preview?toFacultyId=${toFacultyId}`),
  courseChain: (code: string) => request<{ courseCode: string; chainUnlockValue: number; directUnlocks: string[] }>(`/courses/${code}/chain`),
  quiz: () => request<QuizQuestionDTO[]>('/quiz'),
  faculties: () => request<Array<{ id: string; name: string }>>('/faculties'),
  facultyDepartments: (facultyId: string) => request<Array<{ id: string; name: string }>>(`/faculties/${facultyId}/departments`),
  // §15.3 proposal / approval workflow
  generateProposals: (id: string) => request<ProposalsWithImpactDTO>(`/students/${id}/proposals/generate`, { method: 'POST' }),
  getProposals: (id: string) => request<ProposalsWithImpactDTO>(`/students/${id}/proposals`),
  approveProposal: (proposalId: string) => request<CourseProposalDTO>(`/advisor/proposals/${proposalId}/approve`, { method: 'POST' }),
  declineProposal: (proposalId: string) => request<CourseProposalDTO>(`/advisor/proposals/${proposalId}/decline`, { method: 'POST' }),
  proposeAlternate: (studentId: string, slotKey: string, courseCode: string) =>
    request<CourseProposalDTO>(`/advisor/students/${studentId}/proposals/${slotKey}/alternate`, {
      method: 'POST',
      body: JSON.stringify({ courseCode }),
    }),
  previewAlternate: (studentId: string, slotKey: string, courseCode: string) =>
    request<AlternateScorePreviewDTO>(`/advisor/students/${studentId}/proposals/${slotKey}/alternate/preview`, {
      method: 'POST',
      body: JSON.stringify({ courseCode }),
    }),
  chooseProposal: (studentId: string, proposalId: string) =>
    request<ChooseProposalResultDTO>(`/students/${studentId}/proposals/${proposalId}/choose`, { method: 'POST' }),
  registeredCourses: (id: string) => request<RegisteredCourseDTO[]>(`/students/${id}/registered-courses`),
  advisorReport: () => request<AdvisorReportRowDTO[]>('/advisor/report'),

  // §16 — Innovation & Venture Catalyst
  ventureQuiz: () => request<VentureQuizQuestionDTO[]>('/venture-quiz'),
  getVentureGateAnswer: (studentId: string) => request<{ interested: boolean | null }>(`/students/${studentId}/venture-gate`),
  getVentureInterestAnswers: (studentId: string) => request<{ answers: Record<string, string> }>(`/students/${studentId}/venture-interest-form`),
  setVentureGateAnswer: (studentId: string, interested: boolean) =>
    request<{ ok: true; interested: boolean }>(`/students/${studentId}/venture-gate`, {
      method: 'POST',
      body: JSON.stringify({ interested }),
    }),
  setVentureInterestAnswers: (studentId: string, answers: Record<string, string>) =>
    request<{ ok: true; answers: Record<string, string> }>(`/students/${studentId}/venture-interest-form`, {
      method: 'POST',
      body: JSON.stringify(answers),
    }),
  ventureMatches: (studentId: string) => request<VentureMatchResultDTO[]>(`/students/${studentId}/venture-matches`),
  /** §16.4 — express interest, optionally attaching a CV (read client-side
   *  as a base64 data: URL — see lib/readFileAsDataUrl.ts) in the same call.
   *  Keyed by project, not matchId — works for a below-threshold project
   *  the student wants to apply to anyway, same as an already-qualifying one. */
  expressInterestInProject: (studentId: string, projectId: string, cv?: { fileName: string; dataUrl: string }) =>
    request<{ id: string; status: VentureMatchStatus; cvFileName?: string }>(`/students/${studentId}/venture-projects/${projectId}/express-interest`, {
      method: 'POST',
      body: JSON.stringify(cv ? { cvFileName: cv.fileName, cvDataUrl: cv.dataUrl } : {}),
    }),
  professors: () => request<ProfessorSummaryDTO[]>('/professors'),
  professor: (professorId: string) => request<ProfessorDetailDTO>(`/professors/${professorId}`),
  createVentureProject: (professorId: string, input: Omit<VentureProjectDTO, 'id' | 'professorId' | 'createdAt'>) =>
    request<VentureProjectDTO>(`/professors/${professorId}/venture-projects`, { method: 'POST', body: JSON.stringify(input) }),
  updateVentureProject: (professorId: string, projectId: string, patch: Partial<VentureProjectDTO>) =>
    request<VentureProjectDTO>(`/professors/${professorId}/venture-projects/${projectId}`, { method: 'PUT', body: JSON.stringify(patch) }),
  ventureCandidates: (professorId: string, projectId: string) =>
    request<VentureCandidateDTO[]>(`/professors/${professorId}/venture-projects/${projectId}/candidates`),
  setVentureMatchStatus: (matchId: string, status: 'accepted' | 'declined') =>
    request<{ id: string; status: VentureMatchStatus }>(`/venture-matches/${matchId}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  /** Advisor console's own Venture Board — every project across every
   *  professor in one shot, since the advisor manages ventures directly
   *  rather than browsing a per-professor directory (see server.ts). */
  advisorVentureProjects: () => request<AdvisorVentureProjectRowDTO[]>('/advisor/venture-projects'),

  predictionWeights: () => request<Record<string, unknown>>('/admin/prediction-weights'),
  updatePredictionWeights: (patch: Record<string, unknown>) =>
    request<Record<string, unknown>>('/admin/prediction-weights', {
      method: 'PUT',
      headers: { 'x-role': 'registrar' },
      body: JSON.stringify(patch),
    }),
};
