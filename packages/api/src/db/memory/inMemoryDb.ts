// In-memory "database" for the demo server + frontend. This is NOT the
// Prisma/Postgres layer described in spec §9.3 (that's still pending —
// PROGRESS.md item 4) — it's a small, honest stand-in that lets the whole
// system be exercised end-to-end (seed → read → mutate → recompute → read
// again) without needing a real database instance set up. Every function
// here is intentionally the kind of thing a real `*.repository.ts` would
// eventually wrap around actual SQL — swapping this module out for Prisma
// calls later shouldn't require touching any caller (routes/ports), only
// this file.
import { Student, StudentStatus, EnrollmentRecord, CgpaSnapshot, Course, Transcript, ProbationCounterState, ProbationCounterLogEntry, TransferRecord, CourseProposal, RegisteredCourse, AdvisorReportRow, CandidateCourseScore, ProfessorProfile, VentureProject, StudentVentureMatch, VentureMatchResult, VentureFitBreakdown } from '@advisor/shared';
import { CATALOG } from '../seed/seedCatalog';
import { EQUIVALENCY_MAP } from '../seed/seedEquivalency';
import { PROFESSORS, VENTURE_PROJECTS, COURSE_SKILL_TAGS, ELECTIVE_COURSE_CODES } from '../seed/seedVentureProjects';
import { computeCGPA, latestAttemptPerCourse } from '../../modules/grading/cgpa';
import { gradeFromPct } from '@advisor/shared';
import { replayProbationHistory } from '../../modules/probation/probationHistory';
import { executeInternalTransfer } from '../../modules/transfer/internalTransfer.service';
import { executeExternalTransfer } from '../../modules/transfer/externalTransfer.service';
import { buildTransferSemester, transferableCourses, TransferableCourseCandidate } from '../../modules/transfer/transferSemester.builder';
import { DEPARTMENTS, OTHER_FACULTY_DEPARTMENTS } from '../../modules/fitEngine/deptFitEngine';
import { bestCasePct } from '../../modules/prediction/bestCaseProjection';
import { projectCGPATrend } from '../../modules/prediction/cgpaTrendProjection';
import { ventureFitScore } from '../../modules/venture/ventureFitScore';
import { VentureQuizAnswers } from '../../modules/venture/ventureQuiz';
import { computeMatchesForStudent, applyToMatch, setMatchStatus, createDirectApplication, CvAttachment } from '../../modules/venture/ventureMatch.service';
import weights from '../../config/predictionWeights.json';
import {
  buildProposalsFromPlan,
  approveProposal,
  declineProposal,
  buildAdvisorAlternate,
  chooseProposal,
} from '../../modules/proposals/proposal.service';

export interface StoredStudent extends Student {
  /** Every enrollment attempt ever made, superseded ones included — the
   *  replacement rule (§2.2) is applied at READ time via
   *  `latestAttemptPerCourse`, never destructively at write time, so the
   *  full attempt history is always still there for the transcript view. */
  allAttempts: EnrollmentRecord[];
  cgpaSnapshots: CgpaSnapshot[];
  probationCounter: ProbationCounterState;
  /** Derived at seed/init time by replaying `cgpaSnapshots` through the real
   *  §4.1/§4.5 state machine (`replayProbationHistory`) — this is what
   *  powers the §10.7 Probation History timeline. Never hand-authored. */
  probationLog: ProbationCounterLogEntry[];
  /** §7 — every internal/external transfer this student has executed, most
   *  recent last. Drives §4.2.1's anti-loop guard and the dashboard's
   *  base-snapshot indicator. */
  transferRecords: TransferRecord[];
  /** §15.3 — the course proposal / dual-approval workflow's live state. */
  proposals: CourseProposal[];
  /** §15.3.1 — "signed up for, not yet graded." */
  registeredCourses: RegisteredCourse[];
  quizAnswers: Record<string, string>;
  /** §16.2 — persisted StudentVentureMatch rows: only ones that have
   *  cleared the display threshold at least once, or that the student/
   *  professor has since acted on. Below-threshold scores are recomputed
   *  live on every read, never stored (§16.2's "no need to store noise"). */
  ventureMatches: StudentVentureMatch[];
}

const courseByCode: Record<string, Course> = Object.fromEntries(CATALOG.map(c => [c.code, c]));

// §16.1 — the gate answer and interest-form answers, re-askable each
// planning session, same storage shape as retakePreferences/quizAnswers.
// Declared up here (ahead of the seed-student literals below) so the
// demo-fixture opt-ins seeded further down (`seedInitialVentureOptIns`) can
// write into them at module-init time without a temporal-dead-zone error.
const ventureGateAnswers = new Map<string, boolean>();
const ventureInterestAnswersMap = new Map<string, VentureQuizAnswers>();

function attempt(courseCode: string, pct: number, semesterOrdinal: number, attemptNumber = 1): EnrollmentRecord {
  const course = courseByCode[courseCode];
  if (!course) throw new Error(`seed references unknown course ${courseCode}`);
  const band = gradeFromPct(pct, course.isUR);
  return {
    courseCode,
    attemptNumber,
    pct,
    letter: band.letter,
    points: band.pts,
    isRetake: attemptNumber > 1,
    countsInCgpa: true,
    semesterOrdinal,
  };
}

// ---------------------------------------------------------------------
// Seed students — one per §11 worked example this demo can meaningfully
// show without the transfer-execution engine (item 3, still pending) or
// full DB wiring. Ordinals/credits are illustrative, not exhaustive
// transcripts — enough to drive the real advising engine believably.
// ---------------------------------------------------------------------
/** Raw seed literals omit `probationLog`/`transferRecords` — both are always
 *  derived (the log via `replayProbationHistory`, transfers start empty) in
 *  `deriveStudent` below, never hand-authored. */
type SeedStudent = Omit<StoredStudent, 'probationLog' | 'transferRecords' | 'proposals' | 'registeredCourses' | 'ventureMatches'>;

const seedStudents: SeedStudent[] = [
  {
    id: 'ahmed-1',
    name: 'Ahmed',
    facultyId: 'ENG',
    departmentId: 'ECE',
    status: 'active',
    activeBaseSnapshotId: null,
    cumulativeEarnedCredits: 72,
    level: 3,
    quizAnswers: {},
    allAttempts: [
      attempt('MTH111', 88, 1), attempt('PHY111', 84, 1), attempt('CHM111', 80, 1),
      attempt('MTH121', 90, 2), attempt('PHY121', 86, 2),
      attempt('CSE211', 92, 3), attempt('ECE211', 85, 3),
      attempt('ECE221', 88, 4), attempt('CSE213', 91, 4),
      attempt('ECE310', 83, 5), attempt('ECE314', 80, 5), attempt('ECE316', 86, 5), attempt('ECE317', 82, 5),
      attempt('ECE322', 84, 6), attempt('ECE324', 87, 6), attempt('ECE326', 85, 6), attempt('ECE328', 83, 6),
      // Semester 7 electives — a second §16 venture-fit demo persona besides
      // Mohamed, so the professor/student flow can be exercised by a
      // second, differently-scored student (proj-lora AND proj-edge-ml both
      // clear the 0.80 threshold for Ahmed; see his pre-seeded Venture Gate
      // opt-in below).
      attempt('ECE413', 91, 7), attempt('ECEEL1', 90, 7),
    ],
    cgpaSnapshots: [
      { semesterId: 'sem-2', semesterOrdinal: 2, semesterGpa: 2.95, cgpa: 2.90, cumulativeCredits: 30, isBaseSnapshot: false },
      { semesterId: 'sem-3', semesterOrdinal: 3, semesterGpa: 3.10, cgpa: 3.00, cumulativeCredits: 48, isBaseSnapshot: false },
      { semesterId: 'sem-4', semesterOrdinal: 4, semesterGpa: 3.20, cgpa: 3.10, cumulativeCredits: 72, isBaseSnapshot: false },
    ],
    probationCounter: { studentId: 'ahmed-1', count: 0, armed: true },
  },
  {
    id: 'sara-1',
    name: 'Sara',
    facultyId: 'ENG',
    departmentId: 'ECE',
    status: 'active',
    activeBaseSnapshotId: null,
    cumulativeEarnedCredits: 40,
    level: 2,
    quizAnswers: {
      // strong programming-leaning answers, matching §11 Example H's Sara
      q1_problem_style: 'q1_data',
      q2_favorite_subject: 'q2_programming',
      q3_project_role: 'q3_coder',
      q4_ideal_job: 'q4_swe',
    },
    allAttempts: [
      attempt('MTH111', 70, 1), attempt('PHY111', 68, 1), attempt('CHM111', 72, 1),
      attempt('MTH121', 71, 2), attempt('PHY121', 66, 2),
      attempt('CSE211', 92, 3), attempt('ECE211', 65, 3),
      attempt('CSE213', 88, 4), attempt('ECE221', 64, 4),
      attempt('ECE314', 58, 5), attempt('ECE317', 55, 5),
    ],
    cgpaSnapshots: [
      { semesterId: 'sem-1', semesterOrdinal: 1, semesterGpa: 2.20, cgpa: 2.20, cumulativeCredits: 16, isBaseSnapshot: false },
      { semesterId: 'sem-2', semesterOrdinal: 2, semesterGpa: 2.10, cgpa: 2.14, cumulativeCredits: 28, isBaseSnapshot: false },
      { semesterId: 'sem-3', semesterOrdinal: 3, semesterGpa: 2.10, cgpa: 2.15, cumulativeCredits: 40, isBaseSnapshot: false },
    ],
    probationCounter: { studentId: 'sara-1', count: 0, armed: true },
  },
  {
    id: 'karim-1',
    name: 'Karim',
    facultyId: 'ENG',
    departmentId: 'ECE',
    status: 'active',
    activeBaseSnapshotId: null,
    cumulativeEarnedCredits: 30,
    level: 2,
    quizAnswers: {},
    allAttempts: [
      attempt('MTH111', 78, 1), attempt('PHY111', 74, 1), attempt('CHM111', 70, 1),
      attempt('MTH121', 61, 2), // D — optional retake (§11 Example C)
      attempt('PHY121', 52, 2), // F — mandatory retake (§11 Example C)
      attempt('CSE211', 76, 3), attempt('ECE211', 70, 3),
    ],
    cgpaSnapshots: [
      { semesterId: 'sem-1', semesterOrdinal: 1, semesterGpa: 2.40, cgpa: 2.40, cumulativeCredits: 14, isBaseSnapshot: false },
      { semesterId: 'sem-2', semesterOrdinal: 2, semesterGpa: 1.85, cgpa: 2.05, cumulativeCredits: 30, isBaseSnapshot: false },
    ],
    probationCounter: { studentId: 'karim-1', count: 0, armed: true },
  },
  // ---------------------------------------------------------------------
  // AMENDMENT 1 demo students — one per warning rung, so the new rule
  // ("1st/2nd = normal, 3rd = internal transfer, 4th = faculty transfer")
  // can be validated live in the frontend, not just in unit tests. Each
  // student's CGPA is < 2.00 (on the ladder) and their probationCounter is
  // set directly to the rung being demonstrated — in a real system the
  // counter would only reach these values by actually living through that
  // many low-CGPA semesters (§4.1), but that multi-semester history isn't
  // modeled in this demo store, so the counter is seeded directly instead.
  // ---------------------------------------------------------------------
  {
    id: 'omar-1',
    name: 'Omar (warning 1/6)',
    facultyId: 'ENG',
    departmentId: 'ECE',
    status: 'active',
    activeBaseSnapshotId: null,
    cumulativeEarnedCredits: 60,
    level: 3,
    quizAnswers: {},
    allAttempts: [
      attempt('MTH111', 80, 1), attempt('PHY111', 76, 1), attempt('CHM111', 74, 1),
      attempt('MTH121', 72, 2), attempt('PHY121', 70, 2),
      attempt('CSE211', 68, 3), attempt('ECE211', 64, 3),
      attempt('ECE221', 62, 4), attempt('CSE213', 60, 4),
      attempt('ECE310', 55, 5), attempt('ECE314', 58, 5), attempt('ECE316', 56, 5), attempt('ECE317', 54, 5),
    ],
    cgpaSnapshots: [
      { semesterId: 'sem-4', semesterOrdinal: 4, semesterGpa: 2.05, cgpa: 2.10, cumulativeCredits: 44, isBaseSnapshot: false },
      { semesterId: 'sem-5', semesterOrdinal: 5, semesterGpa: 1.75, cgpa: 1.92, cumulativeCredits: 60, isBaseSnapshot: false }, // §11 Example D
    ],
    probationCounter: { studentId: 'omar-1', count: 1, armed: true }, // warning 1/6 — expect SHOW_PLAN
  },
  {
    id: 'mona-2',
    name: 'Mona (warning 2/6)',
    facultyId: 'ENG',
    departmentId: 'ECE',
    status: 'active',
    activeBaseSnapshotId: null,
    cumulativeEarnedCredits: 60,
    level: 3,
    quizAnswers: {},
    allAttempts: [
      attempt('MTH111', 78, 1), attempt('PHY111', 72, 1), attempt('CHM111', 70, 1),
      attempt('MTH121', 68, 2), attempt('PHY121', 65, 2),
      attempt('CSE211', 60, 3), attempt('ECE211', 58, 3),
      attempt('ECE221', 55, 4), attempt('CSE213', 52, 4),
      attempt('ECE310', 50, 5), attempt('ECE314', 48, 5), attempt('ECE316', 51, 5), attempt('ECE317', 49, 5),
    ],
    cgpaSnapshots: [
      { semesterId: 'sem-4', semesterOrdinal: 4, semesterGpa: 1.90, cgpa: 1.95, cumulativeCredits: 44, isBaseSnapshot: false },
      { semesterId: 'sem-5', semesterOrdinal: 5, semesterGpa: 1.60, cgpa: 1.80, cumulativeCredits: 60, isBaseSnapshot: false },
    ],
    probationCounter: { studentId: 'mona-2', count: 2, armed: true }, // warning 2/6 — expect SHOW_PLAN
  },
  {
    id: 'youssef-3',
    name: 'Youssef (warning 3/6)',
    facultyId: 'ENG',
    departmentId: 'ECE',
    status: 'active',
    activeBaseSnapshotId: null,
    cumulativeEarnedCredits: 60,
    level: 3,
    quizAnswers: {
      // programming-leaning, same shape as Sara's — gives him a real
      // best-fit internal department (CSE) to be recommended into.
      q1_problem_style: 'q1_data',
      q2_favorite_subject: 'q2_programming',
      q3_project_role: 'q3_coder',
      q4_ideal_job: 'q4_swe',
    },
    allAttempts: [
      attempt('MTH111', 74, 1), attempt('PHY111', 68, 1), attempt('CHM111', 66, 1),
      attempt('MTH121', 62, 2), attempt('PHY121', 58, 2),
      attempt('CSE211', 88, 3), attempt('ECE211', 55, 3), // strong programming, weak hardware — same pattern as Sara
      attempt('ECE221', 50, 4), attempt('CSE213', 84, 4),
      attempt('ECE310', 48, 5), attempt('ECE314', 45, 5), attempt('ECE316', 47, 5), attempt('ECE317', 44, 5),
    ],
    cgpaSnapshots: [
      { semesterId: 'sem-3', semesterOrdinal: 3, semesterGpa: 1.85, cgpa: 1.90, cumulativeCredits: 28, isBaseSnapshot: false },
      { semesterId: 'sem-4', semesterOrdinal: 4, semesterGpa: 1.70, cgpa: 1.82, cumulativeCredits: 44, isBaseSnapshot: false },
      { semesterId: 'sem-5', semesterOrdinal: 5, semesterGpa: 1.55, cgpa: 1.75, cumulativeCredits: 60, isBaseSnapshot: false },
    ],
    probationCounter: { studentId: 'youssef-3', count: 3, armed: true }, // warning 3/6 — expect RECOMMEND_INTERNAL_TRANSFER
  },
  {
    id: 'laila-4',
    name: 'Laila (warning 4/6)',
    facultyId: 'ENG',
    departmentId: 'ECE',
    status: 'active',
    activeBaseSnapshotId: null,
    cumulativeEarnedCredits: 74,
    level: 3,
    quizAnswers: {},
    allAttempts: [
      attempt('MTH111', 65, 1), attempt('PHY111', 60, 1), attempt('CHM111', 58, 1),
      attempt('MTH121', 55, 2), attempt('PHY121', 50, 2),
      attempt('CSE211', 52, 3), attempt('ECE211', 48, 3),
      attempt('ECE221', 45, 4), attempt('CSE213', 47, 4),
      attempt('ECE310', 42, 5), attempt('ECE314', 40, 5), attempt('ECE316', 43, 5), attempt('ECE317', 41, 5),
    ],
    // Semester 1 (ordinal 1) is unarmed per §4.5 regardless of GPA — 4
    // consecutive low ARMED semesters (ordinals 2-5) is what actually
    // produces count=4, replayed through the real state machine below
    // (`deriveStudent`) rather than hand-set — see PROGRESS.md's old caveat
    // about this seed, now resolved.
    cgpaSnapshots: [
      { semesterId: 'sem-1', semesterOrdinal: 1, semesterGpa: 1.80, cgpa: 1.80, cumulativeCredits: 14, isBaseSnapshot: false },
      { semesterId: 'sem-2', semesterOrdinal: 2, semesterGpa: 1.70, cgpa: 1.75, cumulativeCredits: 28, isBaseSnapshot: false },
      { semesterId: 'sem-3', semesterOrdinal: 3, semesterGpa: 1.60, cgpa: 1.70, cumulativeCredits: 44, isBaseSnapshot: false },
      { semesterId: 'sem-4', semesterOrdinal: 4, semesterGpa: 1.50, cgpa: 1.65, cumulativeCredits: 60, isBaseSnapshot: false },
      { semesterId: 'sem-5', semesterOrdinal: 5, semesterGpa: 1.55, cgpa: 1.63, cumulativeCredits: 74, isBaseSnapshot: false },
    ],
    probationCounter: { studentId: 'laila-4', count: 4, armed: true }, // warning 4/6 — expect RECOMMEND_FACULTY_TRANSFER; confirmed by replay below
  },
  // ---------------------------------------------------------------------
  // Remaining §11 worked-example personas not otherwise covered live by the
  // three original demo students or the four warning-ladder students above.
  // ---------------------------------------------------------------------
  {
    // §11 Example B — retake gate = YES, chain-unlock-prioritized retake.
    id: 'salma-1',
    name: 'Salma (retake gate — Example B)',
    facultyId: 'ENG',
    departmentId: 'ECE',
    status: 'active',
    activeBaseSnapshotId: null,
    cumulativeEarnedCredits: 70,
    level: 3,
    quizAnswers: {},
    allAttempts: [
      attempt('MTH111', 82, 1), attempt('PHY111', 78, 1), attempt('CHM111', 76, 1),
      attempt('MTH121', 80, 2), attempt('PHY121', 75, 2),
      attempt('CSE211', 84, 3), attempt('ECE211', 78, 3),
      attempt('ECE221', 76, 4), attempt('CSE213', 80, 4),
      attempt('ECE310', 74, 5), attempt('ECE314', 66, 5), attempt('ECE316', 68, 5), attempt('ECE317', 77, 5), // ECE314/ECE316 = D+ retake-eligible
    ],
    cgpaSnapshots: [
      { semesterId: 'sem-4', semesterOrdinal: 4, semesterGpa: 2.60, cgpa: 2.58, cumulativeCredits: 54, isBaseSnapshot: false },
      { semesterId: 'sem-5', semesterOrdinal: 5, semesterGpa: 2.52, cgpa: 2.55, cumulativeCredits: 70, isBaseSnapshot: false },
    ],
    probationCounter: { studentId: 'salma-1', count: 0, armed: true },
  },
  {
    // §11 Example G — Level-1 first-semester half-load (GPA==CGPA < 2.00).
    id: 'yara-1',
    name: 'Yara (Level-1 half-load — Example G)',
    facultyId: 'ENG',
    departmentId: 'ECE',
    status: 'active',
    activeBaseSnapshotId: null,
    cumulativeEarnedCredits: 11,
    level: 1,
    quizAnswers: {},
    allAttempts: [
      attempt('MTH111', 68, 1), attempt('PHY111', 62, 1), attempt('CHM111', 58, 1), attempt('MCE111', 60, 1),
    ],
    cgpaSnapshots: [
      { semesterId: 'sem-1', semesterOrdinal: 1, semesterGpa: 1.65, cgpa: 1.65, cumulativeCredits: 11, isBaseSnapshot: false },
    ],
    probationCounter: { studentId: 'yara-1', count: 0, armed: false }, // §4.5 — never armed off semester 1
  },
  {
    // §11 Example F — dismissal (counter reaches 6 at the close of the 7th
    // armed-low semester; semester 1 is unarmed per §4.5, matching the
    // example's exact "starts at semester 2" note).
    id: 'nourhan-1',
    name: 'Nourhan (dismissed — Example F)',
    facultyId: 'ENG',
    departmentId: 'ECE',
    status: 'dismissed',
    activeBaseSnapshotId: null,
    cumulativeEarnedCredits: 90,
    level: 3,
    quizAnswers: {},
    allAttempts: [
      attempt('MTH111', 70, 1), attempt('PHY111', 65, 1), attempt('CHM111', 62, 1),
      attempt('MTH121', 58, 2), attempt('PHY121', 55, 2),
      attempt('CSE211', 52, 3), attempt('ECE211', 50, 3),
    ],
    cgpaSnapshots: [
      { semesterId: 'sem-1', semesterOrdinal: 1, semesterGpa: 1.90, cgpa: 1.90, cumulativeCredits: 13, isBaseSnapshot: false },
      { semesterId: 'sem-2', semesterOrdinal: 2, semesterGpa: 1.85, cgpa: 1.87, cumulativeCredits: 27, isBaseSnapshot: false },
      { semesterId: 'sem-3', semesterOrdinal: 3, semesterGpa: 1.80, cgpa: 1.84, cumulativeCredits: 41, isBaseSnapshot: false },
      { semesterId: 'sem-4', semesterOrdinal: 4, semesterGpa: 1.75, cgpa: 1.82, cumulativeCredits: 55, isBaseSnapshot: false },
      { semesterId: 'sem-5', semesterOrdinal: 5, semesterGpa: 1.70, cgpa: 1.80, cumulativeCredits: 69, isBaseSnapshot: false },
      { semesterId: 'sem-6', semesterOrdinal: 6, semesterGpa: 1.65, cgpa: 1.78, cumulativeCredits: 90, isBaseSnapshot: false },
      { semesterId: 'sem-7', semesterOrdinal: 7, semesterGpa: 1.60, cgpa: 1.76, cumulativeCredits: 90, isBaseSnapshot: false },
    ],
    probationCounter: { studentId: 'nourhan-1', count: 6, armed: true }, // confirmed by replay: sem2..sem7 = 6 consecutive increments
  },
  {
    // §11 Examples I/K — CGPA remains < 2.00 under every in-faculty
    // alternative; struggles are concentrated in the basic-science courses
    // common to the whole faculty (not department electives), so an
    // external faculty transfer is the live demo for buildTransferSemester
    // + executeExternalTransfer against real seeded equivalency rows.
    id: 'hassan-1',
    name: 'Hassan (faculty transfer — Examples I/K)',
    facultyId: 'ENG',
    departmentId: 'ECE',
    status: 'active',
    activeBaseSnapshotId: null,
    cumulativeEarnedCredits: 40,
    level: 2,
    quizAnswers: {
      // business/analyst-leaning answers -> strong BUS faculty fit
      q1_problem_style: 'q1_people',
      q2_favorite_subject: 'q2_econ',
      q3_project_role: 'q3_lead',
      q4_ideal_job: 'q4_analyst',
    },
    allAttempts: [
      attempt('MTH111', 65, 1), attempt('PHY111', 54, 1), attempt('CHM111', 60, 1),
      attempt('MTH121', 78, 2), attempt('PHY121', 58, 2),
      attempt('CSE211', 82, 3), attempt('ECE211', 50, 3),
      attempt('CSE213', 60, 4), attempt('ECE221', 48, 4),
    ],
    cgpaSnapshots: [
      { semesterId: 'sem-1', semesterOrdinal: 1, semesterGpa: 1.95, cgpa: 1.95, cumulativeCredits: 13, isBaseSnapshot: false },
      { semesterId: 'sem-2', semesterOrdinal: 2, semesterGpa: 1.85, cgpa: 1.88, cumulativeCredits: 27, isBaseSnapshot: false },
      { semesterId: 'sem-3', semesterOrdinal: 3, semesterGpa: 1.80, cgpa: 1.82, cumulativeCredits: 40, isBaseSnapshot: false },
      { semesterId: 'sem-4', semesterOrdinal: 4, semesterGpa: 1.75, cgpa: 1.75, cumulativeCredits: 40, isBaseSnapshot: false },
    ],
    probationCounter: { studentId: 'hassan-1', count: 3, armed: true }, // confirmed by replay: sem2..sem4 = 3 consecutive increments
  },
  {
    // §11 Example M — mandatory F-retake credits exceed the probation cap.
    id: 'fatma-1',
    name: 'Fatma (mandatory-overflow — Example M)',
    facultyId: 'ENG',
    departmentId: 'ECE',
    status: 'active',
    activeBaseSnapshotId: null,
    cumulativeEarnedCredits: 44,
    level: 2,
    quizAnswers: {},
    allAttempts: [
      attempt('MTH111', 72, 1), attempt('CHM111', 68, 1),
      attempt('MTH121', 70, 2),
      // Five F-grade courses (several coreq-bundled with 1-credit labs) —
      // mandatory reserved credits (16) exceed the 14-credit probation cap,
      // so packPlan's overflow rule (§5.2) must carry the lowest
      // chain-unlock-value bundle(s) to next semester.
      attempt('PHY121', 52, 2), attempt('PHY122', 50, 2),
      attempt('ECE314', 55, 3), attempt('ECE315', 53, 3),
      attempt('ECE317', 50, 3), attempt('ECE318', 48, 3),
      attempt('ECE221', 54, 3), attempt('ECE222', 51, 3),
      attempt('ECE211', 50, 3), attempt('ECE212', 49, 3),
    ],
    cgpaSnapshots: [
      { semesterId: 'sem-1', semesterOrdinal: 1, semesterGpa: 1.70, cgpa: 1.70, cumulativeCredits: 5, isBaseSnapshot: false },
      { semesterId: 'sem-2', semesterOrdinal: 2, semesterGpa: 1.55, cgpa: 1.62, cumulativeCredits: 8, isBaseSnapshot: false },
      { semesterId: 'sem-3', semesterOrdinal: 3, semesterGpa: 1.40, cgpa: 1.60, cumulativeCredits: 44, isBaseSnapshot: false },
    ],
    probationCounter: { studentId: 'fatma-1', count: 2, armed: true }, // confirmed by replay
  },
  {
    // §11 Scenario N — high-value venture match. Exceptional embedded/
    // microcontrollers/ML grades, CGPA 3.4, improving trend — the exact
    // persona the worked example describes. His Venture Gate/Interest Form
    // answers are deliberately left UNANSWERED here (not pre-seeded) so the
    // full live flow (gate -> form -> match -> card -> express interest)
    // can be demoed end-to-end through the UI, not just replayed from seed
    // state — matching how the retake gate/other preferences work.
    id: 'mohamed-1',
    name: 'Mohamed (venture match — Scenario N)',
    facultyId: 'ENG',
    departmentId: 'ECE',
    status: 'active',
    activeBaseSnapshotId: null,
    cumulativeEarnedCredits: 100,
    level: 3,
    quizAnswers: {},
    allAttempts: [
      attempt('MTH111', 90, 1), attempt('PHY111', 88, 1), attempt('CHM111', 85, 1),
      attempt('MTH121', 92, 2), attempt('PHY121', 89, 2),
      attempt('CSE211', 88, 3), attempt('ECE211', 90, 3),
      attempt('ECE221', 93, 4), attempt('CSE213', 87, 4), // Digital Logic Design — embedded foundation
      attempt('ECE310', 95, 5), attempt('ECE314', 88, 5), attempt('ECE316', 86, 5), attempt('ECE317', 91, 5), // Microprocessors/Microcontrollers
      attempt('ECE322', 90, 6), attempt('ECE324', 92, 6), attempt('ECE326', 89, 6), attempt('ECE328', 87, 6),
      attempt('ECE413', 94, 7), // Digital Communications Systems — proj-lora's required course
      attempt('ECEEL1', 93, 7), // Program Elective — seeded as machine_learning
      attempt('ECEEL2', 91, 7), // Program Elective — seeded as embedded_systems
    ],
    cgpaSnapshots: [
      { semesterId: 'sem-3', semesterOrdinal: 3, semesterGpa: 3.20, cgpa: 3.15, cumulativeCredits: 60, isBaseSnapshot: false },
      { semesterId: 'sem-4', semesterOrdinal: 4, semesterGpa: 3.35, cgpa: 3.25, cumulativeCredits: 80, isBaseSnapshot: false },
      { semesterId: 'sem-5', semesterOrdinal: 5, semesterGpa: 3.55, cgpa: 3.40, cumulativeCredits: 100, isBaseSnapshot: false },
    ],
    probationCounter: { studentId: 'mohamed-1', count: 0, armed: true },
  },
];

/** Turns a raw seed literal into a full `StoredStudent` by replaying its
 *  `cgpaSnapshots` through the real §4.1/§4.5 state machine
 *  (`replayProbationHistory`) to derive `probationLog` — and, for every
 *  student EXCEPT the dismissed one (whose seed literal's `count: 6` must
 *  win even though replay stops the loop right after reaching 6, same
 *  value either way), also overwrites `probationCounter` with the replayed
 *  result so the counter and its audit trail can never drift apart. */
function deriveStudent(s: SeedStudent): StoredStudent {
  const { counter, log } = replayProbationHistory(s.id, s.cgpaSnapshots);
  return {
    ...s,
    allAttempts: s.allAttempts.map(a => ({ ...a })),
    cgpaSnapshots: s.cgpaSnapshots.map(sn => ({ ...sn })),
    probationCounter: s.cgpaSnapshots.length > 0 ? counter : { ...s.probationCounter },
    probationLog: log,
    transferRecords: [],
    proposals: [],
    registeredCourses: [],
    ventureMatches: [],
    quizAnswers: { ...s.quizAnswers },
  };
}

const students = new Map<string, StoredStudent>(seedStudents.map(s => [s.id, deriveStudent(s)]));

/** §16.8 fixture — Ahmed is seeded with an already-`accepted` match against
 *  `proj-rf-full` (capacity 1), so that project is at capacity from the
 *  very first request, demonstrating the capacity-exclusion rule without
 *  requiring a live sequence of API calls first. */
function seedInitialVentureMatches(): void {
  const ahmed = students.get('ahmed-1');
  if (ahmed) {
    ahmed.ventureMatches.push({
      id: 'vmatch-seed-ahmed-rf-full',
      studentId: 'ahmed-1',
      ventureProjectId: 'proj-rf-full',
      matchScore: 0.85,
      status: 'accepted',
      createdAt: '2026-01-20T00:00:00.000Z',
    });
  }
}
seedInitialVentureMatches();

/** Demo fixture — EVERY Level 3+, non-dismissed student gets a pre-answered
 *  Venture Gate (YES) + Interest Form, so the Venture Board (student side)
 *  and every project's candidate list (Faculty Console side) show real,
 *  populated data for the whole eligible cohort out of the box — nobody
 *  has to click through the live gate/form flow first (product-owner
 *  follow-up: "build the Venture Board for all the students in the
 *  system"). Scores still vary hugely by transcript (most of these
 *  students are on the probation ladder and won't clear the 0.80 match
 *  threshold — that's realistic, not a bug), which is itself a useful demo
 *  of the ranking. The Venture Gate/Interest Form panel on the Venture
 *  Board tab (§16.1/§16.5) is still fully editable — pre-seeded is just the
 *  starting state, not a lock.
 *
 *  Two groups are deliberately NOT in this list, both for real business
 *  rules rather than any leftover "keep one persona blank for demo
 *  purposes" reason (that exception was retired this round — Mohamed used
 *  to be held out; he isn't anymore, see below):
 *  - Level 1–2 students (sara-1, karim-1, yara-1, hassan-1, fatma-1) — the
 *    Venture Gate is never even shown below Level 3 (§16.1/§16.8); seeding
 *    an answer for them would be answering a question the real UI never
 *    asks.
 *  - A dismissed student (nourhan-1) — every student self-service route,
 *    venture matching included, 403s for a dismissed student
 *    (`blockIfDismissed` in server.ts) regardless of any stored answer, so
 *    seeding one would be inert. */
const PRESEEDED_VENTURE_OPT_INS: Array<{ studentId: string; answers: VentureQuizAnswers }> = [
  // Ahmed: strong, good-standing — clears the match threshold (for both
  // proj-lora and proj-edge-ml), same as Mohamed below, giving a second
  // full express-interest/CV demo persona.
  { studentId: 'ahmed-1', answers: { v1_domain: 'v1_ml', v2_goal: 'v2_software', v3_role: 'v3_model' } },
  { studentId: 'omar-1', answers: { v1_domain: 'v1_embedded', v2_goal: 'v2_hardware', v3_role: 'v3_integrate' } },
  { studentId: 'mona-2', answers: { v1_domain: 'v1_circuits', v2_goal: 'v2_hardware', v3_role: 'v3_design' } },
  { studentId: 'youssef-3', answers: { v1_domain: 'v1_ml', v2_goal: 'v2_software', v3_role: 'v3_model' } },
  { studentId: 'laila-4', answers: { v1_domain: 'v1_rf', v2_goal: 'v2_research', v3_role: 'v3_pitch' } },
  { studentId: 'salma-1', answers: { v1_domain: 'v1_embedded', v2_goal: 'v2_startup', v3_role: 'v3_integrate' } },
  // Mohamed: §11 Scenario N's canonical answers, verbatim — same values the
  // worked example and every prior live-demo walkthrough used, so his
  // score/narrative is unchanged, just no longer gated behind a manual
  // click-through.
  { studentId: 'mohamed-1', answers: { v1_domain: 'v1_embedded', v2_goal: 'v2_software', v3_role: 'v3_integrate' } },
];
function seedInitialVentureOptIns(): void {
  for (const { studentId, answers } of PRESEEDED_VENTURE_OPT_INS) {
    ventureGateAnswers.set(studentId, true);
    ventureInterestAnswersMap.set(studentId, { ...answers });
  }
}
seedInitialVentureOptIns();

/** Demo-fixture seed, product-owner follow-up ("apply [the registered-
 *  course-in-transcript] changes... to all the students") — every active
 *  (non-dismissed) seeded student who has at least one freshly-eligible
 *  course gets ONE course pre-registered-but-ungraded, so the §15.3.1
 *  "registered — pending grade" transcript row and the Curriculum tab's
 *  `registered` status are visibly populated for the whole cohort from a
 *  cold server boot, not only for whichever student someone happens to run
 *  the live proposal/approve/choose flow for first. Picks the MOST ADVANCED
 *  fresh-eligible course `getEligibleCourses` offers, not the catalog's
 *  first — these seed transcripts are illustrative, not exhaustive (this
 *  file's own header comment), so nearly every seeded student still has
 *  some never-graded semester-1 UR filler course sitting "eligible";
 *  defaulting to that would register a Level 4 student into a semester-1
 *  elective, which reads as a seeding bug more than a demo. Estimates the
 *  registered course's expected grade from the student's own transcript
 *  mean — a lightweight stand-in for the real cohort/trend scoring
 *  pipeline (that pipeline lives one layer up, in repositoryBackedPorts.ts,
 *  and isn't available at this module's init time), same "good enough for
 *  a seed, not spec-complete" caveat as this file's other approximations.
 *  A dismissed student (nourhan-1) is skipped for the same real reason the
 *  venture opt-ins skip her: every self-service route, registration
 *  included, 403s once dismissed (`blockIfDismissed` in server.ts). */
function seedInitialRegisteredCourses(): void {
  for (const student of students.values()) {
    if (student.status === 'dismissed') continue;
    if (student.registeredCourses.length > 0) continue; // don't double-seed on repeated resets

    const freshEligible = getEligibleCourses(student.id).filter(e => !e.isRetake);
    if (freshEligible.length === 0) continue;
    const candidate = freshEligible.reduce((best, e) => (e.course.semesterOrdinal > best.course.semesterOrdinal ? e : best));

    const history = Object.values(getTranscript(student.id));
    const meanPct = history.length
      ? Math.round(history.reduce((sum, r) => sum + r.pct, 0) / history.length)
      : 75;
    const band = gradeFromPct(meanPct, candidate.course.isUR);

    const proposal: CourseProposal = {
      id: `seed-prop-${student.id}`,
      studentId: student.id,
      slotKey: candidate.course.code,
      courseCode: candidate.course.code,
      origin: 'system',
      expectedPct: meanPct,
      expectedLetter: band.letter,
      expectedPoints: band.pts,
      bestCasePct: meanPct,
      bestCaseLetter: band.letter,
      bestCasePoints: band.pts,
      advisorApproved: true,
      status: 'registered',
      createdAt: new Date().toISOString(),
    };
    student.proposals.push(proposal);

    const nextOrdinal = Math.max(0, ...student.cgpaSnapshots.map(s => s.semesterOrdinal)) + 1;
    student.registeredCourses.push({
      studentId: student.id,
      courseCode: candidate.course.code,
      semesterOrdinal: nextOrdinal,
      proposalId: proposal.id,
      registeredAt: new Date().toISOString(),
    });
  }
}
seedInitialRegisteredCourses();

/** Test-only: reinitialize the store from the seed data, so each test file
 *  can run against a clean slate instead of accumulating writes from
 *  earlier tests (this module is a singleton — writes persist across
 *  `import`s within the same process, same as a real connection pool
 *  would, so tests need an explicit reset rather than relying on
 *  module-reload isolation). Deep-clones the seed so no test can mutate
 *  the seed constants themselves. */
export function __resetForTests(): void {
  students.clear();
  for (const s of seedStudents) {
    students.set(s.id, deriveStudent(s));
  }
  retakePreferences.clear();
  ventureGateAnswers.clear();
  ventureInterestAnswersMap.clear();
  ventureProjects.length = 0;
  ventureProjects.push(...VENTURE_PROJECTS.map(p => ({ ...p })));
  seedInitialVentureMatches();
  seedInitialVentureOptIns();
  seedInitialRegisteredCourses();
}

// ---------------------------------------------------------------------
// Read API
// ---------------------------------------------------------------------
export function listStudents(): StoredStudent[] {
  return [...students.values()];
}

export function getStudent(id: string): StoredStudent | undefined {
  return students.get(id);
}

/** §2.2's replacement rule applied at read time — one row per course code,
 *  the latest counting attempt. */
export function getTranscript(id: string): Transcript {
  const student = students.get(id);
  if (!student) return {};
  const latest = latestAttemptPerCourse(student.allAttempts);
  return Object.fromEntries(latest.map(r => [r.courseCode, r]));
}

/** Current CGPA, honoring `activeBaseSnapshotId` -> `sinceSemesterOrdinal`
 *  anchoring (§7.2.3) once transfer execution sets one. */
export function getCurrentCgpa(id: string): number {
  const student = students.get(id);
  if (!student) return 0;
  const latest = latestAttemptPerCourse(student.allAttempts);
  const sinceOrdinal = student.activeBaseSnapshotId
    ? student.cgpaSnapshots.find(s => s.semesterId === student.activeBaseSnapshotId)?.semesterOrdinal
    : undefined;
  return computeCGPA({ latestAttempts: latest, courseByCode, sinceSemesterOrdinal: sinceOrdinal });
}

/** Product-owner rule: the general one-level lookahead below (a student may
 *  preview next level's courses before formally reaching it) explicitly
 *  does NOT extend into Level 4 — semester 7/8 subjects can never be
 *  eligible-for-recommendation until the student has actually reached
 *  Level 4. Shared by `getEligibleCourses` (feeds every recommendation
 *  route — /eligible-courses, /advise, /plan/fast, /plan/target, proposals)
 *  and `getCurriculum` (the Curriculum tab) so the two views never
 *  disagree about what's reachable. */
function isLevelReachable(courseLevel: number, studentLevel: number): boolean {
  if (courseLevel >= 4) return studentLevel >= courseLevel;
  return courseLevel <= studentLevel + 1;
}

/** Simple demo eligibility rule (NOT the full §1.2/§5 engine, which lives
 *  in `modules/courses/*` — those directories exist but are empty per
 *  PROGRESS.md item 5/6; this is a good-enough stand-in for the demo):
 *  a course is a *fresh* candidate if its prereqs are all passed (>= pass
 *  mark) and it hasn't been attempted yet; it's a *retake* candidate if
 *  the latest attempt on it is D, D+, or F. */
export function getEligibleCourses(id: string): Array<{ course: Course; isRetake: boolean; oldLetter: string | null; oldPoints: number | null }> {
  const student = students.get(id);
  if (!student) return [];
  const transcript = getTranscript(id);
  const passedCodes = new Set(
    Object.values(transcript)
      .filter(r => courseByCode[r.courseCode] && r.pct >= (courseByCode[r.courseCode].isUR ? 50 : 60) && !['D', 'D+', 'F'].includes(r.letter))
      .map(r => r.courseCode)
  );

  const results: Array<{ course: Course; isRetake: boolean; oldLetter: string | null; oldPoints: number | null }> = [];

  for (const course of CATALOG) {
    const rec = transcript[course.code];
    if (rec && ['D', 'D+', 'F'].includes(rec.letter)) {
      results.push({ course, isRetake: true, oldLetter: rec.letter, oldPoints: rec.points });
      continue;
    }
    if (rec) continue; // already passed with C or better — not offered again
    if (!isLevelReachable(course.level, student.level)) continue; // not yet reachable
    const prereqsMet = course.prereq.every(p => passedCodes.has(p));
    if (!prereqsMet) continue;
    results.push({ course, isRetake: false, oldLetter: null, oldPoints: null });
  }
  return results;
}

/** A transcript row for display purposes only: a real graded attempt
 *  (`status: 'completed'`, same fields `getTranscript` always returned) OR a
 *  §15.3.1 `RegisteredCourse` that hasn't been graded yet (`status:
 *  'registered'`, grade fields all `null`). This is purely a read-time
 *  merge for the UI — `RegisteredCourse` and `EnrollmentRecord` stay two
 *  separate stored shapes (see that type's doc comment: registering never
 *  touches CGPA), nothing here is persisted. A course that was registered
 *  and has since actually been graded only shows its completed row, never
 *  both. */
export type TranscriptRowStatus = 'completed' | 'registered';
export interface TranscriptRowView {
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

export function getTranscriptWithRegistered(id: string): TranscriptRowView[] {
  const student = students.get(id);
  if (!student) return [];
  const transcript = getTranscript(id);

  const completedRows: TranscriptRowView[] = Object.values(transcript).map(r => ({
    courseCode: r.courseCode,
    semesterOrdinal: r.semesterOrdinal,
    status: 'completed',
    attemptNumber: r.attemptNumber,
    pct: r.pct,
    letter: r.letter,
    points: r.points,
    isRetake: r.isRetake,
    countsInCgpa: r.countsInCgpa,
    registeredAt: null,
  }));

  const pendingRows: TranscriptRowView[] = student.registeredCourses
    .filter(rc => !transcript[rc.courseCode]) // a since-graded registration shows as its completed row only
    .map(rc => ({
      courseCode: rc.courseCode,
      semesterOrdinal: rc.semesterOrdinal,
      status: 'registered',
      attemptNumber: null,
      pct: null,
      letter: null,
      points: null,
      isRetake: false,
      countsInCgpa: false,
      registeredAt: rc.registeredAt,
    }));

  return [...completedRows, ...pendingRows].sort(
    (a, b) => a.semesterOrdinal - b.semesterOrdinal || a.courseCode.localeCompare(b.courseCode)
  );
}

/** The full catalog (`seedCatalog.ts`'s `CATALOG`), one row per course, each
 *  annotated with THIS student's status on it — the data behind the
 *  per-semester Curriculum tab. Reuses `getEligibleCourses`' own
 *  passed/reachable/prereqs-met rules (§1.2/§5 demo stand-in, same caveat
 *  as that function) so the two views never disagree about what counts as
 *  "eligible." */
export type CurriculumCourseStatus = 'passed' | 'needs_retake' | 'registered' | 'eligible' | 'locked';
export interface CurriculumCourseView {
  course: Course;
  status: CurriculumCourseStatus;
  letter: string | null;
  pct: number | null;
  points: number | null;
  attemptNumber: number | null;
  registeredAt: string | null;
}

export function getCurriculum(id: string): CurriculumCourseView[] {
  const student = students.get(id);
  if (!student) return [];
  const transcript = getTranscript(id);
  const registeredByCode = new Map(
    student.registeredCourses.filter(rc => !transcript[rc.courseCode]).map(rc => [rc.courseCode, rc])
  );
  const passedCodes = new Set(
    Object.values(transcript)
      .filter(r => courseByCode[r.courseCode] && r.pct >= (courseByCode[r.courseCode].isUR ? 50 : 60) && !['D', 'D+', 'F'].includes(r.letter))
      .map(r => r.courseCode)
  );

  return CATALOG.map((course): CurriculumCourseView => {
    const rec = transcript[course.code];
    if (rec) {
      const passed = !['D', 'D+', 'F'].includes(rec.letter);
      return {
        course, status: passed ? 'passed' : 'needs_retake',
        letter: rec.letter, pct: rec.pct, points: rec.points, attemptNumber: rec.attemptNumber,
        registeredAt: null,
      };
    }
    const reg = registeredByCode.get(course.code);
    if (reg) {
      return { course, status: 'registered', letter: null, pct: null, points: null, attemptNumber: null, registeredAt: reg.registeredAt };
    }
    const reachable = isLevelReachable(course.level, student.level);
    const prereqsMet = course.prereq.every(p => passedCodes.has(p));
    return {
      course, status: reachable && prereqsMet ? 'eligible' : 'locked',
      letter: null, pct: null, points: null, attemptNumber: null, registeredAt: null,
    };
  });
}

// ---------------------------------------------------------------------
// Write / modify API — this is the part that shows data actually being
// saved and changed, not just read. Every mutation here is what a real
// repository's `UPDATE ... WHERE` would do.
// ---------------------------------------------------------------------

/** Records a new attempt at a course (a grade entry or a retake), applying
 *  the replacement rule on the NEXT read (never destructively rewriting
 *  history — see `allAttempts`' doc comment above). Returns the recomputed
 *  CGPA so callers can show the immediate effect of the write. */
export function recordEnrollment(studentId: string, courseCode: string, pct: number, semesterOrdinal: number): { newCgpa: number; recordedAttempt: EnrollmentRecord } {
  const student = students.get(studentId);
  if (!student) throw new Error(`no such student ${studentId}`);
  const course = courseByCode[courseCode];
  if (!course) throw new Error(`no such course ${courseCode}`);

  const priorAttempts = student.allAttempts.filter(a => a.courseCode === courseCode);
  const attemptNumber = priorAttempts.length + 1;
  const record = attempt(courseCode, pct, semesterOrdinal, attemptNumber);

  student.allAttempts.push(record); // the actual "save" — mutates the store
  const newCgpa = getCurrentCgpa(studentId);
  return { newCgpa, recordedAttempt: record };
}

// ---------------------------------------------------------------------
// §5 retake preference gate — persisted per student, re-asked (and
// overwritten) every planning session per spec §1.1's RetakePreference note
// ("a student's willingness can change each semester").
// ---------------------------------------------------------------------
const retakePreferences = new Map<string, boolean>();

export function setRetakePreference(studentId: string, considerRetakes: boolean): void {
  if (!students.has(studentId)) throw new Error(`no such student ${studentId}`);
  retakePreferences.set(studentId, considerRetakes);
}

/** Defaults to `true` (the pre-existing demo default) when the student
 *  hasn't answered the gate yet this session. */
export function getRetakePreference(studentId: string): boolean {
  return retakePreferences.get(studentId) ?? true;
}

export function setQuizAnswers(studentId: string, answers: Record<string, string>): void {
  const student = students.get(studentId);
  if (!student) throw new Error(`no such student ${studentId}`);
  student.quizAnswers = { ...student.quizAnswers, ...answers }; // the "save"
}

export function updateStudentStatus(studentId: string, status: StudentStatus): void {
  const student = students.get(studentId);
  if (!student) throw new Error(`no such student ${studentId}`);
  student.status = status;
}

// ---------------------------------------------------------------------
// §7 Transfer execution — wires the pure modules/transfer/* functions to
// real (in-memory) student state, so /transfer/* routes have something
// real to call.
// ---------------------------------------------------------------------

export function getProbationHistory(studentId: string): { counter: ProbationCounterState; log: ProbationCounterLogEntry[] } {
  const student = students.get(studentId);
  if (!student) throw new Error(`no such student ${studentId}`);
  return { counter: student.probationCounter, log: student.probationLog };
}

export function getTransferRecords(studentId: string): TransferRecord[] {
  return students.get(studentId)?.transferRecords ?? [];
}

/** §4.2.1 guard input. */
export function hasInternalTransfer(studentId: string): boolean {
  return getTransferRecords(studentId).some(r => r.type === 'internal_department');
}

/** Which course codes count as "mapping to a requirement slot" in a given
 *  department, for §7.1's excess-credit determination: every non-`program`
 *  category course (UR/faculty/school/special/program_elective) is shared
 *  across departments and always remaps; `program`-category courses only
 *  remap if they're in the TARGET department's own gateway-course list. This
 *  demo only has one full seeded catalog (ECE, see seedCatalog.ts) — a real
 *  system would look this up from each department's own curriculum map. */
function courseCodesForDepartment(departmentId: string): Set<string> {
  const dept = [...DEPARTMENTS, ...OTHER_FACULTY_DEPARTMENTS].find(d => d.id === departmentId);
  const shared = CATALOG.filter(c => c.category !== 'program').map(c => c.code);
  return new Set([...shared, ...(dept?.gatewayCourseCodes ?? [])]);
}

/** §7.1 — commits an internal (intra-faculty) department transfer. */
export function executeInternalTransferForStudent(studentId: string, toDepartmentId: string, semesterId: string) {
  const student = students.get(studentId);
  if (!student) throw new Error(`no such student ${studentId}`);
  const transcript = getTranscript(studentId);
  const passedCourses = Object.values(transcript)
    // §7 "passed courses" = anything but F (D/D+ are still passing grades,
    // unlike the stricter "counts toward prereq unlock" bar used elsewhere
    // in this file for getEligibleCourses — a different, institution-chosen
    // concept from simply having passed and earned the credit).
    .filter(r => courseByCode[r.courseCode] && r.letter !== 'F')
    .map(r => ({ courseCode: r.courseCode, category: courseByCode[r.courseCode].category }));

  const result = executeInternalTransfer({
    studentId,
    facultyId: student.facultyId,
    fromDepartmentId: student.departmentId,
    toDepartmentId,
    effectiveSemesterId: semesterId,
    cumulativeEarnedCredits: student.cumulativeEarnedCredits,
    passedCourses,
    newDepartmentCourseCodes: courseCodesForDepartment(toDepartmentId),
    counterCountAtTransfer: student.probationCounter.count,
  });

  student.departmentId = result.departmentId;
  student.level = result.level;
  student.transferRecords.push(result.transferRecord);
  student.probationLog.push(result.probationLog); // logged as unchanged, spec §7.1
  return result;
}

/** §7.2.2 dry run — the `/transfer/preview` route calls this without
 *  mutating anything, so the student can see what would/wouldn't transfer
 *  before committing. */
export function previewExternalTransfer(studentId: string, toFacultyId: string, semesterId = 'transfer-preview') {
  const student = students.get(studentId);
  if (!student) throw new Error(`no such student ${studentId}`);
  const transcript = getTranscript(studentId);
  const passedCourses: TransferableCourseCandidate[] = Object.values(transcript)
    // §7 "passed courses" = anything but F (D/D+ are still passing grades,
    // unlike the stricter "counts toward prereq unlock" bar used elsewhere
    // in this file for getEligibleCourses — a different, institution-chosen
    // concept from simply having passed and earned the credit).
    .filter(r => courseByCode[r.courseCode] && r.letter !== 'F')
    .map(r => {
      const course = courseByCode[r.courseCode];
      return {
        courseCode: r.courseCode,
        category: course.category,
        isBasicScience: course.isBasicScience,
        credits: course.credits,
        pct: r.pct,
        letter: r.letter,
        points: r.points,
      };
    });
  const nextOrdinal = Math.max(0, ...student.cgpaSnapshots.map(s => s.semesterOrdinal)) + 1;
  return buildTransferSemester({ toFacultyId, semesterId, ordinal: nextOrdinal, passedCourses, equivalencyMap: EQUIVALENCY_MAP });
}

/** §7.2.3 — commits an external (inter-faculty) transfer: builds the real
 *  Transfer Semester, anchors CGPA to it as the new base snapshot, resets
 *  the probation counter, and recomputes level off the transferred credits. */
export function executeExternalTransferForStudent(studentId: string, toFacultyId: string, toDepartmentId: string) {
  const student = students.get(studentId);
  if (!student) throw new Error(`no such student ${studentId}`);
  const semesterId = `transfer-${studentId}-${Date.now()}`;
  const preview = previewExternalTransfer(studentId, toFacultyId, semesterId);

  const result = executeExternalTransfer({
    studentId,
    fromFacultyId: student.facultyId,
    toFacultyId,
    toDepartmentId,
    transferSemester: preview,
    counterCountBeforeTransfer: student.probationCounter.count,
  });

  // Spec §7.2.2's pseudocode: "for c in courses: Enrollment{semesterId: ts.id,
  // ...}" — the Transfer Semester creates NEW enrollment rows at the new
  // semester's ordinal, it doesn't just reuse the old-faculty attempt. This
  // is what makes `sinceSemesterOrdinal`-anchored CGPA math (§7.2.3/§2.2)
  // actually see these courses once the base snapshot is set — otherwise
  // they'd stay stranded at their original (pre-transfer, now-excluded) ordinal.
  for (const c of preview.transferredCourses) {
    const priorAttempts = student.allAttempts.filter(a => a.courseCode === c.courseCode);
    student.allAttempts.push({
      courseCode: c.courseCode,
      attemptNumber: priorAttempts.length + 1,
      pct: c.pct,
      letter: c.letter,
      points: c.points,
      isRetake: false,
      countsInCgpa: true,
      semesterOrdinal: preview.ordinal,
    });
  }

  student.facultyId = result.facultyId;
  student.departmentId = result.departmentId;
  student.level = result.level;
  student.cumulativeEarnedCredits = result.activeBaseSnapshot.cumulativeCredits;
  student.cgpaSnapshots.push(result.activeBaseSnapshot);
  student.activeBaseSnapshotId = result.activeBaseSnapshot.semesterId;
  student.probationCounter = result.counter;
  student.probationLog.push(result.probationLog);
  student.transferRecords.push(result.transferRecord);
  return result;
}

// ---------------------------------------------------------------------
// §15.3 Course proposals / dual-approval registration workflow
// ---------------------------------------------------------------------

function findStudentByProposalId(proposalId: string): StoredStudent {
  for (const s of students.values()) {
    if (s.proposals.some(p => p.id === proposalId)) return s;
  }
  throw new Error(`no such proposal ${proposalId}`);
}

export function getProposals(studentId: string): CourseProposal[] {
  return students.get(studentId)?.proposals ?? [];
}

/** §15.3.2 step 1 — adds one pending system proposal per NEW slot in
 *  `plan` (skips slots that already have any proposal on record, so
 *  repeat /advise runs never clobber an advisor's prior review). */
export function addProposalsFromPlan(studentId: string, plan: CandidateCourseScore[]): CourseProposal[] {
  const student = students.get(studentId);
  if (!student) throw new Error(`no such student ${studentId}`);
  const existingSlots = new Set(student.proposals.map(p => p.slotKey));
  const transcript = getTranscript(studentId);
  const history = Object.values(transcript);

  const bestCaseByCode: Record<string, { bestCasePct: number; bestCaseLetter: string; bestCasePoints: number }> = {};
  for (const c of plan) {
    if (c.mandatory || existingSlots.has(c.courseCode)) continue;
    const course = courseByCode[c.courseCode];
    if (!course) continue;
    bestCaseByCode[c.courseCode] = bestCasePct(course, history, courseByCode, c.expectedPct);
  }

  const freshPlan = plan.filter(c => !existingSlots.has(c.courseCode));
  const newProposals = buildProposalsFromPlan(studentId, freshPlan, bestCaseByCode);
  student.proposals.push(...newProposals);
  return student.proposals;
}

export function approveProposalById(proposalId: string): CourseProposal {
  const student = findStudentByProposalId(proposalId);
  const idx = student.proposals.findIndex(p => p.id === proposalId);
  student.proposals[idx] = approveProposal(student.proposals[idx]);
  return student.proposals[idx];
}

export function declineProposalById(proposalId: string): CourseProposal {
  const student = findStudentByProposalId(proposalId);
  const idx = student.proposals.findIndex(p => p.id === proposalId);
  student.proposals[idx] = declineProposal(student.proposals[idx]);
  return student.proposals[idx];
}

export interface CandidateScoreFields {
  courseCode: string;
  expectedPct: number;
  expectedLetter: string;
  expectedPoints: number;
  bestCasePct: number;
  bestCaseLetter: string;
  bestCasePoints: number;
}

/** Turns an already-`ports.scoreEligibleCourse`'d candidate into the full
 *  expected+best-case field set a `CourseProposal` carries — shared by
 *  `addAdvisorAlternateProposal` (persists) and `previewAdvisorAlternate`
 *  (doesn't) so the two can never compute a course's projected grade
 *  differently. */
function scoreCandidateFields(
  studentId: string,
  courseCode: string,
  scored: { expectedPct: number; expectedLetter: string; expectedPoints: number }
): CandidateScoreFields {
  const course = courseByCode[courseCode];
  if (!course) throw new Error(`no such course ${courseCode}`);
  const history = Object.values(getTranscript(studentId));
  const bestCase = bestCasePct(course, history, courseByCode, scored.expectedPct);
  return {
    courseCode,
    expectedPct: scored.expectedPct,
    expectedLetter: scored.expectedLetter,
    expectedPoints: scored.expectedPoints,
    bestCasePct: bestCase.bestCasePct,
    bestCaseLetter: bestCase.bestCaseLetter,
    bestCasePoints: bestCase.bestCasePoints,
  };
}

/** Dry run — lets the advisor see a candidate alternate's expected AND
 *  best-case grade (and, on the frontend, its grade-point consequence
 *  versus the system's originally recommended course) before committing to
 *  proposing it. Never persists anything, same "preview vs. commit" shape
 *  as `previewExternalTransfer` above. */
export function previewAdvisorAlternate(
  studentId: string,
  courseCode: string,
  scored: { expectedPct: number; expectedLetter: string; expectedPoints: number }
): CandidateScoreFields {
  if (!students.get(studentId)) throw new Error(`no such student ${studentId}`);
  return scoreCandidateFields(studentId, courseCode, scored);
}

/** §15.3.2 step 2(b) — the caller (server.ts) has already scored
 *  `courseCode` for real via the same §3.1 engine used everywhere else;
 *  this just persists the resulting advisor-authored proposal. */
export function addAdvisorAlternateProposal(
  studentId: string,
  slotKey: string,
  courseCode: string,
  scored: { expectedPct: number; expectedLetter: string; expectedPoints: number }
): CourseProposal {
  const student = students.get(studentId);
  if (!student) throw new Error(`no such student ${studentId}`);
  const fields = scoreCandidateFields(studentId, courseCode, scored);

  const proposal = buildAdvisorAlternate({
    studentId,
    slotKey,
    courseCode,
    expectedPct: fields.expectedPct,
    expectedLetter: fields.expectedLetter,
    expectedPoints: fields.expectedPoints,
    bestCase: { bestCasePct: fields.bestCasePct, bestCaseLetter: fields.bestCaseLetter, bestCasePoints: fields.bestCasePoints },
  });
  student.proposals.push(proposal);
  return proposal;
}

/** §15.3.2 step 3. On success, also writes the RegisteredCourse row
 *  (§15.3.1) in the same call — no separate confirmation step. */
export function chooseProposalById(studentId: string, proposalId: string) {
  const student = students.get(studentId);
  if (!student) throw new Error(`no such student ${studentId}`);
  const idx = student.proposals.findIndex(p => p.id === proposalId);
  if (idx === -1) throw new Error(`no such proposal ${proposalId} for ${studentId}`);

  const result = chooseProposal(student.proposals[idx]);
  student.proposals[idx] = result.proposal;

  if (result.registered) {
    const nextOrdinal = Math.max(0, ...student.cgpaSnapshots.map(s => s.semesterOrdinal)) + 1;
    const registered: RegisteredCourse = {
      studentId,
      courseCode: result.proposal.courseCode,
      semesterOrdinal: nextOrdinal,
      proposalId: result.proposal.id,
      registeredAt: new Date().toISOString(),
    };
    student.registeredCourses.push(registered);
  }

  return result;
}

export function getRegisteredCourses(studentId: string): RegisteredCourse[] {
  return students.get(studentId)?.registeredCourses ?? [];
}

/** §15.4 — the roster aggregate the advisor's PDF report is built from. */
export function getAdvisorReport(): AdvisorReportRow[] {
  return listStudents().map(s => ({
    studentId: s.id,
    name: s.name,
    cgpa: getCurrentCgpa(s.id),
    probationCount: s.probationCounter.count,
    pendingCount: s.proposals.filter(p => p.status === 'pending').length,
    advisorApprovedCount: s.proposals.filter(p => p.status === 'advisor_approved').length,
    registeredCount: s.proposals.filter(p => p.status === 'registered').length,
  }));
}

// ---------------------------------------------------------------------
// §16 Innovation & Venture Catalyst
// ---------------------------------------------------------------------

/** Mutable clone of the seed list — professors create/edit projects at
 *  runtime (§16.6), so this can't be the frozen seed array itself. */
const ventureProjects: VentureProject[] = VENTURE_PROJECTS.map(p => ({ ...p }));

export function setVentureGateAnswer(studentId: string, interested: boolean): void {
  if (!students.has(studentId)) throw new Error(`no such student ${studentId}`);
  ventureGateAnswers.set(studentId, interested);
}

/** `null` = not answered yet this session — distinct from `false`, so
 *  callers can tell "never asked" from "asked and declined." */
export function getVentureGateAnswer(studentId: string): boolean | null {
  return ventureGateAnswers.get(studentId) ?? null;
}

export function setVentureInterestAnswers(studentId: string, answers: VentureQuizAnswers): void {
  if (!students.has(studentId)) throw new Error(`no such student ${studentId}`);
  ventureInterestAnswersMap.set(studentId, { ...ventureInterestAnswersMap.get(studentId), ...answers });
}

export function getVentureInterestAnswers(studentId: string): VentureQuizAnswers {
  return ventureInterestAnswersMap.get(studentId) ?? {};
}

function acceptedCountForProject(projectId: string): number {
  let n = 0;
  for (const s of students.values()) {
    if (s.ventureMatches.some(m => m.ventureProjectId === projectId && m.status === 'accepted')) n += 1;
  }
  return n;
}

function buildVentureFitInput(studentId: string) {
  const transcript = getTranscript(studentId);
  const student = students.get(studentId)!;
  const trend = projectCGPATrend(student.cgpaSnapshots);
  return {
    transcript,
    ventureInterestAnswers: getVentureInterestAnswers(studentId),
    courseSkillTags: COURSE_SKILL_TAGS,
    electiveCourseCodes: ELECTIVE_COURSE_CODES,
    cgpa: getCurrentCgpa(studentId),
    trendSlope: trend.slope,
  };
}

/** §16.8 — level < minLevel (default 3) or gate !== true both mean "do
 *  nothing," same short-circuit as the trend-based tier-1 fast path
 *  elsewhere in this system: no scoring work is done, an empty list comes
 *  back. Level/gate eligibility is deliberately checked here (not only in
 *  server.ts) so every caller — the HTTP route AND §8 step 12's card
 *  injection inside /advise — gets the same guarantee for free. */
export function getVentureMatches(studentId: string): VentureMatchResult[] {
  const student = students.get(studentId);
  if (!student) return [];
  if (student.level < weights.ventureFit.minLevel) return [];
  if (getVentureGateAnswer(studentId) !== true) return [];

  const fitInput = buildVentureFitInput(studentId);
  const candidateProjects = ventureProjects.filter(p => {
    if (!p.isActive) return false;
    const alreadyMatched = student.ventureMatches.some(m => m.ventureProjectId === p.id);
    if (alreadyMatched) return true; // §16.2 — never let an existing match vanish because the project later filled up
    return acceptedCountForProject(p.id) < p.capacity;
  });

  const { results, newlySuggested } = computeMatchesForStudent(studentId, fitInput, candidateProjects, student.ventureMatches);
  if (newlySuggested.length > 0) student.ventureMatches.push(...newlySuggested);
  return results;
}

/** §16.4 — the single gold-highlighted card the Plan Results screen (both
 *  advisor and student portal) injects above the course slips, or `null`
 *  when nothing qualifies. Reuses `getVentureMatches`, so it respects the
 *  exact same level/gate/capacity rules — no separate code path to drift. */
export function getTopVentureCardMatch(studentId: string): VentureMatchResult | null {
  const results = getVentureMatches(studentId);
  const top = results[0];
  if (!top || top.total < weights.ventureFit.matchThreshold) return null;
  return top;
}

/** §16.3.2 step 3 — the student clicks "Express Interest," optionally
 *  attaching a CV in the same action (§16.4). */
export function applyToVentureMatch(studentId: string, matchId: string, cv?: CvAttachment): StudentVentureMatch {
  const student = students.get(studentId);
  if (!student) throw new Error(`no such student ${studentId}`);
  const idx = student.ventureMatches.findIndex(m => m.id === matchId);
  if (idx === -1) throw new Error(`no such venture match ${matchId} for ${studentId}`);
  student.ventureMatches[idx] = applyToMatch(student.ventureMatches[idx], cv);
  return student.ventureMatches[idx];
}

/** Product-owner follow-up to §16.4 — a student can express interest (and
 *  attach a CV) in ANY project that appears on their Venture Board, not
 *  only ones that already cleared `matchThreshold` and have a persisted
 *  `suggested` row (`matchId`). If a row already exists (whatever its
 *  status), this behaves exactly like `applyToVentureMatch`. If it
 *  doesn't — a below-threshold project the student wants to apply to
 *  anyway — one is created fresh, straight to `applied`, scored the same
 *  way the automatic pass would have scored it. */
export function applyToVentureProject(studentId: string, projectId: string, cv?: CvAttachment): StudentVentureMatch {
  const student = students.get(studentId);
  if (!student) throw new Error(`no such student ${studentId}`);
  const project = getVentureProject(projectId);
  if (!project) throw new Error(`no such venture project ${projectId}`);

  const idx = student.ventureMatches.findIndex(m => m.ventureProjectId === projectId);
  if (idx !== -1) {
    student.ventureMatches[idx] = applyToMatch(student.ventureMatches[idx], cv);
    return student.ventureMatches[idx];
  }

  const fitInput = buildVentureFitInput(studentId);
  const breakdown = ventureFitScore(fitInput, project);
  const created = createDirectApplication(studentId, projectId, breakdown.total, cv);
  student.ventureMatches.push(created);
  return created;
}

export function getVentureMatchesForStudent(studentId: string): StudentVentureMatch[] {
  return students.get(studentId)?.ventureMatches ?? [];
}

// --- §16.6 Faculty Console: professor-facing reads/writes ---

export function listProfessors(): ProfessorProfile[] {
  return PROFESSORS;
}

export function getProfessor(id: string): ProfessorProfile | undefined {
  return PROFESSORS.find(p => p.id === id);
}

export function listVentureProjects(): VentureProject[] {
  return ventureProjects;
}

export function getVentureProject(id: string): VentureProject | undefined {
  return ventureProjects.find(p => p.id === id);
}

export function listVentureProjectsByProfessor(professorId: string): VentureProject[] {
  return ventureProjects.filter(p => p.professorId === professorId);
}

let ventureProjectIdCounter = 0;
export function createVentureProject(input: Omit<VentureProject, 'id' | 'createdAt'>): VentureProject {
  ventureProjectIdCounter += 1;
  const project: VentureProject = { ...input, id: `vproj-${Date.now()}-${ventureProjectIdCounter}`, createdAt: new Date().toISOString() };
  ventureProjects.push(project);
  return project;
}

export function updateVentureProject(id: string, patch: Partial<Omit<VentureProject, 'id' | 'professorId' | 'createdAt'>>): VentureProject {
  const idx = ventureProjects.findIndex(p => p.id === id);
  if (idx === -1) throw new Error(`no such venture project ${id}`);
  ventureProjects[idx] = { ...ventureProjects[idx], ...patch };
  return ventureProjects[idx];
}

/** §16.6 — every opted-in (Venture-Gate-YES) Level 3+ student's score
 *  against ONE specific project, ranked — not threshold-gated, since a
 *  professor is choosing among whoever's available, not just who already
 *  got a compact card. */
export interface VentureCandidateRow extends VentureFitBreakdown {
  studentId: string;
  studentName: string;
  matchId: string | null;
  status: string;
  /** §16.4/§16.6 — present once the student has expressed interest with a
   *  CV attached, so the professor can review it alongside the score. */
  cvFileName?: string;
  cvDataUrl?: string;
}

export function getVentureProjectCandidates(projectId: string): VentureCandidateRow[] {
  const project = getVentureProject(projectId);
  if (!project) throw new Error(`no such venture project ${projectId}`);

  const results: VentureCandidateRow[] = [];
  for (const s of students.values()) {
    if (s.level < weights.ventureFit.minLevel) continue;
    if (getVentureGateAnswer(s.id) !== true) continue;
    const fitInput = buildVentureFitInput(s.id);
    const breakdown = ventureFitScore(fitInput, project);
    const existing = s.ventureMatches.find(m => m.ventureProjectId === projectId);
    results.push({
      studentId: s.id,
      studentName: s.name,
      matchId: existing?.id ?? null,
      status: existing?.status ?? 'unscored',
      cvFileName: existing?.cvFileName,
      cvDataUrl: existing?.cvDataUrl,
      ...breakdown,
    });
  }
  results.sort((a, b) => b.total - a.total);
  return results;
}

/** §16.6 — professor accepts/declines an `applied` (or `suggested`)
 *  candidate. Accepting beyond `capacity` is refused, not silently allowed —
 *  the capacity-exclusion rule (§16.8) has to hold from the professor side
 *  too, not just the student-matching side. */
export function setVentureMatchStatusByProfessor(matchId: string, status: 'accepted' | 'declined'): StudentVentureMatch {
  for (const s of students.values()) {
    const idx = s.ventureMatches.findIndex(m => m.id === matchId);
    if (idx === -1) continue;
    const match = s.ventureMatches[idx];
    if (status === 'accepted') {
      const project = getVentureProject(match.ventureProjectId);
      if (project && acceptedCountForProject(match.ventureProjectId) >= project.capacity) {
        throw new Error(`venture project ${project.id} is already at capacity (${project.capacity})`);
      }
    }
    s.ventureMatches[idx] = setMatchStatus(match, status);
    return s.ventureMatches[idx];
  }
  throw new Error(`no such venture match ${matchId}`);
}

export { courseByCode };
