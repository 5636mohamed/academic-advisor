// HTTP surface for the whole system, wired to the in-memory store (see
// db/memory/inMemoryDb.ts's header for exactly how this differs from the
// real Prisma/Postgres layer described in spec §9.3 — still pending). This
// now covers every route in spec §9.2 that the in-memory store can
// meaningfully serve, plus the static demo frontend.
//
// Real backend authentication epic — every route below is now guarded by
// a real, server-verified session token (POST /api/auth/login issues it;
// modules/auth/guards.ts's authenticate/requireAuthRole/
// requireStudentAccess/requireAdvisorAccess/requireAdvisorOwnsStudent
// enforce it per-route). Before this, "auth" was a client-only demo — a
// plain localStorage blob, no server verification, any raw API call
// could ask for any id's data (see .github/SECURITY.md's rewritten
// Authentication section for the full before/after). What's STILL a
// deliberate simplification, not a gap: the passwords themselves remain
// shared, publicly-documented demo constants (one per role, not real
// per-user secrets — see docs/LOGIN_CREDENTIALS.md), and `PUT /api/
// admin/prediction-weights` still uses the older single `x-role` header
// (no login identity exists for that role in the app at all — explicitly
// out of scope for this epic, not silently inconsistent).
//
// `POST /semesters/:id/close` is exposed as `POST /students/:id/semesters/close`
// since this store doesn't have globally-addressable Semester rows outside
// their owning student.
import express from 'express';
import path from 'path';
import * as fs from 'fs';
import * as db from './db/memory/inMemoryDb';
import { runAdvisingCycle, StudentWithCgpa } from './modules/advising/advisingCycle.service';
import { buildRepositoryBackedPorts } from './modules/advising/repositoryBackedPorts';
import { assertNotDismissed, DismissedStudentError } from './modules/probation/dismissal.service';
import { onSemesterClose } from './modules/probation/probationCounter.service';
import { onFirstSemesterClose } from './modules/probation/firstSemesterRule.service';
import { projectCGPATrend } from './modules/prediction/cgpaTrendProjection';
import { deriveCgpaTrend } from './modules/grading/cgpa';
import { chainUnlockValue, clearChainUnlockCache } from './modules/prediction/chainUnlockValue';
import { CATALOG, CATALOG_BY_CODE, CATALOG_BY_DEPARTMENT, DEPARTMENTS_BY_COURSE_CODE } from './db/seed/seedCatalog';
import { OFFERINGS_BY_COURSE } from './db/seed/seedCourseOfferings';
import { buildCandidatePool } from './modules/retakeGate/retakePreference.service';
import { packPlan, PackPlanResult } from './modules/prediction/planPacker';
import { DEPARTMENTS, OTHER_FACULTY_DEPARTMENTS, FACULTIES, QUIZ } from './modules/fitEngine/deptFitEngine';
import { creditCapFor } from './modules/grading/level';
import { projectExpectedVsBestCase } from './modules/prediction/whatIfProjection';
import { bestCasePct } from './modules/prediction/bestCaseProjection';
import { VENTURE_QUIZ } from './modules/venture/ventureQuiz';
import weights from './config/predictionWeights.json';
// AI Features Blueprint — Cognitive Load Heatmap + Project Collider
// (advisor/VP-facing only, see the seed files' own headers for scope).
import { buildFrictionTimeline, recommendTaskMoves, MOVABLE_MILESTONE_TYPES, MAX_MOVE_WEEKS } from './modules/friction/frictionScore.service';
import { isColdStartStudent, assessColdStart } from './modules/prediction/coldStart.service';
import { computeInstitutionalBottlenecks, StudentForBottleneck } from './modules/friction/institutionalBottleneck.service';
import { matchOpportunitiesForProject } from './modules/collider/colliderOpportunityMatch.service';
import { getAllOpportunities } from './modules/collider/externalOpportunitiesLive.service';
import { buildTopography } from './modules/collider/innovationTopography.service';
import { forecastDepartmentDemand, forecastAllDepartments, forecastCourseDemand } from './modules/curriculumAnalytics/resourceForecast.service';
import { buildHealthMonitor } from './modules/curriculumAnalytics/curriculumHealthMonitor.service';
import { rankBottlenecks, affectedAdvisees, StudentForBottleneckCheck } from './modules/curriculumAnalytics/bottleneckDependencyAnalyzer.service';
import { MILESTONES_BY_COURSE, SYLLABUS_MILESTONES, SEMESTER_WEEKS } from './db/seed/seedSyllabusMilestones';
import { COLLABORATORS_BY_ID } from './db/seed/seedColliderCollaborators';
import { login } from './modules/auth/session.service';
import { authenticate, requireAuthRole, requireStudentAccess, requireAdvisorAccess, requireAdvisorOwnsStudent, GuardPorts } from './modules/auth/guards';
import { AuthRole } from './db/memory/inMemoryDb';

const app = express();

/** Express 5's route params can be `string | string[]` (its updated
 *  path-to-regexp supports repeated segments, e.g. `/files/*path`) — but
 *  every route in this file uses a single plain `:id`-style segment, which
 *  Express only ever populates as a string. This narrows that real
 *  invariant explicitly instead of casting it away at each call site: if a
 *  future route change ever DID introduce a repeated segment, this throws
 *  a clear 400 right where the mistake would show up, rather than silently
 *  handing an array where a lookup key was expected. */
function paramStr(req: express.Request, name: string): string {
  const v = req.params[name];
  if (Array.isArray(v)) {
    throw Object.assign(new Error(`${name} must be a single path segment, got multiple`), { httpStatus: 400 });
  }
  return v;
}

// Only relevant once this server is deployed somewhere separate from the
// frontend that calls it (e.g. this API on Render, the built web app on
// GitHub Pages — see packages/web/src/api/client.ts's VITE_API_BASE_URL).
// Same-origin local dev (Vite's /api proxy) never sends an Origin header
// that needs this. CORS_ALLOWED_ORIGINS is a comma-separated allow-list
// (e.g. "https://5636mohamed.github.io"); unset means no cross-origin
// caller is allowed — safer default than a wide-open '*' for a real
// deployment, even a demo one.
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    // Real backend authentication epic — Authorization added so the
    // bearer-token header survives a cross-origin preflight (GitHub Pages
    // -> Railway); every guarded route needs this to ever be reachable
    // cross-origin at all.
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// §16.4 — CVs are uploaded as base64 data: URLs in the JSON body (no file-
// storage layer in this demo); the default 100kb limit is nowhere near
// enough for a real PDF/DOC once base64-inflated, so it's raised here.
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

const ports = buildRepositoryBackedPorts();

// The stored `cgpaSnapshots` array is only ever as complete as whatever a
// seed/test author hand-wrote into it — real students routinely have graded
// attempts in semesters no snapshot was ever authored for (see
// deriveCgpaTrend's doc comment). Every DISPLAY-facing route (the CGPA trend
// chart, the student detail payload) uses this derived, guaranteed-complete
// series instead; nothing that relies on the stored snapshots' identity
// (activeBaseSnapshotId anchoring, transfer execution) is touched — this
// only changes what gets rendered.
function displayCgpaSnapshots(id: string) {
  const student = db.getStudent(id);
  if (!student) return [];
  const sinceOrdinal = student.activeBaseSnapshotId
    ? student.cgpaSnapshots.find(s => s.semesterId === student.activeBaseSnapshotId)?.semesterOrdinal
    : undefined;
  return deriveCgpaTrend(student.allAttempts, db.courseByCode, sinceOrdinal);
}

function toStudentWithCgpa(id: string): StudentWithCgpa | null {
  const student = db.getStudent(id);
  if (!student) return null;
  return { ...student, cgpa: db.getCurrentCgpa(id) };
}

// ---------------------------------------------------------------------
// §9's role gate — a single header, not real JWT sessions. Good enough to
// exercise the admin-only prediction-weights route without pretending this
// is production auth.
// ---------------------------------------------------------------------
function requireRole(role: 'admin' | 'registrar') {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const actual = req.header('x-role');
    if (actual !== role && actual !== 'admin') {
      return res.status(403).json({ error: `requires role '${role}' (send an x-role header)` });
    }
    next();
  };
}

/** Spec §12: "Dismissed students must be fully locked out of /advise,
 *  /transfer/*, and course registration endpoints at the API layer (403),
 *  not just hidden in the UI." */
function blockIfDismissed(req: express.Request, res: express.Response, next: express.NextFunction) {
  const student = db.getStudent(paramStr(req, 'id'));
  if (!student) return res.status(404).json({ error: 'student not found' });
  try {
    assertNotDismissed(student.id, student.probationCounter.count);
    next();
  } catch (err) {
    if (err instanceof DismissedStudentError) return res.status(403).json({ error: err.message });
    throw err;
  }
}

// ---------------------------------------------------------------------
// Real backend authentication epic — replaces the old client-only demo
// login (a plain JSON blob in localStorage, no server verification at
// all — see .github/SECURITY.md's rewritten Authentication section for
// the full before/after). `POST /api/auth/login` now does the real
// email->identity lookup + password verification this used to do
// client-side; every guarded route below composes `authenticate` +
// (requireAuthRole | requireStudentAccess | requireAdvisorAccess) in
// front of its handler, same "look up -> assert -> 403/404 -> next()"
// shape blockIfDismissed above already established.
// ---------------------------------------------------------------------
const guardPorts: GuardPorts = {
  getSession: db.getSession,
  getStudentAdvisorId: (studentId: string) => db.getStudent(studentId)?.advisorId ?? null,
};
const requireAuth = authenticate(guardPorts);

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'expected { email, password }' });
  }
  const result = login(email, password, { listAdvisors: db.listAdvisors, listStudents: db.listStudents, createSession: db.createSession });
  if (!result) return res.status(401).json({ error: 'Invalid email or password' });
  res.json(result);
});

app.post('/api/auth/logout', (req, res) => {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null;
  if (token) db.deleteSession(token);
  res.status(204).send();
});

// ---------------------------------------------------------------------
// Students — read
// ---------------------------------------------------------------------
// Multi-advisor epic: an optional ?advisorId= scopes the roster down to
// one advisor's own 25 students. Real backend authentication epic: this
// used to be entirely unauthenticated (Login.tsx even called it BEFORE
// login, to build the email-matching roster — no longer needed now that
// POST /api/auth/login does that lookup server-side). Now: the VP may
// call it either way (scoped or the full unscoped roster); an advisor
// may only call it scoped to their OWN id; anyone else (including no
// ?advisorId= at all from a non-VP session) is forbidden — closes the
// same "any caller can dump the whole roster" gap the live incident that
// started this epic was about.
app.get('/api/students', requireAuth, (req, res) => {
  const { advisorId } = req.query;
  if (req.auth!.role !== 'vice_president') {
    if (req.auth!.role !== 'advisor' || typeof advisorId !== 'string' || advisorId !== req.auth!.id) {
      return res.status(403).json({ error: 'forbidden' });
    }
  }
  let students = db.listStudents();
  if (typeof advisorId === 'string') students = students.filter(s => s.advisorId === advisorId);
  const list = students.map(s => ({
    id: s.id,
    name: s.name,
    facultyId: s.facultyId,
    departmentId: s.departmentId,
    level: s.level,
    status: s.status,
    cgpa: db.getCurrentCgpa(s.id),
    probationCounter: s.probationCounter,
    advisorId: s.advisorId,
  }));
  res.json(list);
});

app.get('/api/students/:id', requireAuth, requireStudentAccess(guardPorts), (req, res) => {
  const student = toStudentWithCgpa(paramStr(req, 'id'));
  if (!student) return res.status(404).json({ error: 'student not found' });
  res.json({
    ...student,
    // §15.3.1 registered-but-ungraded courses now show as pending rows
    // alongside real graded attempts — see getTranscriptWithRegistered's
    // doc comment for why this is a read-time merge, not a stored one.
    transcript: db.getTranscriptWithRegistered(paramStr(req, 'id')),
    cgpaSnapshots: displayCgpaSnapshots(paramStr(req, 'id')),
    quizAnswers: db.getStudent(paramStr(req, 'id'))?.quizAnswers ?? {},
    transferRecords: db.getTransferRecords(paramStr(req, 'id')),
  });
});

app.get('/api/students/:id/eligible-courses', requireAuth, requireStudentAccess(guardPorts), (req, res) => {
  if (!db.getStudent(paramStr(req, 'id'))) return res.status(404).json({ error: 'student not found' });
  res.json(db.getEligibleCourses(paramStr(req, 'id')));
});

// §14/§15 — the full catalog, one row per course, annotated with this
// student's status on it (passed/needs-retake/registered/eligible/locked).
// Backs the per-semester Curriculum tab.
app.get('/api/students/:id/curriculum', requireAuth, requireStudentAccess(guardPorts), (req, res) => {
  if (!db.getStudent(paramStr(req, 'id'))) return res.status(404).json({ error: 'student not found' });
  res.json(db.getCurriculum(paramStr(req, 'id')));
});

// ---------------------------------------------------------------------
// §5 retake gate
// ---------------------------------------------------------------------
app.post('/api/students/:id/retake-preference', requireAuth, requireStudentAccess(guardPorts), blockIfDismissed, (req, res) => {
  const id = paramStr(req, 'id');
  if (!db.getStudent(id)) return res.status(404).json({ error: 'student not found' });
  const { considerRetakes } = req.body ?? {};
  if (typeof considerRetakes !== 'boolean') return res.status(400).json({ error: 'expected { considerRetakes: boolean }' });
  db.setRetakePreference(id, considerRetakes);
  res.json({ ok: true, considerRetakes });
});

// ---------------------------------------------------------------------
// Write: record a grade attempt (a fresh course or a retake) — the
// "registration/enrollment" endpoint, locked out once dismissed (§12).
// ---------------------------------------------------------------------
app.post('/api/students/:id/enroll', requireAuth, requireStudentAccess(guardPorts), blockIfDismissed, (req, res) => {
  const { courseCode, pct, semesterOrdinal } = req.body ?? {};
  if (typeof courseCode !== 'string' || typeof pct !== 'number' || typeof semesterOrdinal !== 'number') {
    return res.status(400).json({ error: 'expected { courseCode: string, pct: number, semesterOrdinal: number }' });
  }
  try {
    const result = db.recordEnrollment(paramStr(req, 'id'), courseCode, pct, semesterOrdinal);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/students/:id/quiz', requireAuth, requireStudentAccess(guardPorts), blockIfDismissed, (req, res) => {
  const id = paramStr(req, 'id');
  if (!db.getStudent(id)) return res.status(404).json({ error: 'student not found' });
  const answers = req.body ?? {};
  db.setQuizAnswers(id, answers);
  res.json({ ok: true, quizAnswers: db.getStudent(id)?.quizAnswers });
});

// ---------------------------------------------------------------------
// §4.2/§8 — the real orchestrator, locked out once dismissed.
// ---------------------------------------------------------------------
app.post('/api/students/:id/advise', requireAuth, requireStudentAccess(guardPorts), blockIfDismissed, async (req, res) => {
  const student = toStudentWithCgpa(paramStr(req, 'id'));
  if (!student) return res.status(404).json({ error: 'student not found' }); // unreachable after blockIfDismissed, kept for type-safety
  try {
    const result = await runAdvisingCycle(student, ports);
    // Product-owner decision: venture/project recommendations only ever
    // show on the Venture Board — Course Plan (this route) never injects
    // one, regardless of whether a qualifying match exists. §16.4's gold
    // card used to be attached here (§8 step 12); removed from this
    // response entirely rather than just hidden client-side, so nothing
    // reachable from Course Plan can surface it. getTopVentureCardMatch
    // (db) still exists and is still tested — this is the one place it
    // used to be wired into a response, not a claim that the underlying
    // §16.4 threshold logic itself was wrong.
    res.json({ ...result, plan: attachBestCase(paramStr(req, 'id'), result.plan) }); // §15.2
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---------------------------------------------------------------------
// §9.2 plan/fast, plan/target — the two prototype-baseline planners,
// independent of the full advising-cycle branch decision.
// ---------------------------------------------------------------------
async function buildScoredPlan(studentId: string, mode: 'fast' | 'target_safe' | 'target_fast' | 'probation_repair') {
  const student = toStudentWithCgpa(studentId)!;
  const retakeGateYes = await ports.getRetakeGateAnswer(studentId);
  const eligible = await ports.getEligibleCourses(studentId);
  const { pool, mandatory } = buildCandidatePool({ eligible, considerRetakes: retakeGateYes });
  const scoredPool = await Promise.all(pool.map(c => ports.scoreEligibleCourse(student, c, retakeGateYes)));
  const scoredMandatory = await Promise.all(mandatory.map(c => ports.scoreEligibleCourse(student, c, retakeGateYes)));
  const isHalfLoad = await ports.isPostLowFirstSemester(studentId);
  const hasCompletedAnyCourse = Object.keys(db.getTranscript(studentId)).length > 0;
  const cap = creditCapFor({ isPostLowFirstSemester: isHalfLoad, cgpa: student.cgpa, hasCompletedAnyCourse });
  return packPlan({ mandatory: scoredMandatory, pool: scoredPool, cap, mode });
}

app.get('/api/students/:id/plan/fast', requireAuth, requireStudentAccess(guardPorts), async (req, res) => {
  if (!db.getStudent(paramStr(req, 'id'))) return res.status(404).json({ error: 'student not found' });
  try {
    res.json(attachBestCaseToPlanResult(paramStr(req, 'id'), await buildScoredPlan(paramStr(req, 'id'), 'fast')));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/students/:id/plan/target', requireAuth, requireStudentAccess(guardPorts), async (req, res) => {
  const student = toStudentWithCgpa(paramStr(req, 'id'));
  if (!student) return res.status(404).json({ error: 'student not found' });
  const targetCgpa = Number(req.query.cgpa);
  if (!Number.isFinite(targetCgpa)) return res.status(400).json({ error: 'expected ?cgpa=<number>' });
  // §0's baseline description: re-weighted toward "safety" (below target) or "speed" (above target).
  const mode = student.cgpa < targetCgpa ? 'target_safe' : 'target_fast';
  try {
    res.json({ mode, targetCgpa, ...attachBestCaseToPlanResult(paramStr(req, 'id'), await buildScoredPlan(paramStr(req, 'id'), mode)) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---------------------------------------------------------------------
// §6 — department/faculty fit
// ---------------------------------------------------------------------
app.get('/api/students/:id/department-fit', requireAuth, requireStudentAccess(guardPorts), async (req, res) => {
  const student = toStudentWithCgpa(paramStr(req, 'id'));
  if (!student) return res.status(404).json({ error: 'student not found' });
  res.json(await ports.recommendDepartments(student));
});

app.get('/api/students/:id/faculty-fit', requireAuth, requireStudentAccess(guardPorts), async (req, res) => {
  const student = toStudentWithCgpa(paramStr(req, 'id'));
  if (!student) return res.status(404).json({ error: 'student not found' });
  res.json(await ports.rankFacultiesByFit(student));
});

// ---------------------------------------------------------------------
// §4 — probation / dismissal audit trail
// ---------------------------------------------------------------------
app.get('/api/students/:id/probation', requireAuth, requireStudentAccess(guardPorts), (req, res) => {
  try {
    const { counter, log } = db.getProbationHistory(paramStr(req, 'id'));
    res.json({ count: counter.count, armed: counter.armed, history: log });
  } catch {
    res.status(404).json({ error: 'student not found' });
  }
});

app.get('/api/students/:id/cgpa-trend', requireAuth, requireStudentAccess(guardPorts), (req, res) => {
  const student = db.getStudent(paramStr(req, 'id'));
  if (!student) return res.status(404).json({ error: 'student not found' });
  const snapshots = displayCgpaSnapshots(paramStr(req, 'id'));
  const trend = projectCGPATrend(snapshots);
  res.json({ snapshots, trendSlope: trend.slope, reading: trend.reading });
});

// Cold-start trial — "Level 1, first semester, no records yet: what does
// the system recommend?" `null` (not a 404) once a student has ANY real
// completed course — this isn't a permanent profile field, it's only
// meaningful for the exact window before real transcript data exists.
app.get('/api/students/:id/cold-start-assessment', requireAuth, requireStudentAccess(guardPorts), (req, res) => {
  const student = db.getStudent(paramStr(req, 'id'));
  if (!student) return res.status(404).json({ error: 'student not found' });
  const completedCount = Object.keys(db.getTranscript(student.id)).length;
  if (!isColdStartStudent(completedCount) || student.g12Score == null || student.entranceExamScore == null) {
    return res.json(null);
  }
  res.json(assessColdStart(student.g12Score, student.entranceExamScore));
});

/** Spec's `POST /api/semesters/:id/close` — exposed here per-student since
 *  this store has no globally-addressable Semester id independent of its
 *  owning student (flagged deviation, see file header). */
app.post('/api/students/:id/semesters/close', requireAuth, requireStudentAccess(guardPorts), (req, res) => {
  const student = db.getStudent(paramStr(req, 'id'));
  if (!student) return res.status(404).json({ error: 'student not found' });
  const { semesterId, isFirstSemester } = req.body ?? {};
  if (typeof semesterId !== 'string') return res.status(400).json({ error: 'expected { semesterId: string, isFirstSemester?: boolean }' });

  const cgpaAtClose = db.getCurrentCgpa(paramStr(req, 'id'));
  if (isFirstSemester) {
    const result = onFirstSemesterClose({ studentId: paramStr(req, 'id'), semesterId, gpaAtClose: cgpaAtClose });
    res.json(result);
  } else {
    const result = onSemesterClose({
      studentId: paramStr(req, 'id'),
      semesterId,
      cgpaAtClose,
      counter: student.probationCounter,
    });
    if (result.dismissed) db.updateStudentStatus(paramStr(req, 'id'), 'dismissed');
    res.json(result);
  }
});

// ---------------------------------------------------------------------
// §7 — transfer execution, all locked out once dismissed.
// ---------------------------------------------------------------------
app.post('/api/students/:id/transfer/internal', requireAuth, requireStudentAccess(guardPorts), blockIfDismissed, (req, res) => {
  const { toDepartmentId } = req.body ?? {};
  if (typeof toDepartmentId !== 'string') return res.status(400).json({ error: 'expected { toDepartmentId: string }' });
  try {
    const result = db.executeInternalTransferForStudent(paramStr(req, 'id'), toDepartmentId, `sem-transfer-${Date.now()}`);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/students/:id/transfer/external', requireAuth, requireStudentAccess(guardPorts), blockIfDismissed, (req, res) => {
  const { toFacultyId, toDepartmentId } = req.body ?? {};
  if (typeof toFacultyId !== 'string' || typeof toDepartmentId !== 'string') {
    return res.status(400).json({ error: 'expected { toFacultyId: string, toDepartmentId: string }' });
  }
  try {
    const result = db.executeExternalTransferForStudent(paramStr(req, 'id'), toFacultyId, toDepartmentId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/students/:id/transfer/preview', requireAuth, requireStudentAccess(guardPorts), (req, res) => {
  if (!db.getStudent(paramStr(req, 'id'))) return res.status(404).json({ error: 'student not found' });
  const toFacultyId = String(req.query.toFacultyId ?? '');
  if (!toFacultyId) return res.status(400).json({ error: 'expected ?toFacultyId=<facultyId>' });
  try {
    res.json(db.previewExternalTransfer(paramStr(req, 'id'), toFacultyId));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---------------------------------------------------------------------
// VP epic — transfer pending chain: student requests -> advisor
// approves/declines -> VP approves (executes, via the same execute*
// functions the two routes above still call directly) or declines. The
// old immediate-execute routes above are left completely unchanged — they
// stay reachable directly (existing tests hit them), just no longer what
// the student-facing "Confirm transfer" button calls.
// ---------------------------------------------------------------------
app.post('/api/students/:id/transfer-requests', requireAuth, requireStudentAccess(guardPorts), blockIfDismissed, (req, res) => {
  const { type, toDepartmentId, toFacultyId } = req.body ?? {};
  if (type !== 'internal_department' && type !== 'external_faculty') {
    return res.status(400).json({ error: "expected { type: 'internal_department' | 'external_faculty', toDepartmentId: string, toFacultyId?: string }" });
  }
  if (typeof toDepartmentId !== 'string' || !toDepartmentId) {
    return res.status(400).json({ error: 'expected a non-empty toDepartmentId' });
  }
  if (type === 'external_faculty' && (typeof toFacultyId !== 'string' || !toFacultyId)) {
    return res.status(400).json({ error: 'external_faculty requests also need toFacultyId' });
  }
  try {
    res.json(db.createTransferRequestForStudent(paramStr(req, 'id'), type, toDepartmentId, toFacultyId));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/students/:id/transfer-requests', requireAuth, requireStudentAccess(guardPorts), (req, res) => {
  if (!db.getStudent(paramStr(req, 'id'))) return res.status(404).json({ error: 'student not found' });
  res.json(db.listTransferRequestsForStudent(paramStr(req, 'id')));
});

app.get('/api/advisors/:advisorId/transfer-requests', requireAuth, requireAdvisorAccess(), (req, res) => {
  res.json(db.listTransferRequestsForAdvisor(paramStr(req, 'advisorId')));
});

// Real authorization gap found by audit: neither route below checked that
// the deciding advisor actually owns this transfer request — any advisor
// session could approve/decline any OTHER advisor's request just by
// knowing the requestId. advisorId is now required in the body and
// checked against the request's own advisorId (db.advisorDecideTransferRequest
// throws a 403-tagged error on mismatch).
// Real backend authentication epic: this used to trust a client-supplied
// `{ advisorId }` body field as the acting advisor's identity (checked
// against the REQUEST's real owner inside advisorDecideTransferRequest,
// per an earlier audit fix — but nothing tied that body field to who was
// actually making the call). Now uses the authenticated identity
// (req.auth.id) directly instead — simpler AND closes that gap, since a
// spoofed body value is no longer possible.
app.post('/api/advisor/transfer-requests/:requestId/approve', requireAuth, requireAuthRole('advisor'), (req, res) => {
  try {
    res.json(db.advisorDecideTransferRequest(paramStr(req, 'requestId'), 'approve', undefined, req.auth!.id!));
  } catch (err) {
    const status = (err as { httpStatus?: number })?.httpStatus ?? 400;
    res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/advisor/transfer-requests/:requestId/decline', requireAuth, requireAuthRole('advisor'), (req, res) => {
  const { reason } = req.body ?? {};
  try {
    res.json(db.advisorDecideTransferRequest(paramStr(req, 'requestId'), 'decline', reason, req.auth!.id!));
  } catch (err) {
    const status = (err as { httpStatus?: number })?.httpStatus ?? 400;
    res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/vp/transfer-requests', requireAuth, requireAuthRole('vice_president'), (_req, res) => {
  res.json(db.listAllTransferRequests());
});

app.get('/api/vp/transfer-requests-summary', requireAuth, requireAuthRole('vice_president'), (_req, res) => {
  res.json(db.getTransferCountersByAdvisor());
});

app.post('/api/vp/transfer-requests/:requestId/approve', requireAuth, requireAuthRole('vice_president'), (req, res) => {
  try {
    res.json(db.vpDecideTransferRequest(paramStr(req, 'requestId'), 'approve'));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/vp/transfer-requests/:requestId/decline', requireAuth, requireAuthRole('vice_president'), (req, res) => {
  try {
    res.json(db.vpDecideTransferRequest(paramStr(req, 'requestId'), 'decline', req.body?.reason));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---------------------------------------------------------------------
// Faculties/departments catalog — small read-only lookups the frontend
// needs to build a transfer confirmation UI (pick a department within a
// recommended faculty).
// ---------------------------------------------------------------------
// §6 — the best-fit quiz question bank, needed by the DepartmentFitQuiz screen.
app.get('/api/quiz', (_req, res) => {
  res.json(QUIZ);
});

app.get('/api/faculties', (_req, res) => {
  res.json(FACULTIES.map(f => ({ id: f.id, name: f.name })));
});

app.get('/api/faculties/:facultyId/departments', (req, res) => {
  const depts = [...DEPARTMENTS, ...OTHER_FACULTY_DEPARTMENTS].filter(d => d.facultyId === paramStr(req, 'facultyId'));
  res.json(depts.map(d => ({ id: d.id, name: d.name })));
});

// ---------------------------------------------------------------------
// §3.3 — dependency-chain visualization data
// ---------------------------------------------------------------------
app.get('/api/courses/:code/chain', (req, res) => {
  const course = CATALOG.find(c => c.code === paramStr(req, 'code'));
  if (!course) return res.status(404).json({ error: 'course not found' });
  const direct = CATALOG.filter(c => c.prereq.includes(course.code)).map(c => c.code);
  res.json({ courseCode: course.code, chainUnlockValue: chainUnlockValue(course.code, CATALOG), directUnlocks: direct });
});

// ---------------------------------------------------------------------
// §15.3 — course proposal / dual-approval registration workflow
// ---------------------------------------------------------------------

// §15.2 — attaches bestCasePct/Letter/Points to every course in a plan
// (both the advisor's plan view and the student portal's Advise Me screen
// read the same `/advise` and `/plan/*` responses, so this is computed
// once, here, rather than duplicated per route).
function attachBestCase<T extends { courseCode: string; expectedPct: number }>(studentId: string, plan: T[]): Array<T & { bestCasePct: number; bestCaseLetter: string; bestCasePoints: number }> {
  const transcript = db.getTranscript(studentId);
  const history = Object.values(transcript);
  return plan.map(c => {
    const course = db.courseByCode[c.courseCode];
    const bc = course ? bestCasePct(course, history, db.courseByCode, c.expectedPct) : { bestCasePct: c.expectedPct, bestCaseLetter: '', bestCasePoints: 0 };
    return { ...c, ...bc };
  });
}

// §15.2 best-case was only ever attached to /advise's flat `plan` array —
// /plan/fast and /plan/target return the same members nested inside
// mandatoryBundles/optimizedBundles/carriedToNextSemester instead, so they
// need the same treatment applied per-bundle to get the same bestCase*
// fields the student portal's roster now always shows alongside Expected.
// `Bundle.members` (planPacker.ts) is typed against the narrower
// CandidateForScoring shape (no `expectedPct`), even though every real
// member passed through here (scoreEligibleCourse's ScoredCandidate) always
// carries it — the cast below reflects that real, always-true runtime
// shape rather than widening PackPlanResult's own type.
function attachBestCaseToPlanResult(studentId: string, result: PackPlanResult) {
  type Member = { courseCode: string; expectedPct: number };
  const withBestCase = (bundles: PackPlanResult['mandatoryBundles']) =>
    bundles.map(b => ({ ...b, members: attachBestCase(studentId, b.members as unknown as Member[]) }));
  return {
    ...result,
    mandatoryBundles: withBestCase(result.mandatoryBundles),
    optimizedBundles: withBestCase(result.optimizedBundles),
    carriedToNextSemester: withBestCase(result.carriedToNextSemester),
  };
}

// §15.2's CGPA-impact summary: one figure per side, computed over the
// student's REAL transcript plus one course per active slot (preferring
// registered > advisor_approved > pending, ignoring declined) — real
// computeCGPA arithmetic (via projectExpectedVsBestCase), not an estimate.
function proposalsWithImpact(studentId: string) {
  const proposals = db.getProposals(studentId);
  const rank: Record<string, number> = { registered: 3, advisor_approved: 2, pending: 1, declined: 0 };
  const bySlot = new Map<string, (typeof proposals)[number]>();
  for (const p of proposals) {
    if (p.status === 'declined') continue;
    const existing = bySlot.get(p.slotKey);
    if (!existing || rank[p.status] > rank[existing.status]) bySlot.set(p.slotKey, p);
  }
  const active = [...bySlot.values()];

  const transcript = db.getTranscript(studentId);
  const attempts = Object.values(transcript);
  const student = db.getStudent(studentId);
  const nextOrdinal = Math.max(0, ...(student?.cgpaSnapshots.map(s => s.semesterOrdinal) ?? [0])) + 1;
  const courseByCodeCredits = Object.fromEntries(CATALOG.map(c => [c.code, { credits: c.credits }]));

  const impact = projectExpectedVsBestCase(
    attempts,
    courseByCodeCredits,
    active.map(p => ({ courseCode: p.courseCode, credits: courseByCodeCredits[p.courseCode]?.credits ?? 0, expectedPoints: p.expectedPoints, bestCasePoints: p.bestCasePoints })),
    nextOrdinal
  );

  return { proposals, ...impact };
}

app.post('/api/students/:id/proposals/generate', requireAuth, requireStudentAccess(guardPorts), blockIfDismissed, async (req, res) => {
  const id = paramStr(req, 'id');
  const student = toStudentWithCgpa(id);
  if (!student) return res.status(404).json({ error: 'student not found' });
  try {
    const result = await runAdvisingCycle(student, ports); // §4.2/§8, unchanged
    db.addProposalsFromPlan(id, result.plan);
    res.json(proposalsWithImpact(id));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/students/:id/proposals', requireAuth, requireStudentAccess(guardPorts), (req, res) => {
  if (!db.getStudent(paramStr(req, 'id'))) return res.status(404).json({ error: 'student not found' });
  res.json(proposalsWithImpact(paramStr(req, 'id')));
});

app.post('/api/advisor/proposals/:proposalId/approve', requireAuth, requireAuthRole('advisor', 'vice_president'), (req, res) => {
  try {
    res.json(db.approveProposalById(paramStr(req, 'proposalId')));
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// "Approve all" — accept the system's whole plan in one click. Skips any
// slot the advisor already replaced with their own alternate; returns the
// same shape as GET/generate so the frontend can reuse one response handler.
app.post('/api/advisor/students/:id/proposals/approve-all', requireAuth, requireAdvisorOwnsStudent(guardPorts), (req, res) => {
  if (!db.getStudent(paramStr(req, 'id'))) return res.status(404).json({ error: 'student not found' });
  try {
    db.approveAllPendingSystemProposals(paramStr(req, 'id'));
    res.json(proposalsWithImpact(paramStr(req, 'id')));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/advisor/proposals/:proposalId/decline', requireAuth, requireAuthRole('advisor', 'vice_president'), (req, res) => {
  try {
    res.json(db.declineProposalById(paramStr(req, 'proposalId')));
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Shared by the preview and commit routes below — scores `courseCode` for
// `studentId` through the exact same §3.1 pipeline the system's own
// recommendations use, so an advisor-proposed alternate is never scored on
// a different basis than the course it's replacing.
async function scoreAlternateCandidate(studentId: string, courseCode: string) {
  const student = toStudentWithCgpa(studentId);
  if (!student) throw Object.assign(new Error('student not found'), { httpStatus: 404 });
  const course = CATALOG.find(c => c.code === courseCode);
  if (!course) throw Object.assign(new Error('course not found'), { httpStatus: 404 });
  const transcript = db.getTranscript(studentId);
  const isRetake = !!transcript[courseCode] && ['D', 'D+', 'F'].includes(transcript[courseCode].letter);
  return ports.scoreEligibleCourse(
    student,
    { course, isRetake, oldLetter: isRetake ? transcript[courseCode].letter : null, oldPoints: isRetake ? transcript[courseCode].points : null },
    true
  );
}

// §15.3.2 step 2(b), dry run — lets the advisor see a candidate alternate's
// expected AND best-case grade (the frontend renders its grade-point
// consequence against the system's originally recommended course from
// this) BEFORE committing to proposing it. Scores live, persists nothing.
app.post('/api/advisor/students/:id/proposals/:slotKey/alternate/preview', requireAuth, requireAdvisorOwnsStudent(guardPorts), async (req, res) => {
  if (!db.getStudent(paramStr(req, 'id'))) return res.status(404).json({ error: 'student not found' });
  const { courseCode } = req.body ?? {};
  if (typeof courseCode !== 'string') return res.status(400).json({ error: 'expected { courseCode: string }' });
  try {
    const scored = await scoreAlternateCandidate(paramStr(req, 'id'), courseCode);
    res.json(db.previewAdvisorAlternate(paramStr(req, 'id'), paramStr(req, 'slotKey'), courseCode, scored));
  } catch (err) {
    const status = (err as { httpStatus?: number }).httpStatus ?? 500;
    res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// §15.3.2 step 2(b) — the advisor picks an alternate course for a slot; the
// SAME §3.1 scoring pipeline the system used is run here, on demand, so the
// advisor sees the real projected impact before confirming — never a guess.
app.post('/api/advisor/students/:id/proposals/:slotKey/alternate', requireAuth, requireAdvisorOwnsStudent(guardPorts), async (req, res) => {
  const { courseCode, acknowledgedByAdvisorName } = req.body ?? {};
  if (typeof courseCode !== 'string') return res.status(400).json({ error: 'expected { courseCode: string }' });
  if (acknowledgedByAdvisorName !== undefined && typeof acknowledgedByAdvisorName !== 'string') {
    return res.status(400).json({ error: 'acknowledgedByAdvisorName must be a string if provided' });
  }
  try {
    const scored = await scoreAlternateCandidate(paramStr(req, 'id'), courseCode);
    const proposal = db.addAdvisorAlternateProposal(paramStr(req, 'id'), paramStr(req, 'slotKey'), courseCode, scored, acknowledgedByAdvisorName);
    res.json(proposal);
  } catch (err) {
    const status = (err as { httpStatus?: number }).httpStatus ?? 500;
    res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// §15.3.2 step 3 — student picks one option for a slot.
app.post('/api/students/:id/proposals/:proposalId/choose', requireAuth, requireStudentAccess(guardPorts), blockIfDismissed, (req, res) => {
  const id = paramStr(req, 'id');
  if (!db.getStudent(id)) return res.status(404).json({ error: 'student not found' });
  try {
    const result = db.chooseProposalById(id, paramStr(req, 'proposalId'));
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// "Choose all" — the student's own bulk action (see chooseAllReadyProposals's
// doc comment). Returns the same shape GET/generate use, plus the slots that
// still need advisor review, so the client can render one consolidated note.
app.post('/api/students/:id/proposals/choose-all', requireAuth, requireStudentAccess(guardPorts), blockIfDismissed, (req, res) => {
  const id = paramStr(req, 'id');
  if (!db.getStudent(id)) return res.status(404).json({ error: 'student not found' });
  try {
    const { stillPendingSlots } = db.chooseAllReadyProposals(id);
    res.json({ ...proposalsWithImpact(id), stillPendingSlots });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/students/:id/registered-courses', requireAuth, requireStudentAccess(guardPorts), (req, res) => {
  if (!db.getStudent(paramStr(req, 'id'))) return res.status(404).json({ error: 'student not found' });
  res.json(db.getRegisteredCourses(paramStr(req, 'id')));
});

// §15.4 — the advisor's PDF report is built client-side from this aggregate.
// Same ?advisorId= scoping as GET /api/students above.
// Same VP-unscoped / advisor-own-id-only scoping rule as GET /api/students.
app.get('/api/advisor/report', requireAuth, (req, res) => {
  const { advisorId } = req.query;
  if (req.auth!.role !== 'vice_president') {
    if (req.auth!.role !== 'advisor' || typeof advisorId !== 'string' || advisorId !== req.auth!.id) {
      return res.status(403).json({ error: 'forbidden' });
    }
  }
  res.json(db.getAdvisorReport(typeof advisorId === 'string' ? advisorId : undefined));
});

// ---------------------------------------------------------------------
// §16 — Innovation & Venture Catalyst
// ---------------------------------------------------------------------

// §16.1 — the Venture Interest Form question bank (level≥3 students only
// ever see this rendered, but the bank itself is a harmless public read).
app.get('/api/venture-quiz', (_req, res) => {
  res.json(VENTURE_QUIZ);
});

// Reads for the Venture Gate/Interest Form's current saved state — used by
// the Venture Board tab (where these questions now live, see below) to
// pre-fill the toggle/quiz instead of asking blind every visit. Real gap
// caught by a systematic per-student audit: their own POST siblings just
// below (and venture-matches/friction-timeline right after) are all
// blockIfDismissed-guarded per §12/§16.8's "fully locked out at the API
// layer" rule, but these two GETs were missed when that guard was added —
// a dismissed student's Venture Board tab could still silently pre-fill
// from these two reads.
app.get('/api/students/:id/venture-gate', requireAuth, requireStudentAccess(guardPorts), blockIfDismissed, (req, res) => {
  res.json({ interested: db.getVentureGateAnswer(paramStr(req, 'id')) });
});

app.get('/api/students/:id/venture-interest-form', requireAuth, requireStudentAccess(guardPorts), blockIfDismissed, (req, res) => {
  res.json({ answers: db.getVentureInterestAnswers(paramStr(req, 'id')) });
});

app.post('/api/students/:id/venture-gate', requireAuth, requireStudentAccess(guardPorts), blockIfDismissed, (req, res) => {
  const id = paramStr(req, 'id');
  const student = db.getStudent(id);
  if (!student) return res.status(404).json({ error: 'student not found' });
  const { interested } = req.body ?? {};
  if (typeof interested !== 'boolean') return res.status(400).json({ error: 'expected { interested: boolean }' });
  if (student.level < weights.ventureFit.minLevel) {
    return res.status(403).json({ error: `Venture Gate is only asked of Level ${weights.ventureFit.minLevel}+ students (§16.1)` });
  }
  db.setVentureGateAnswer(id, interested);
  res.json({ ok: true, interested });
});

app.post('/api/students/:id/venture-interest-form', requireAuth, requireStudentAccess(guardPorts), blockIfDismissed, (req, res) => {
  const id = paramStr(req, 'id');
  if (!db.getStudent(id)) return res.status(404).json({ error: 'student not found' });
  const answers = req.body ?? {};
  db.setVentureInterestAnswers(id, answers);
  res.json({ ok: true, answers: db.getVentureInterestAnswers(id) });
});

// The Faculty Console/Venture Board both need to show which professor
// hosts a project — enriched here at the HTTP boundary rather than in the
// domain layer, so `VentureProject`/`VentureMatchResult` themselves stay
// pure (professorId only, no denormalized name baked into the DB record).
function withProfessorName<T extends { project: { professorId: string } }>(r: T): T & { project: T['project'] & { professorName: string } } {
  return { ...r, project: { ...r.project, professorName: db.getProfessor(r.project.professorId)?.name ?? 'Unknown professor' } };
}

// §16.3/§16.5 — the Venture Board's full ranked list. Locked out once
// dismissed, same as every other student-facing route (§16.8/§12).
app.get('/api/students/:id/venture-matches', requireAuth, requireStudentAccess(guardPorts), blockIfDismissed, (req, res) => {
  res.json(db.getVentureMatches(paramStr(req, 'id')).map(withProfessorName));
});

// §16.4 — express interest, optionally attaching a CV in the same action.
// Requires an already-persisted match row (only ever true once threshold
// was cleared at least once) — the UI no longer calls this directly (see
// the project-keyed route below, which also covers below-threshold
// projects); kept for any caller that already has a concrete `matchId`.
app.post('/api/students/:id/venture-matches/:matchId/apply', requireAuth, requireStudentAccess(guardPorts), blockIfDismissed, (req, res) => {
  const { cvFileName, cvDataUrl } = req.body ?? {};
  if ((cvFileName && typeof cvFileName !== 'string') || (cvDataUrl && typeof cvDataUrl !== 'string')) {
    return res.status(400).json({ error: 'expected optional { cvFileName?: string, cvDataUrl?: string }' });
  }
  try {
    const cv = cvFileName && cvDataUrl ? { fileName: cvFileName, dataUrl: cvDataUrl } : undefined;
    res.json(db.applyToVentureMatch(paramStr(req, 'id'), paramStr(req, 'matchId'), cv));
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Product-owner follow-up to §16.4 — express interest (optionally with a
// CV) in ANY project on the Venture Board, regardless of whether it
// cleared `matchThreshold` and already has a `matchId`. Keyed by
// `projectId` instead, so a below-threshold row (matchId: null on the
// wire) can still be applied to — a fresh `applied` row is created for it
// on the spot.
app.post('/api/students/:id/venture-projects/:projectId/express-interest', requireAuth, requireStudentAccess(guardPorts), blockIfDismissed, (req, res) => {
  const { cvFileName, cvDataUrl } = req.body ?? {};
  if ((cvFileName && typeof cvFileName !== 'string') || (cvDataUrl && typeof cvDataUrl !== 'string')) {
    return res.status(400).json({ error: 'expected optional { cvFileName?: string, cvDataUrl?: string }' });
  }
  try {
    const cv = cvFileName && cvDataUrl ? { fileName: cvFileName, dataUrl: cvDataUrl } : undefined;
    res.json(db.applyToVentureProject(paramStr(req, 'id'), paramStr(req, 'projectId'), cv));
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

/** A candidate is "pending the advisor's attention" if they've actually
 *  acted (applied/suggested-and-touched) OR their live score already
 *  clears §16's real match threshold even though no row has been
 *  materialized for it yet (see the route below). */
function isPendingCandidate(c: { status: string; total: number }): boolean {
  return c.status === 'applied' || c.status === 'suggested' || (c.status === 'unscored' && c.total >= weights.ventureFit.matchThreshold);
}

// --- Multi-advisor epic: the 5 named advisors (each with their own
// 25-student roster). There is no professor login/Faculty Console anymore
// (see AuthContext.tsx) — prof-kamel/prof-adel still exist purely as
// venture-attribution data (db.getProfessor, used below by
// withProfessorName), not as a role with its own routes here. ---
app.get('/api/advisors', requireAuth, (_req, res) => {
  res.json(db.listAdvisors());
});

app.get('/api/advisors/:id', requireAuth, (req, res) => {
  const advisor = db.getAdvisor(paramStr(req, 'id'));
  if (!advisor) return res.status(404).json({ error: 'advisor not found' });
  res.json(advisor);
});

// --- Vice President portal ---

// Per-advisor summary for the VP dashboard: roster size + average CGPA.
// Not roster-scoped by design — the VP's whole point is a cross-advisor view.
app.get('/api/vp/advisors-summary', requireAuth, requireAuthRole('vice_president'), (_req, res) => {
  const summary = db.listAdvisors().map(a => {
    const roster = db.listStudents().filter(s => s.advisorId === a.id);
    const avgCgpa = roster.length > 0
      ? roster.reduce((sum, s) => sum + db.getCurrentCgpa(s.id), 0) / roster.length
      : 0;
    // Advisor-responsibility epic, VP-level view — reuses the same
    // per-student flag §15.4/§17.3's roster report already computes
    // (getAdvisorReport), so "this advisor took responsibility for a
    // student" can never drift between the advisor's own PDF and the
    // VP's aggregate one.
    const flaggedStudentNames = db.getAdvisorReport(a.id)
      .filter(r => r.hasBelowOrEqualAdvisorProposal)
      .map(r => r.name);
    return { advisor: a, studentCount: roster.length, averageCgpa: Math.round(avgCgpa * 100) / 100, flaggedStudentNames };
  });
  res.json(summary);
});

// The flat, cross-advisor pending-approvals queue (see
// listPendingProposalsAcrossAllAdvisors's doc comment).
app.get('/api/vp/pending-proposals', requireAuth, requireAuthRole('vice_president'), (_req, res) => {
  res.json(db.listPendingProposalsAcrossAllAdvisors());
});

// VP report follow-up — the per-(student, course) detail rows for the
// responsibility table the VP's own PDF now renders after the advisor
// summary table (see downloadVpAdvisorsReportPdf). See
// listAdvisorResponsibilityDetails's own doc comment for the exact rule.
app.get('/api/vp/responsibility-details', requireAuth, requireAuthRole('vice_president'), (_req, res) => {
  res.json(db.listAdvisorResponsibilityDetails());
});

// VP's own "Approve all" — every advisor's whole pending queue in one
// click, same guarantee as the advisor's per-student version (see
// approveAllPendingProposalsAcrossAllAdvisors's doc comment): never
// silently overrules a slot the advisor already replaced with their own
// alternate. Returns the queue as it stands afterward, so the client can
// re-render without a second round trip.
app.post('/api/vp/pending-proposals/approve-all', requireAuth, requireAuthRole('vice_president'), (_req, res) => {
  res.json(db.approveAllPendingProposalsAcrossAllAdvisors());
});

// ---------------------------------------------------------------------
// AI Features Blueprint (docs/AI_FEATURES_BLUEPRINT.md) — Cognitive Load
// Heatmap. No student-facing NLP intake or auto-matching in the Collider
// half of this epic (see seedColliderProjects.ts's header) — friction
// scoring, however, IS fully real, live-computed math, not seeded.
// ---------------------------------------------------------------------

const courseCreditsFor = (code: string) => CATALOG_BY_CODE[code]?.credits;

/** A PackPlanResult's course codes are nested inside coreq Bundles
 *  (mandatoryBundles + optimizedBundles — carriedToNextSemester didn't
 *  make it into THIS semester's plan, so it's excluded), not a flat list —
 *  flattened here once for the friction routes below. */
function courseCodesInPlan(plan: PackPlanResult): string[] {
  return [...plan.mandatoryBundles, ...plan.optimizedBundles].flatMap(b => b.members.map(m => m.courseCode));
}

/** What "this student's course load" means for friction purposes: their
 *  own system-recommended next-semester plan (the same buildScoredPlan
 *  used by GET /plan/fast), not "currently registered" proposals — most
 *  students in this demo have never gone through the manual
 *  register/choose flow, so that set is usually empty. Framing it as the
 *  RECOMMENDED plan is also the more useful product shape anyway: it lets
 *  a student see burnout risk BEFORE committing to a plan, not just after.
 *
 *  Shared by all three friction-timeline routes below (GET, toggle-
 *  milestone, reschedule-milestone) — each ends with "recompute and
 *  return the full picture," so the recompute step lives once here. */
async function buildFullFrictionTimeline(studentId: string) {
  const plan = await buildScoredPlan(studentId, 'fast');
  const courseCodes = courseCodesInPlan(plan);
  const doneIds = new Set(db.getCompletedMilestoneIds(studentId));
  const weekOverrides = db.getMilestoneWeekOverrides(studentId);
  const timeline = buildFrictionTimeline(courseCodes, MILESTONES_BY_COURSE, courseCreditsFor, doneIds, weekOverrides);
  const recommendations = recommendTaskMoves(timeline.readings, MILESTONES_BY_COURSE, doneIds);
  return { courseCodes, weekOverrides, recommendations, ...timeline };
}

app.get('/api/students/:id/friction-timeline', requireAuth, requireStudentAccess(guardPorts), blockIfDismissed, async (req, res) => {
  try {
    res.json(await buildFullFrictionTimeline(paramStr(req, 'id')));
  } catch (err) {
    const status = (err as { httpStatus?: number }).httpStatus ?? 500;
    res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// "Mark done" checkbox — toggles one syllabus milestone for this student
// and returns the FULLY RECALCULATED timeline in the same round trip (the
// "recalculate week heaviness" behavior), not just an ack the client has
// to separately re-fetch for.
app.post('/api/students/:id/friction-timeline/toggle-milestone', requireAuth, requireStudentAccess(guardPorts), blockIfDismissed, async (req, res) => {
  try {
    const studentId = paramStr(req, 'id');
    const { milestoneId } = req.body ?? {};
    if (typeof milestoneId !== 'string') return res.status(400).json({ error: 'expected { milestoneId: string }' });
    db.toggleCompletedMilestone(studentId, milestoneId);
    res.json(await buildFullFrictionTimeline(studentId));
  } catch (err) {
    const status = (err as { httpStatus?: number }).httpStatus ?? 500;
    res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// "Move this task a week or two later" — bounded to MAX_MOVE_WEEKS ahead
// of the milestone's own real template week (never backward, never past
// that bound, and never for a fixed-date exam/deadline — see
// MOVABLE_MILESTONE_TYPES). Notifies the student of the schedule change
// in the same request, and returns the recalculated timeline.
app.post('/api/students/:id/friction-timeline/reschedule-milestone', requireAuth, requireStudentAccess(guardPorts), blockIfDismissed, async (req, res) => {
  try {
    const studentId = paramStr(req, 'id');
    const { milestoneId, newWeek } = req.body ?? {};
    if (typeof milestoneId !== 'string' || typeof newWeek !== 'number') {
      return res.status(400).json({ error: 'expected { milestoneId: string, newWeek: number }' });
    }
    const template = SYLLABUS_MILESTONES.find(m => m.id === milestoneId);
    if (!template) return res.status(404).json({ error: `no such milestone ${milestoneId}` });
    if (!MOVABLE_MILESTONE_TYPES.includes(template.type)) {
      return res.status(400).json({ error: `${template.type} has a fixed institutional date and can't be personally rescheduled` });
    }
    if (newWeek < template.weekNumber || newWeek > template.weekNumber + MAX_MOVE_WEEKS || newWeek > SEMESTER_WEEKS) {
      return res.status(400).json({ error: `can only move this task up to ${MAX_MOVE_WEEKS} week(s) later than its original week ${template.weekNumber}` });
    }
    if (!db.getStudent(studentId)) return res.status(404).json({ error: 'student not found' });
    db.setMilestoneWeekOverride(studentId, milestoneId, newWeek);
    db.createNotification(
      'student', studentId, 'task_rescheduled', 'Task rescheduled',
      `You moved "${template.title}" from Week ${template.weekNumber} to Week ${newWeek}.`,
      'workload'
    );
    res.json(await buildFullFrictionTimeline(studentId));
  } catch (err) {
    const status = (err as { httpStatus?: number }).httpStatus ?? 500;
    res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Advisor-level "who needs a check-in this week" — every active student on
// this advisor's roster, their planned load's PEAK friction week, sorted
// worst-first. Dismissed students are excluded (same §12 lockout as
// everywhere else), not just hidden client-side.
app.get('/api/advisors/:advisorId/friction-overview', requireAuth, requireAdvisorAccess(), async (req, res) => {
  const advisorId = paramStr(req, 'advisorId');
  if (!db.getAdvisor(advisorId)) return res.status(404).json({ error: 'advisor not found' });
  const roster = db.listStudents().filter(s => s.advisorId === advisorId && s.status !== 'dismissed');
  const overview = await Promise.all(roster.map(async s => {
    const plan = await buildScoredPlan(s.id, 'fast');
    const timeline = buildFrictionTimeline(courseCodesInPlan(plan), MILESTONES_BY_COURSE, courseCreditsFor);
    const peak = timeline.readings.reduce((max, r) => (r.frictionScore > max.frictionScore ? r : max), timeline.readings[0]);
    const weeksOverThreshold = timeline.readings.filter(r => r.burnoutRisk).length;
    // A single bad week out of 14 is common enough (a normal course load's
    // own finals-period clustering routinely does it — see
    // frictionScore.service.ts's burnoutThreshold derivation) that flagging
    // on ANY single week made this triage view nearly useless: ~24 of 25
    // real students on a real roster hit it, which stops meaning anything.
    // "Sustained" (>=2 weeks) is the actually-discriminating signal for
    // "reach out to this student," while weeksOverThreshold itself still
    // ships so the UI can show the milder single-week case too, not hide it.
    return {
      studentId: s.id, studentName: s.name, peakWeek: peak.weekNumber, peakFrictionScore: peak.frictionScore,
      weeksOverThreshold, sustainedBurnoutRisk: weeksOverThreshold >= 2, trend: timeline.trend,
    };
  }));
  overview.sort((a, b) => b.peakFrictionScore - a.peakFrictionScore);
  res.json(overview);
});

// VP macro dashboard — real historical friction load from every student's
// actual completed transcript (see institutionalBottleneck.service.ts's
// header for exactly why this is grounded in real data rather than a
// second synthetic table, and its honest scoping note about this demo
// only having one real department).
app.get('/api/vp/friction/institutional-bottlenecks', requireAuth, requireAuthRole('vice_president'), (_req, res) => {
  const studentsData: StudentForBottleneck[] = db.listStudents().map(s => ({
    departmentId: s.departmentId,
    transcript: Object.values(db.getTranscript(s.id)).map(r => ({ courseCode: r.courseCode, semesterOrdinal: r.semesterOrdinal })),
  }));
  res.json(computeInstitutionalBottlenecks(studentsData, MILESTONES_BY_COURSE, courseCreditsFor));
});

// ---------------------------------------------------------------------
// Curriculum Analytics epic — Academic Resource Demand Forecasting.
// See docs/CURRICULUM_ANALYTICS_BLUEPRINT.md. Same VP-wide/Advisor-scoped
// route-pair pattern as friction/collider above: the VP route pulls every
// real department (CATALOG_BY_DEPARTMENT, unfiltered); the Advisor route
// 404s on an unknown advisor and scopes to that advisor's own HOME
// department (not their 25-student roster — this is a department-level
// diagnostic view, a deliberately wider scope than the Advisor's other,
// roster-scoped pages).
// ---------------------------------------------------------------------
app.get('/api/vp/curriculum-analytics/demand-forecast', requireAuth, requireAuthRole('vice_president'), (_req, res) => {
  res.json(forecastAllDepartments(CATALOG_BY_DEPARTMENT, OFFERINGS_BY_COURSE, DEPARTMENTS_BY_COURSE_CODE));
});

app.get('/api/advisors/:advisorId/curriculum-analytics/demand-forecast', requireAuth, requireAdvisorAccess(), (req, res) => {
  const advisorId = paramStr(req, 'advisorId');
  const advisor = db.getAdvisor(advisorId);
  if (!advisor) return res.status(404).json({ error: 'advisor not found' });
  const departmentCatalog = CATALOG_BY_DEPARTMENT[advisor.departmentId] ?? [];
  res.json(forecastDepartmentDemand(advisor.departmentId, departmentCatalog, OFFERINGS_BY_COURSE, DEPARTMENTS_BY_COURSE_CODE));
});

// Feature 2 — Curriculum Health Monitor. Same VP-wide (departmentId: null)
// / Advisor-own-department pattern as demand-forecast just above.
app.get('/api/vp/curriculum-analytics/health-monitor', requireAuth, requireAuthRole('vice_president'), (_req, res) => {
  res.json(buildHealthMonitor(null, CATALOG_BY_DEPARTMENT, CATALOG, OFFERINGS_BY_COURSE, DEPARTMENTS_BY_COURSE_CODE));
});

app.get('/api/advisors/:advisorId/curriculum-analytics/health-monitor', requireAuth, requireAdvisorAccess(), (req, res) => {
  const advisorId = paramStr(req, 'advisorId');
  const advisor = db.getAdvisor(advisorId);
  if (!advisor) return res.status(404).json({ error: 'advisor not found' });
  res.json(buildHealthMonitor(advisor.departmentId, CATALOG_BY_DEPARTMENT, CATALOG, OFFERINGS_BY_COURSE, DEPARTMENTS_BY_COURSE_CODE));
});

// Feature 3 — Course Bottleneck & Dependency Analyzer. The VP route is
// institution-wide with no per-student tracing (that already exists on
// VpAdvisorDetail.tsx); the Advisor route adds affectedAdvisees — which of
// THIS advisor's own roster (real ownership scoping, not a UI filter —
// same §12 discipline as every other advisor-facing route) is genuinely at
// risk from a real bottleneck course, per bottleneckDependencyAnalyzer.
// service.ts's own doc comment on why CurriculumCourseView (db.getCurriculum)
// is the right source here rather than just getEligibleCourses.
function forecastedEnrolledByCode(catalog: (typeof CATALOG)): Record<string, number> {
  return Object.fromEntries(catalog.map(c => [c.code, forecastCourseDemand(c, OFFERINGS_BY_COURSE[c.code] ?? []).nextTermEnrolled]));
}

app.get('/api/vp/curriculum-analytics/bottlenecks', requireAuth, requireAuthRole('vice_president'), (_req, res) => {
  res.json(rankBottlenecks(CATALOG, OFFERINGS_BY_COURSE, forecastedEnrolledByCode(CATALOG), DEPARTMENTS_BY_COURSE_CODE));
});

app.get('/api/advisors/:advisorId/curriculum-analytics/bottlenecks', requireAuth, requireAdvisorAccess(), (req, res) => {
  const advisorId = paramStr(req, 'advisorId');
  const advisor = db.getAdvisor(advisorId);
  if (!advisor) return res.status(404).json({ error: 'advisor not found' });

  const bottlenecks = rankBottlenecks(CATALOG, OFFERINGS_BY_COURSE, forecastedEnrolledByCode(CATALOG), DEPARTMENTS_BY_COURSE_CODE);

  const roster = db.listStudents().filter(s => s.advisorId === advisorId && s.status !== 'dismissed');
  const rosterForCheck: StudentForBottleneckCheck[] = roster.map(s => {
    const curriculum = db.getCurriculum(s.id);
    return {
      studentId: s.id,
      failedCourseCodes: curriculum.filter(r => r.status === 'needs_retake').map(r => r.course.code),
      passedCourseCodes: curriculum.filter(r => r.status === 'passed').map(r => r.course.code),
      remainingCourseCodes: curriculum.filter(r => r.status === 'eligible' || r.status === 'locked' || r.status === 'registered').map(r => r.course.code),
    };
  });
  const rosterNameById = new Map(roster.map(s => [s.id, s.name]));
  const affected = affectedAdvisees(rosterForCheck, bottlenecks).map(row => ({ ...row, studentName: rosterNameById.get(row.studentId) ?? 'Unknown student' }));

  res.json({ bottlenecks, affectedAdvisees: affected });
});

// ---------------------------------------------------------------------
// AI Features Blueprint — Project Collider (advisor/VP-facing only).
// ---------------------------------------------------------------------

/** Resolves each member id to a display name — real advisees via
 *  db.getStudent, lightweight cross-faculty collaborators via
 *  COLLABORATORS_BY_ID (see collider.ts's ProjectMember doc comment for
 *  why the two are disambiguated by isCollaborator rather than living in
 *  one store). Enriched at the HTTP boundary, same pattern
 *  withProfessorName already establishes for venture matches. */
function withMemberNames(project: ReturnType<typeof db.getColliderProject>) {
  if (!project) return project;
  return {
    ...project,
    members: project.members.map(m => ({
      ...m,
      name: m.isCollaborator ? (COLLABORATORS_BY_ID[m.id]?.name ?? 'Unknown collaborator') : (db.getStudent(m.id)?.name ?? 'Unknown student'),
    })),
  };
}

// ---------------------------------------------------------------------
// Cross-cutting in-app notifications — see notification.ts's own header.
// `role`/`recipientId` are still client-supplied query params (the
// `NotificationRole` shape predates this file's real session model), but
// notificationRoleMatchesAuth (below) now checks them against the real
// authenticated session before trusting them — a caller can no longer
// just claim to be a different recipient. GET/read-all are covered;
// mark-one-read (:id only, no role/recipientId to check) is a
// documented residual gap, see its own route comment.
// ---------------------------------------------------------------------
function parseNotificationRole(v: unknown): 'student' | 'advisor' | 'vp' | null {
  return v === 'student' || v === 'advisor' || v === 'vp' ? v : null;
}

// NotificationRole ('student'|'advisor'|'vp') predates AuthRole
// ('student'|'advisor'|'vice_president') and uses different string
// values for the same three parties — this maps between them rather than
// unifying the two types (NotificationRole is also used as a DB query
// key elsewhere; not this epic's job to rename it).
function notificationRoleMatchesAuth(role: 'student' | 'advisor' | 'vp', recipientId: string, auth: { role: AuthRole; id: string | null }): boolean {
  if (auth.role === 'vice_president') return role === 'vp';
  if (auth.role === 'advisor') return role === 'advisor' && recipientId === auth.id;
  if (auth.role === 'student') return role === 'student' && recipientId === auth.id;
  return false;
}

app.get('/api/notifications', requireAuth, (req, res) => {
  const role = parseNotificationRole(req.query.role);
  const recipientId = req.query.recipientId;
  if (!role || typeof recipientId !== 'string') return res.status(400).json({ error: 'expected ?role=student|advisor|vp&recipientId=...' });
  if (!notificationRoleMatchesAuth(role, recipientId, req.auth!)) return res.status(403).json({ error: 'forbidden' });
  res.json({ notifications: db.listNotifications(role, recipientId), unreadCount: db.unreadNotificationCount(role, recipientId) });
});

// Real backend authentication epic: marking a single notification read has
// no role/recipientId to check ownership against at all (just an id) —
// requireAuth (must be SOME valid session) is the most this route can
// enforce without extending markNotificationRead itself to also verify
// the notification belongs to the caller; documented residual gap, same
// as the professor/admin routes' own noted exceptions.
app.post('/api/notifications/:id/read', requireAuth, (req, res) => {
  db.markNotificationRead(paramStr(req, 'id'));
  res.json({ ok: true });
});

app.post('/api/notifications/read-all', requireAuth, (req, res) => {
  const { role, recipientId } = req.body ?? {};
  const parsedRole = parseNotificationRole(role);
  if (!parsedRole || typeof recipientId !== 'string') return res.status(400).json({ error: 'expected { role: "student"|"advisor"|"vp", recipientId: string }' });
  if (!notificationRoleMatchesAuth(parsedRole, recipientId, req.auth!)) return res.status(403).json({ error: 'forbidden' });
  db.markAllNotificationsRead(parsedRole, recipientId);
  res.json({ ok: true });
});

app.get('/api/advisors/:advisorId/collider/projects', requireAuth, requireAdvisorAccess(), (req, res) => {
  const advisorId = paramStr(req, 'advisorId');
  if (!db.getAdvisor(advisorId)) return res.status(404).json({ error: 'advisor not found' });
  res.json(db.listColliderProjectsForAdvisor(advisorId).map(withMemberNames));
});

// Matches against the REAL live opportunity table (RemoteOK internships +
// Grants.gov grants, both with a curated fallback — see
// externalOpportunitiesLive.service.ts), not just the static seed.
app.get('/api/collider/projects/:id/opportunity-matches', requireAuth, requireAuthRole('advisor', 'vice_president'), async (req, res) => {
  const project = db.getColliderProject(paramStr(req, 'id'));
  if (!project) return res.status(404).json({ error: 'project not found' });
  const opportunities = await getAllOpportunities();
  res.json(matchOpportunitiesForProject(project, opportunities));
});

app.get('/api/vp/collider/topography', requireAuth, requireAuthRole('vice_president'), (_req, res) => {
  res.json(buildTopography(db.listColliderProjects()));
});

app.post('/api/vp/collider/projects/:id/fund', requireAuth, requireAuthRole('vice_president'), (req, res) => {
  const { amount, note, source, grantName } = req.body ?? {};
  if (typeof amount !== 'number') return res.status(400).json({ error: 'expected { amount: number, note?: string, source: "university"|"external_grant", grantName?: string }' });
  if (source !== 'university' && source !== 'external_grant') {
    return res.status(400).json({ error: 'expected source to be "university" or "external_grant"' });
  }
  try {
    res.json(withMemberNames(db.fundColliderProject(
      paramStr(req, 'id'), amount, typeof note === 'string' ? note : '', source, typeof grantName === 'string' ? grantName : undefined
    )));
  } catch (err) {
    const status = (err as { httpStatus?: number }).httpStatus ?? 500;
    res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Advisor console's own Venture Board (advisorConsole/venture/*) — the
// advisor "owns" every venture directly rather than browsing a directory of
// separate professors, so this returns every project across every
// professor in one shot (each item still carries its real owning
// professorId, which the client uses to call the existing per-professor
// edit route below — that still enforces that a project can only be
// edited via ITS OWN professorId, unchanged).
// Real bug fix: every advisor's venture board used to show EVERY advisor's
// ventures (a leftover from before 5 real advisor identities existed — see
// seedVentureProjects.ts's PROFESSORS comment). `?advisorId=` now scopes
// this to that one advisor's own postings only; omitted (the VP's own
// board calls it this way) still returns everything, since cross-advisor
// oversight is the VP's whole point everywhere else in this app too.
// Same VP-unscoped / advisor-own-id-only scoping rule as GET /api/students.
app.get('/api/advisor/venture-projects', requireAuth, (req, res) => {
  const { advisorId } = req.query;
  if (req.auth!.role !== 'vice_president') {
    if (req.auth!.role !== 'advisor' || typeof advisorId !== 'string' || advisorId !== req.auth!.id) {
      return res.status(403).json({ error: 'forbidden' });
    }
  }
  let projects = db.listVentureProjects();
  if (typeof advisorId === 'string') projects = projects.filter(p => p.professorId === advisorId);
  const rows = projects.map(project => {
    const candidates = db.getVentureProjectCandidates(project.id);
    return {
      project,
      candidates,
      acceptedCount: candidates.filter(c => c.status === 'accepted').length,
      // §16.2's "no need to store noise" means a candidate who clears the
      // 0.80 match threshold only gets a real, actionable StudentVentureMatch
      // row (status 'suggested'/'applied') once THEY visit their own
      // Venture Board — a qualifying match nobody has looked at yet still
      // reads 'unscored' here. Counting those too (isPendingCandidate) means
      // the advisor's queue reflects real qualifying matches immediately,
      // not just the ones a student happened to trigger materialization for.
      pendingCount: candidates.filter(isPendingCandidate).length,
    };
  });
  res.json(rows);
});

app.post('/api/professors/:id/venture-projects', requireAuth, requireAuthRole('advisor', 'vice_president'), (req, res) => {
  if (!db.getProfessor(paramStr(req, 'id'))) return res.status(404).json({ error: 'professor not found' });
  const {
    title, description, type, requiredCourseCodes, preferredSkills, capacity, isActive,
    // VP epic — "research portal": optional published-research fields any
    // advisor (or the VP) can attach to a project alongside the plain
    // open-position fields above.
    authors, publishedPaperUrl, conferenceName, impactFactor, labName,
    // Graduation Project epic — orthogonal to `type` (see VentureProject's
    // own doc comment): a graduation project can be posted on either track.
    isGraduationProject,
  } = req.body ?? {};
  if (typeof title !== 'string' || typeof description !== 'string' || (type !== 'academic_research' && type !== 'commercial_spinoff')) {
    return res.status(400).json({ error: 'expected { title, description, type: "academic_research"|"commercial_spinoff", requiredCourseCodes[], preferredSkills[], capacity, isActive? }' });
  }
  try {
    const project = db.createVentureProject({
      professorId: paramStr(req, 'id'),
      title,
      description,
      type,
      requiredCourseCodes: Array.isArray(requiredCourseCodes) ? requiredCourseCodes : [],
      preferredSkills: Array.isArray(preferredSkills) ? preferredSkills : [],
      capacity: typeof capacity === 'number' && capacity > 0 ? capacity : 1,
      isActive: isActive !== false,
      authors: Array.isArray(authors)
        ? authors.filter((a: unknown): a is { name: string; link?: string } => !!a && typeof (a as { name?: unknown }).name === 'string' && (a as { name: string }).name.trim() !== '')
        : undefined,
      publishedPaperUrl: typeof publishedPaperUrl === 'string' && publishedPaperUrl.trim() ? publishedPaperUrl.trim() : undefined,
      conferenceName: typeof conferenceName === 'string' && conferenceName.trim() ? conferenceName.trim() : undefined,
      impactFactor: typeof impactFactor === 'number' && impactFactor >= 0 ? impactFactor : undefined,
      labName: typeof labName === 'string' && labName.trim() ? labName.trim() : undefined,
      isGraduationProject: isGraduationProject === true ? true : undefined,
    });
    res.json(project);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.put('/api/professors/:id/venture-projects/:projectId', requireAuth, requireAuthRole('advisor', 'vice_president'), (req, res) => {
  const project = db.getVentureProject(paramStr(req, 'projectId'));
  if (!project) return res.status(404).json({ error: 'venture project not found' });
  if (project.professorId !== paramStr(req, 'id')) return res.status(403).json({ error: "not this professor's project" });
  try {
    res.json(db.updateVentureProject(paramStr(req, 'projectId'), req.body ?? {}));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// An advisor requesting funding on one of THEIR OWN ventures — allowed
// regardless of the project's current isActive status (see
// requestGrantForVentureProject's own doc comment). Notifies the VP.
app.post('/api/professors/:id/venture-projects/:projectId/grant-request', requireAuth, requireAuthRole('advisor', 'vice_president'), (req, res) => {
  const { amount, note, timelinePlanFileName, timelinePlanDataUrl } = req.body ?? {};
  if (typeof amount !== 'number') return res.status(400).json({ error: 'expected { amount: number, note?: string }' });
  try {
    res.json(db.requestGrantForVentureProject(
      paramStr(req, 'id'), paramStr(req, 'projectId'), amount, typeof note === 'string' ? note : '',
      typeof timelinePlanFileName === 'string' ? timelinePlanFileName : undefined,
      typeof timelinePlanDataUrl === 'string' ? timelinePlanDataUrl : undefined
    ));
  } catch (err) {
    const status = (err as { httpStatus?: number }).httpStatus ?? 500;
    res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// VP decides a pending grant request. Notifies the requesting advisor.
app.post('/api/vp/venture-projects/:projectId/grant-request/decide', requireAuth, requireAuthRole('vice_president'), (req, res) => {
  const { decision, decisionNote } = req.body ?? {};
  if (decision !== 'approved' && decision !== 'declined') return res.status(400).json({ error: 'expected { decision: "approved"|"declined", decisionNote?: string }' });
  try {
    res.json(db.decideVentureGrantRequest(paramStr(req, 'projectId'), decision, typeof decisionNote === 'string' ? decisionNote : undefined));
  } catch (err) {
    const status = (err as { httpStatus?: number }).httpStatus ?? 500;
    res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.patch('/api/venture-matches/:matchId', requireAuth, requireAuthRole('advisor', 'vice_president'), (req, res) => {
  const { status } = req.body ?? {};
  if (status !== 'accepted' && status !== 'declined') return res.status(400).json({ error: 'expected { status: "accepted" | "declined" }' });
  try {
    res.json(db.setVentureMatchStatusByProfessor(paramStr(req, 'matchId'), status));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---------------------------------------------------------------------
// §9.2 admin — tunable prediction weights (read: any role, write: admin/registrar)
// ---------------------------------------------------------------------
app.get('/api/admin/prediction-weights', (_req, res) => {
  res.json(weights);
});

app.put('/api/admin/prediction-weights', requireRole('registrar'), (req, res) => {
  const patch = req.body ?? {};
  if (typeof patch !== 'object' || patch === null) return res.status(400).json({ error: 'expected a JSON object patch' });
  // Deep-merge the patch into the shared, already-imported weights object —
  // every prediction/*.ts module holds the SAME object reference (Node
  // caches JSON imports as one singleton per process), so mutating it here
  // takes effect immediately for every subsequent /advise or /plan call.
  deepMerge(weights as Record<string, unknown>, patch);
  // Persist to disk too, so a restart doesn't silently lose a committee's
  // retuned weights (spec §12: "recalibrated ... without a code change").
  fs.writeFileSync(path.join(__dirname, 'config/predictionWeights.json'), JSON.stringify(weights, null, 2));
  clearChainUnlockCache(); // depth/decay may have changed
  res.json(weights);
});

function deepMerge(target: Record<string, unknown>, patch: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && typeof target[key] === 'object') {
      deepMerge(target[key] as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      target[key] = value;
    }
  }
}

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Academic Advisor demo server listening on http://localhost:${PORT}`);
    console.log(`Open http://localhost:${PORT} in a browser to use the demo frontend.`);
  });
}

export { app };
