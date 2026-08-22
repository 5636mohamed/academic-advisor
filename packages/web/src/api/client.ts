// Typed fetch client for every route this frontend calls. In local dev,
// talks to the Express demo server (packages/api/src/server.ts) via the
// /api proxy set up in vite.config.ts — VITE_API_BASE_URL is unset there,
// so this resolves to the same-origin relative `/api${path}` it always
// has. A static deploy (e.g. GitHub Pages) has nowhere to proxy to — it
// can only serve files — so VITE_API_BASE_URL lets a build point at a
// separately-hosted copy of packages/api instead (set as a build-time env
// var; the API itself needs CORS enabled for the Pages origin). Deliberately
// plain fetch + small helpers rather than a data-fetching library — keeps
// the surface easy to read alongside the routes it calls.
import { EnrollmentRecord, CgpaSnapshot, ProbationCounterState, ProbationCounterLogEntry, Course, FrictionReading, FrictionTrendReading, InstitutionalFrictionCell, Project, ProjectMember, TopographyCell, OpportunityMatch, Notification, NotificationRole, TaskMoveRecommendation, ColdStartAssessment, DepartmentDemandForecast, CurriculumHealthReport, BottleneckCourse, AffectedStudentRow } from '@advisor/shared';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

// Real backend authentication epic — every request now carries the
// logged-in session's token, same "module-level mutable set by
// AuthContext" pattern as this file already needed for the token itself
// (no way to thread it through 100+ individual api.* call sites without
// touching every one of them). AuthContext.tsx calls setAuthToken() on
// login/logout/mount-from-localStorage; nothing else in this file needs
// to know a token exists.
let authToken: string | null = null;
export function setAuthToken(token: string | null): void {
  authToken = token;
}

// A 401 means the session is gone (logged out elsewhere, expired, or —
// per this app's own in-memory store — a server restart wiped it, same
// as every other in-memory collection resetting on redeploy). Rather
// than let every single api.* caller handle that individually, one
// registered callback (AuthContext, on mount) clears the local session —
// the existing RequireRole route guards then redirect to /login on the
// next render, no new navigation code needed.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init?.headers as Record<string, string> | undefined) };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(`${API_BASE_URL}/api${path}`, { ...init, headers });
  // A 401 means the session is gone (expired, logged out elsewhere, or —
  // per this app's own in-memory store — wiped by a server restart, same
  // as every other in-memory collection resetting on redeploy).
  // onUnauthorized clears the local session; the existing RequireRole
  // route guards then redirect to /login on the next render. Still
  // THROWS below like any other non-ok response, deliberately — an
  // earlier version of this tried resolving `undefined` here instead to
  // quiet the console during that redirect, but that's the same real bug
  // class already caught once this session (a component assuming a
  // response shape it never actually got — `undefined.length`-style
  // crashes) traded for a smaller cosmetic one. A handful of "401" console
  // entries during the brief transition to /login is normal and expected;
  // silently handing back the wrong data shape to whichever component
  // hasn't unmounted yet is not.
  if (res.status === 401) onUnauthorized?.();
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  }
  // 204 No Content (currently only POST /auth/logout) has no body to parse.
  if (res.status === 204) return undefined as T;
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
  advisorId: string;
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
  // The server already spreads the full stored student into this endpoint's
  // response (server.ts's `res.json({ ...student, ... })`), so this field
  // was already on the wire — just never declared here. It's the single
  // authoritative "earned credit hours" figure `level` itself is derived
  // from (`levelFromCredits`), so it can never disagree with Level the way
  // a UI-side re-derivation from the (department-scoped) Curriculum tab
  // could — see Overview.tsx/PortalHome.tsx's Completed Credits stat.
  cumulativeEarnedCredits: number;
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
  belowOrEqualSystemGrade?: boolean;
  acknowledgedByAdvisorName?: string;
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
  hasBelowOrEqualAdvisorProposal: boolean;
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

export interface VentureAuthorDTO {
  name: string;
  link?: string;
}

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
  // VP epic — "research portal": optional published-research fields.
  authors?: VentureAuthorDTO[];
  publishedPaperUrl?: string;
  conferenceName?: string;
  impactFactor?: number;
  labName?: string;
  /** Graduation Project epic — orthogonal to `type`: a graduation project
   *  can be posted on either the academic-research or commercial-spinoff
   *  track (see the shared VentureProject type's own doc comment). */
  isGraduationProject?: boolean;
  /** An advisor's own ask for funding on this venture — separate from
   *  Project Collider's VP-initiated micro-funding. */
  grantRequest?: VentureGrantRequestDTO;
}

export interface VentureGrantRequestDTO {
  amount: number;
  note: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'declined';
  decidedAt?: string;
  decisionNote?: string;
  timelinePlanFileName?: string;
  timelinePlanDataUrl?: string;
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

export interface AdvisorDTO {
  id: string;
  name: string;
  facultyId: string;
  departmentId: string;
}

export interface VpAdvisorSummaryDTO {
  advisor: AdvisorDTO;
  studentCount: number;
  averageCgpa: number;
  /** Names of students on this advisor's roster with a live (non-declined)
   *  advisor-proposed course whose expected grade was no better than the
   *  system's own recommendation — i.e., this advisor "took
   *  responsibility" for at least one of these. Empty if none. */
  flaggedStudentNames: string[];
}

// AI Features Blueprint — Cognitive Load Heatmap + Project Collider
// (advisor/VP-facing only). Response shapes match the shared types
// directly (no denormalization needed at this layer), imported above.
export interface FrictionTimelineDTO {
  courseCodes: string[];
  readings: FrictionReading[];
  trend: { slope: number | null; reading: FrictionTrendReading };
  weekOverrides: Record<string, number>;
  recommendations: TaskMoveRecommendation[];
}
export interface FrictionOverviewRowDTO {
  studentId: string;
  studentName: string;
  peakWeek: number;
  peakFrictionScore: number;
  /** How many of the 14 weeks cross the burnout threshold — a single week
   *  is common enough (a normal course load's own finals clustering
   *  routinely does it) that it isn't very discriminating on its own; see
   *  sustainedBurnoutRisk below for the actual triage signal. */
  weeksOverThreshold: number;
  sustainedBurnoutRisk: boolean;
  trend: { slope: number | null; reading: FrictionTrendReading };
}
/** Curriculum Analytics epic, Feature 3 — server.ts's advisor bottlenecks
 *  route enriches the pure AffectedStudentRow (shared type, id-only) with
 *  studentName at the API boundary, same withMemberNames/withProfessorName
 *  pattern every other enriched row in this app already follows. */
export interface AffectedStudentRowDTO extends AffectedStudentRow {
  studentName: string;
}
export interface AdvisorBottlenecksDTO {
  bottlenecks: BottleneckCourse[];
  affectedAdvisees: AffectedStudentRowDTO[];
}
export interface ColliderProjectMemberDTO extends ProjectMember {
  name: string;
}
export interface ColliderProjectDTO extends Omit<Project, 'members'> {
  members: ColliderProjectMemberDTO[];
}

export interface VpPendingProposalDTO {
  proposalId: string;
  studentId: string;
  studentName: string;
  advisorId: string;
  slotKey: string;
  courseCode: string;
  expectedLetter: string;
  expectedPct: number;
  /** True once the student's advisor already proposed their own alternate
   *  for this slot — "Approve all" skips these (see the DB layer's own
   *  doc comment); the row still shows so the VP knows it exists, just
   *  without an "Approve" action that would silently overrule the advisor. */
  overriddenByAdvisor: boolean;
}

// VP epic — the 3-stage transfer pending chain (student -> advisor -> VP).
export type TransferRequestStatus = 'pending_advisor' | 'pending_vp' | 'advisor_declined' | 'vp_declined' | 'approved';
export interface TransferRequestDTO {
  id: string;
  studentId: string;
  studentName: string;
  advisorId: string;
  type: 'internal_department' | 'external_faculty';
  toFacultyId?: string;
  toDepartmentId?: string;
  status: TransferRequestStatus;
  createdAt: string;
  advisorDecidedAt?: string;
  vpDecidedAt?: string;
  declineReason?: string;
}
export interface AdvisorResponsibilityDetailDTO {
  studentId: string;
  studentName: string;
  advisorId: string;
  advisorName: string;
  courseCode: string;
  courseName: string;
}

export interface VpTransferCounterDTO {
  advisorId: string;
  internalInFlight: number;
  externalInFlight: number;
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

export interface LoginResponseDTO {
  token: string;
  role: 'student' | 'advisor' | 'vice_president';
  id: string | null;
}

export const api = {
  // Real backend authentication epic — replaces the old client-only demo
  // login. No Authorization header is attached here (there's no token
  // yet) — request() only adds one once authToken is set.
  login: (email: string, password: string) => request<LoginResponseDTO>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  listStudents: (advisorId?: string) => request<StudentSummary[]>(`/students${advisorId ? `?advisorId=${encodeURIComponent(advisorId)}` : ''}`),
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
  /** null once the student has any real completed course — this is only
   *  ever meaningful in the exact window before real transcript data
   *  exists (see coldStart.service.ts). */
  coldStartAssessment: (id: string) => request<ColdStartAssessment | null>(`/students/${id}/cold-start-assessment`),
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
  // VP epic — the pending chain a "Confirm transfer" click now creates
  // instead of executing immediately (transferInternal/transferExternal
  // above stay defined for completeness but are no longer called from the
  // student-facing confirm flow).
  createTransferRequest: (id: string, type: 'internal_department' | 'external_faculty', toDepartmentId: string, toFacultyId?: string) =>
    request<TransferRequestDTO>(`/students/${id}/transfer-requests`, {
      method: 'POST',
      body: JSON.stringify({ type, toDepartmentId, toFacultyId }),
    }),
  studentTransferRequests: (id: string) => request<TransferRequestDTO[]>(`/students/${id}/transfer-requests`),
  advisorTransferRequests: (advisorId: string) => request<TransferRequestDTO[]>(`/advisors/${advisorId}/transfer-requests`),
  // advisorId now required — a real authorization gap found by audit: the
  // route used to accept no advisor identity at all, so any advisor
  // session could approve/decline any OTHER advisor's transfer request.
  advisorApproveTransferRequest: (requestId: string, advisorId: string) =>
    request<TransferRequestDTO>(`/advisor/transfer-requests/${requestId}/approve`, { method: 'POST', body: JSON.stringify({ advisorId }) }),
  advisorDeclineTransferRequest: (requestId: string, advisorId: string, reason?: string) =>
    request<TransferRequestDTO>(`/advisor/transfer-requests/${requestId}/decline`, { method: 'POST', body: JSON.stringify({ advisorId, reason }) }),
  vpTransferRequests: () => request<TransferRequestDTO[]>('/vp/transfer-requests'),
  vpTransferCounters: () => request<VpTransferCounterDTO[]>('/vp/transfer-requests-summary'),
  vpApproveTransferRequest: (requestId: string) => request<TransferRequestDTO>(`/vp/transfer-requests/${requestId}/approve`, { method: 'POST' }),
  vpDeclineTransferRequest: (requestId: string, reason?: string) =>
    request<TransferRequestDTO>(`/vp/transfer-requests/${requestId}/decline`, { method: 'POST', body: JSON.stringify({ reason }) }),
  courseChain: (code: string) => request<{ courseCode: string; chainUnlockValue: number; directUnlocks: string[] }>(`/courses/${code}/chain`),
  quiz: () => request<QuizQuestionDTO[]>('/quiz'),
  faculties: () => request<Array<{ id: string; name: string }>>('/faculties'),
  facultyDepartments: (facultyId: string) => request<Array<{ id: string; name: string }>>(`/faculties/${facultyId}/departments`),
  // §15.3 proposal / approval workflow
  generateProposals: (id: string) => request<ProposalsWithImpactDTO>(`/students/${id}/proposals/generate`, { method: 'POST' }),
  getProposals: (id: string) => request<ProposalsWithImpactDTO>(`/students/${id}/proposals`),
  approveProposal: (proposalId: string) => request<CourseProposalDTO>(`/advisor/proposals/${proposalId}/approve`, { method: 'POST' }),
  declineProposal: (proposalId: string) => request<CourseProposalDTO>(`/advisor/proposals/${proposalId}/decline`, { method: 'POST' }),
  approveAllProposals: (studentId: string) => request<ProposalsWithImpactDTO>(`/advisor/students/${studentId}/proposals/approve-all`, { method: 'POST' }),
  proposeAlternate: (studentId: string, slotKey: string, courseCode: string, acknowledgedByAdvisorName?: string) =>
    request<CourseProposalDTO>(`/advisor/students/${studentId}/proposals/${slotKey}/alternate`, {
      method: 'POST',
      body: JSON.stringify({ courseCode, acknowledgedByAdvisorName }),
    }),
  previewAlternate: (studentId: string, slotKey: string, courseCode: string) =>
    request<AlternateScorePreviewDTO>(`/advisor/students/${studentId}/proposals/${slotKey}/alternate/preview`, {
      method: 'POST',
      body: JSON.stringify({ courseCode }),
    }),
  chooseProposal: (studentId: string, proposalId: string) =>
    request<ChooseProposalResultDTO>(`/students/${studentId}/proposals/${proposalId}/choose`, { method: 'POST' }),
  chooseAllProposals: (studentId: string) =>
    request<ProposalsWithImpactDTO & { stillPendingSlots: string[] }>(`/students/${studentId}/proposals/choose-all`, { method: 'POST' }),
  registeredCourses: (id: string) => request<RegisteredCourseDTO[]>(`/students/${id}/registered-courses`),
  advisorReport: (advisorId?: string) => request<AdvisorReportRowDTO[]>(`/advisor/report${advisorId ? `?advisorId=${encodeURIComponent(advisorId)}` : ''}`),

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
  advisors: () => request<AdvisorDTO[]>('/advisors'),
  advisor: (advisorId: string) => request<AdvisorDTO>(`/advisors/${advisorId}`),
  vpAdvisorsSummary: () => request<VpAdvisorSummaryDTO[]>('/vp/advisors-summary'),
  vpPendingProposals: () => request<VpPendingProposalDTO[]>('/vp/pending-proposals'),
  vpApproveAllPendingProposals: () => request<VpPendingProposalDTO[]>('/vp/pending-proposals/approve-all', { method: 'POST' }),
  vpResponsibilityDetails: () => request<AdvisorResponsibilityDetailDTO[]>('/vp/responsibility-details'),
  /** `professorId` here is an attribution field, not a login — every real
   *  caller today passes 'advisor-owned' or 'vp-owned' (the two seeded
   *  attribution anchors); prof-kamel/prof-adel still own their existing
   *  seeded ventures for display purposes, but there's no professor login
   *  left to create/edit a project as them. */
  createVentureProject: (professorId: string, input: Omit<VentureProjectDTO, 'id' | 'professorId' | 'createdAt'>) =>
    request<VentureProjectDTO>(`/professors/${professorId}/venture-projects`, { method: 'POST', body: JSON.stringify(input) }),
  updateVentureProject: (professorId: string, projectId: string, patch: Partial<VentureProjectDTO>) =>
    request<VentureProjectDTO>(`/professors/${professorId}/venture-projects/${projectId}`, { method: 'PUT', body: JSON.stringify(patch) }),
  setVentureMatchStatus: (matchId: string, status: 'accepted' | 'declined') =>
    request<{ id: string; status: VentureMatchStatus }>(`/venture-matches/${matchId}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  /** An advisor requesting funding on one of THEIR OWN ventures — allowed
   *  regardless of the project's current active/archived status. `timelinePlan`
   *  is optional (read client-side as a base64 data: URL, same pattern as
   *  a student's CV attachment — see lib/readFileAsDataUrl.ts). */
  requestVentureGrant: (professorId: string, projectId: string, amount: number, note: string, timelinePlan?: { fileName: string; dataUrl: string }) =>
    request<VentureProjectDTO>(`/professors/${professorId}/venture-projects/${projectId}/grant-request`, {
      method: 'POST',
      body: JSON.stringify({ amount, note, ...(timelinePlan ? { timelinePlanFileName: timelinePlan.fileName, timelinePlanDataUrl: timelinePlan.dataUrl } : {}) }),
    }),
  decideVentureGrantRequest: (projectId: string, decision: 'approved' | 'declined', decisionNote?: string) =>
    request<VentureProjectDTO>(`/vp/venture-projects/${projectId}/grant-request/decide`, { method: 'POST', body: JSON.stringify({ decision, decisionNote }) }),
  /** Advisor console's own Venture Board — every project across every
   *  professor in one shot, since the advisor manages ventures directly
   *  rather than browsing a per-professor directory (see server.ts). */
  /** Omit advisorId to see every advisor's ventures (the VP's own board
   *  calls it this way — cross-advisor oversight is the VP's whole point).
   *  A real advisorId scopes to that one advisor's own postings only. */
  advisorVentureProjects: (advisorId?: string) => request<AdvisorVentureProjectRowDTO[]>(`/advisor/venture-projects${advisorId ? `?advisorId=${encodeURIComponent(advisorId)}` : ''}`),

  // AI Features Blueprint — Cognitive Load Heatmap
  frictionTimeline: (studentId: string) => request<FrictionTimelineDTO>(`/students/${studentId}/friction-timeline`),
  /** Returns the FULLY RECALCULATED timeline in the same response — the
   *  "recalculate week heaviness" checkbox behavior — not just an ack the
   *  caller has to separately re-fetch for. */
  toggleFrictionMilestone: (studentId: string, milestoneId: string) =>
    request<FrictionTimelineDTO>(`/students/${studentId}/friction-timeline/toggle-milestone`, {
      method: 'POST',
      body: JSON.stringify({ milestoneId }),
    }),
  /** "Move this task a week or two later" — bounded server-side to
   *  MAX_MOVE_WEEKS ahead of the milestone's own template week, and only
   *  for movable types (assignment/quiz/lab_report). Returns the
   *  recalculated timeline, same one-round-trip shape as toggle above. */
  rescheduleFrictionMilestone: (studentId: string, milestoneId: string, newWeek: number) =>
    request<FrictionTimelineDTO>(`/students/${studentId}/friction-timeline/reschedule-milestone`, {
      method: 'POST',
      body: JSON.stringify({ milestoneId, newWeek }),
    }),
  advisorFrictionOverview: (advisorId: string) => request<FrictionOverviewRowDTO[]>(`/advisors/${advisorId}/friction-overview`),
  vpInstitutionalBottlenecks: () => request<InstitutionalFrictionCell[]>('/vp/friction/institutional-bottlenecks'),

  // Curriculum Analytics epic — Academic Resource Demand Forecasting
  // (Department, VP). Advisor-scoped = that advisor's own HOME department,
  // not their roster — see server.ts's own route comment for why.
  vpDemandForecast: () => request<DepartmentDemandForecast[]>('/vp/curriculum-analytics/demand-forecast'),
  advisorDemandForecast: (advisorId: string) => request<DepartmentDemandForecast>(`/advisors/${advisorId}/curriculum-analytics/demand-forecast`),
  vpCurriculumHealthMonitor: () => request<CurriculumHealthReport>('/vp/curriculum-analytics/health-monitor'),
  advisorCurriculumHealthMonitor: (advisorId: string) => request<CurriculumHealthReport>(`/advisors/${advisorId}/curriculum-analytics/health-monitor`),
  vpBottlenecks: () => request<BottleneckCourse[]>('/vp/curriculum-analytics/bottlenecks'),
  advisorBottlenecks: (advisorId: string) => request<AdvisorBottlenecksDTO>(`/advisors/${advisorId}/curriculum-analytics/bottlenecks`),

  // AI Features Blueprint — Project Collider (advisor/VP-facing only)
  advisorColliderProjects: (advisorId: string) => request<ColliderProjectDTO[]>(`/advisors/${advisorId}/collider/projects`),
  colliderOpportunityMatches: (projectId: string) => request<OpportunityMatch[]>(`/collider/projects/${projectId}/opportunity-matches`),
  vpInnovationTopography: () => request<TopographyCell[]>('/vp/collider/topography'),
  vpFundColliderProject: (projectId: string, amount: number, note: string, source: 'university' | 'external_grant', grantName?: string) =>
    request<ColliderProjectDTO>(`/vp/collider/projects/${projectId}/fund`, { method: 'POST', body: JSON.stringify({ amount, note, source, grantName }) }),

  // Cross-cutting in-app notifications
  notifications: (role: NotificationRole, recipientId: string) =>
    request<{ notifications: Notification[]; unreadCount: number }>(`/notifications?role=${role}&recipientId=${encodeURIComponent(recipientId)}`),
  markNotificationRead: (id: string) => request<{ ok: true }>(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: (role: NotificationRole, recipientId: string) =>
    request<{ ok: true }>('/notifications/read-all', { method: 'POST', body: JSON.stringify({ role, recipientId }) }),

  predictionWeights: () => request<Record<string, unknown>>('/admin/prediction-weights'),
  updatePredictionWeights: (patch: Record<string, unknown>) =>
    request<Record<string, unknown>>('/admin/prediction-weights', {
      method: 'PUT',
      headers: { 'x-role': 'registrar' },
      body: JSON.stringify(patch),
    }),
};
