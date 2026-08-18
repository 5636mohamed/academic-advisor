// HTTP surface for the whole system, wired to the in-memory store (see
// db/memory/inMemoryDb.ts's header for exactly how this differs from the
// real Prisma/Postgres layer described in spec §9.3 — still pending). This
// now covers every route in spec §9.2 that the in-memory store can
// meaningfully serve, plus the static demo frontend. What's still a
// deliberate simplification rather than a gap: auth is a single `x-role`
// header instead of real JWT sessions (spec §9's roles are respected —
// admin-only routes check it — but there's no login flow behind it), and
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
import { CATALOG } from './db/seed/seedCatalog';
import { buildCandidatePool } from './modules/retakeGate/retakePreference.service';
import { packPlan, PackPlanResult } from './modules/prediction/planPacker';
import { DEPARTMENTS, OTHER_FACULTY_DEPARTMENTS, FACULTIES, QUIZ } from './modules/fitEngine/deptFitEngine';
import { creditCapFor } from './modules/grading/level';
import { projectExpectedVsBestCase } from './modules/prediction/whatIfProjection';
import { bestCasePct } from './modules/prediction/bestCaseProjection';
import { VENTURE_QUIZ } from './modules/venture/ventureQuiz';
import weights from './config/predictionWeights.json';

const app = express();

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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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
  const student = db.getStudent(req.params.id);
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
// Students — read
// ---------------------------------------------------------------------
// Multi-advisor epic: an optional ?advisorId= scopes the roster down to
// one advisor's own 25 students — query-param-based, same demo-grade
// rigor as the rest of this app's auth (client-checked route guards, no
// real session), not a stronger guarantee. Unscoped (no param) still
// returns everyone, used by the Vice President's cross-advisor views.
app.get('/api/students', (req, res) => {
  const { advisorId } = req.query;
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

app.get('/api/students/:id', (req, res) => {
  const student = toStudentWithCgpa(req.params.id);
  if (!student) return res.status(404).json({ error: 'student not found' });
  res.json({
    ...student,
    // §15.3.1 registered-but-ungraded courses now show as pending rows
    // alongside real graded attempts — see getTranscriptWithRegistered's
    // doc comment for why this is a read-time merge, not a stored one.
    transcript: db.getTranscriptWithRegistered(req.params.id),
    cgpaSnapshots: displayCgpaSnapshots(req.params.id),
    quizAnswers: db.getStudent(req.params.id)?.quizAnswers ?? {},
    transferRecords: db.getTransferRecords(req.params.id),
  });
});

app.get('/api/students/:id/eligible-courses', (req, res) => {
  if (!db.getStudent(req.params.id)) return res.status(404).json({ error: 'student not found' });
  res.json(db.getEligibleCourses(req.params.id));
});

// §14/§15 — the full catalog, one row per course, annotated with this
// student's status on it (passed/needs-retake/registered/eligible/locked).
// Backs the per-semester Curriculum tab.
app.get('/api/students/:id/curriculum', (req, res) => {
  if (!db.getStudent(req.params.id)) return res.status(404).json({ error: 'student not found' });
  res.json(db.getCurriculum(req.params.id));
});

// ---------------------------------------------------------------------
// §5 retake gate
// ---------------------------------------------------------------------
app.post('/api/students/:id/retake-preference', (req, res) => {
  if (!db.getStudent(req.params.id)) return res.status(404).json({ error: 'student not found' });
  const { considerRetakes } = req.body ?? {};
  if (typeof considerRetakes !== 'boolean') return res.status(400).json({ error: 'expected { considerRetakes: boolean }' });
  db.setRetakePreference(req.params.id, considerRetakes);
  res.json({ ok: true, considerRetakes });
});

// ---------------------------------------------------------------------
// Write: record a grade attempt (a fresh course or a retake) — the
// "registration/enrollment" endpoint, locked out once dismissed (§12).
// ---------------------------------------------------------------------
app.post('/api/students/:id/enroll', blockIfDismissed, (req, res) => {
  const { courseCode, pct, semesterOrdinal } = req.body ?? {};
  if (typeof courseCode !== 'string' || typeof pct !== 'number' || typeof semesterOrdinal !== 'number') {
    return res.status(400).json({ error: 'expected { courseCode: string, pct: number, semesterOrdinal: number }' });
  }
  try {
    const result = db.recordEnrollment(req.params.id, courseCode, pct, semesterOrdinal);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/students/:id/quiz', (req, res) => {
  if (!db.getStudent(req.params.id)) return res.status(404).json({ error: 'student not found' });
  const answers = req.body ?? {};
  db.setQuizAnswers(req.params.id, answers);
  res.json({ ok: true, quizAnswers: db.getStudent(req.params.id)?.quizAnswers });
});

// ---------------------------------------------------------------------
// §4.2/§8 — the real orchestrator, locked out once dismissed.
// ---------------------------------------------------------------------
app.post('/api/students/:id/advise', blockIfDismissed, async (req, res) => {
  const student = toStudentWithCgpa(req.params.id);
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
    res.json({ ...result, plan: attachBestCase(req.params.id, result.plan) }); // §15.2
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
  const cap = creditCapFor({ isPostLowFirstSemester: isHalfLoad, cgpa: student.cgpa });
  return packPlan({ mandatory: scoredMandatory, pool: scoredPool, cap, mode });
}

app.get('/api/students/:id/plan/fast', async (req, res) => {
  if (!db.getStudent(req.params.id)) return res.status(404).json({ error: 'student not found' });
  try {
    res.json(attachBestCaseToPlanResult(req.params.id, await buildScoredPlan(req.params.id, 'fast')));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/students/:id/plan/target', async (req, res) => {
  const student = toStudentWithCgpa(req.params.id);
  if (!student) return res.status(404).json({ error: 'student not found' });
  const targetCgpa = Number(req.query.cgpa);
  if (!Number.isFinite(targetCgpa)) return res.status(400).json({ error: 'expected ?cgpa=<number>' });
  // §0's baseline description: re-weighted toward "safety" (below target) or "speed" (above target).
  const mode = student.cgpa < targetCgpa ? 'target_safe' : 'target_fast';
  try {
    res.json({ mode, targetCgpa, ...attachBestCaseToPlanResult(req.params.id, await buildScoredPlan(req.params.id, mode)) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---------------------------------------------------------------------
// §6 — department/faculty fit
// ---------------------------------------------------------------------
app.get('/api/students/:id/department-fit', async (req, res) => {
  const student = toStudentWithCgpa(req.params.id);
  if (!student) return res.status(404).json({ error: 'student not found' });
  res.json(await ports.recommendDepartments(student));
});

app.get('/api/students/:id/faculty-fit', async (req, res) => {
  const student = toStudentWithCgpa(req.params.id);
  if (!student) return res.status(404).json({ error: 'student not found' });
  res.json(await ports.rankFacultiesByFit(student));
});

// ---------------------------------------------------------------------
// §4 — probation / dismissal audit trail
// ---------------------------------------------------------------------
app.get('/api/students/:id/probation', (req, res) => {
  try {
    const { counter, log } = db.getProbationHistory(req.params.id);
    res.json({ count: counter.count, armed: counter.armed, history: log });
  } catch {
    res.status(404).json({ error: 'student not found' });
  }
});

app.get('/api/students/:id/cgpa-trend', (req, res) => {
  const student = db.getStudent(req.params.id);
  if (!student) return res.status(404).json({ error: 'student not found' });
  const snapshots = displayCgpaSnapshots(req.params.id);
  const trend = projectCGPATrend(snapshots);
  res.json({ snapshots, trendSlope: trend.slope, reading: trend.reading });
});

/** Spec's `POST /api/semesters/:id/close` — exposed here per-student since
 *  this store has no globally-addressable Semester id independent of its
 *  owning student (flagged deviation, see file header). */
app.post('/api/students/:id/semesters/close', (req, res) => {
  const student = db.getStudent(req.params.id);
  if (!student) return res.status(404).json({ error: 'student not found' });
  const { semesterId, isFirstSemester } = req.body ?? {};
  if (typeof semesterId !== 'string') return res.status(400).json({ error: 'expected { semesterId: string, isFirstSemester?: boolean }' });

  const cgpaAtClose = db.getCurrentCgpa(req.params.id);
  if (isFirstSemester) {
    const result = onFirstSemesterClose({ studentId: req.params.id, semesterId, gpaAtClose: cgpaAtClose });
    res.json(result);
  } else {
    const result = onSemesterClose({
      studentId: req.params.id,
      semesterId,
      cgpaAtClose,
      counter: student.probationCounter,
    });
    if (result.dismissed) db.updateStudentStatus(req.params.id, 'dismissed');
    res.json(result);
  }
});

// ---------------------------------------------------------------------
// §7 — transfer execution, all locked out once dismissed.
// ---------------------------------------------------------------------
app.post('/api/students/:id/transfer/internal', blockIfDismissed, (req, res) => {
  const { toDepartmentId } = req.body ?? {};
  if (typeof toDepartmentId !== 'string') return res.status(400).json({ error: 'expected { toDepartmentId: string }' });
  try {
    const result = db.executeInternalTransferForStudent(req.params.id, toDepartmentId, `sem-transfer-${Date.now()}`);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/students/:id/transfer/external', blockIfDismissed, (req, res) => {
  const { toFacultyId, toDepartmentId } = req.body ?? {};
  if (typeof toFacultyId !== 'string' || typeof toDepartmentId !== 'string') {
    return res.status(400).json({ error: 'expected { toFacultyId: string, toDepartmentId: string }' });
  }
  try {
    const result = db.executeExternalTransferForStudent(req.params.id, toFacultyId, toDepartmentId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/students/:id/transfer/preview', (req, res) => {
  if (!db.getStudent(req.params.id)) return res.status(404).json({ error: 'student not found' });
  const toFacultyId = String(req.query.toFacultyId ?? '');
  if (!toFacultyId) return res.status(400).json({ error: 'expected ?toFacultyId=<facultyId>' });
  try {
    res.json(db.previewExternalTransfer(req.params.id, toFacultyId));
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
app.post('/api/students/:id/transfer-requests', blockIfDismissed, (req, res) => {
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
    res.json(db.createTransferRequestForStudent(req.params.id, type, toDepartmentId, toFacultyId));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/students/:id/transfer-requests', (req, res) => {
  if (!db.getStudent(req.params.id)) return res.status(404).json({ error: 'student not found' });
  res.json(db.listTransferRequestsForStudent(req.params.id));
});

app.get('/api/advisors/:advisorId/transfer-requests', (req, res) => {
  res.json(db.listTransferRequestsForAdvisor(req.params.advisorId));
});

app.post('/api/advisor/transfer-requests/:requestId/approve', (req, res) => {
  try {
    res.json(db.advisorDecideTransferRequest(req.params.requestId, 'approve'));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/advisor/transfer-requests/:requestId/decline', (req, res) => {
  try {
    res.json(db.advisorDecideTransferRequest(req.params.requestId, 'decline', req.body?.reason));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/vp/transfer-requests', (_req, res) => {
  res.json(db.listAllTransferRequests());
});

app.get('/api/vp/transfer-requests-summary', (_req, res) => {
  res.json(db.getTransferCountersByAdvisor());
});

app.post('/api/vp/transfer-requests/:requestId/approve', (req, res) => {
  try {
    res.json(db.vpDecideTransferRequest(req.params.requestId, 'approve'));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/vp/transfer-requests/:requestId/decline', (req, res) => {
  try {
    res.json(db.vpDecideTransferRequest(req.params.requestId, 'decline', req.body?.reason));
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
  const depts = [...DEPARTMENTS, ...OTHER_FACULTY_DEPARTMENTS].filter(d => d.facultyId === req.params.facultyId);
  res.json(depts.map(d => ({ id: d.id, name: d.name })));
});

// ---------------------------------------------------------------------
// §3.3 — dependency-chain visualization data
// ---------------------------------------------------------------------
app.get('/api/courses/:code/chain', (req, res) => {
  const course = CATALOG.find(c => c.code === req.params.code);
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

app.post('/api/students/:id/proposals/generate', async (req, res) => {
  const student = toStudentWithCgpa(req.params.id);
  if (!student) return res.status(404).json({ error: 'student not found' });
  try {
    const result = await runAdvisingCycle(student, ports); // §4.2/§8, unchanged
    db.addProposalsFromPlan(req.params.id, result.plan);
    res.json(proposalsWithImpact(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/students/:id/proposals', (req, res) => {
  if (!db.getStudent(req.params.id)) return res.status(404).json({ error: 'student not found' });
  res.json(proposalsWithImpact(req.params.id));
});

app.post('/api/advisor/proposals/:proposalId/approve', (req, res) => {
  try {
    res.json(db.approveProposalById(req.params.proposalId));
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// "Approve all" — accept the system's whole plan in one click. Skips any
// slot the advisor already replaced with their own alternate; returns the
// same shape as GET/generate so the frontend can reuse one response handler.
app.post('/api/advisor/students/:id/proposals/approve-all', (req, res) => {
  if (!db.getStudent(req.params.id)) return res.status(404).json({ error: 'student not found' });
  try {
    db.approveAllPendingSystemProposals(req.params.id);
    res.json(proposalsWithImpact(req.params.id));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/advisor/proposals/:proposalId/decline', (req, res) => {
  try {
    res.json(db.declineProposalById(req.params.proposalId));
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
app.post('/api/advisor/students/:id/proposals/:slotKey/alternate/preview', async (req, res) => {
  if (!db.getStudent(req.params.id)) return res.status(404).json({ error: 'student not found' });
  const { courseCode } = req.body ?? {};
  if (typeof courseCode !== 'string') return res.status(400).json({ error: 'expected { courseCode: string }' });
  try {
    const scored = await scoreAlternateCandidate(req.params.id, courseCode);
    res.json(db.previewAdvisorAlternate(req.params.id, req.params.slotKey, courseCode, scored));
  } catch (err) {
    const status = (err as { httpStatus?: number }).httpStatus ?? 500;
    res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// §15.3.2 step 2(b) — the advisor picks an alternate course for a slot; the
// SAME §3.1 scoring pipeline the system used is run here, on demand, so the
// advisor sees the real projected impact before confirming — never a guess.
app.post('/api/advisor/students/:id/proposals/:slotKey/alternate', async (req, res) => {
  const { courseCode, acknowledgedByAdvisorName } = req.body ?? {};
  if (typeof courseCode !== 'string') return res.status(400).json({ error: 'expected { courseCode: string }' });
  if (acknowledgedByAdvisorName !== undefined && typeof acknowledgedByAdvisorName !== 'string') {
    return res.status(400).json({ error: 'acknowledgedByAdvisorName must be a string if provided' });
  }
  try {
    const scored = await scoreAlternateCandidate(req.params.id, courseCode);
    const proposal = db.addAdvisorAlternateProposal(req.params.id, req.params.slotKey, courseCode, scored, acknowledgedByAdvisorName);
    res.json(proposal);
  } catch (err) {
    const status = (err as { httpStatus?: number }).httpStatus ?? 500;
    res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// §15.3.2 step 3 — student picks one option for a slot.
app.post('/api/students/:id/proposals/:proposalId/choose', (req, res) => {
  if (!db.getStudent(req.params.id)) return res.status(404).json({ error: 'student not found' });
  try {
    const result = db.chooseProposalById(req.params.id, req.params.proposalId);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/students/:id/registered-courses', (req, res) => {
  if (!db.getStudent(req.params.id)) return res.status(404).json({ error: 'student not found' });
  res.json(db.getRegisteredCourses(req.params.id));
});

// §15.4 — the advisor's PDF report is built client-side from this aggregate.
// Same ?advisorId= scoping as GET /api/students above.
app.get('/api/advisor/report', (req, res) => {
  const { advisorId } = req.query;
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
// pre-fill the toggle/quiz instead of asking blind every visit.
app.get('/api/students/:id/venture-gate', (req, res) => {
  if (!db.getStudent(req.params.id)) return res.status(404).json({ error: 'student not found' });
  res.json({ interested: db.getVentureGateAnswer(req.params.id) });
});

app.get('/api/students/:id/venture-interest-form', (req, res) => {
  if (!db.getStudent(req.params.id)) return res.status(404).json({ error: 'student not found' });
  res.json({ answers: db.getVentureInterestAnswers(req.params.id) });
});

app.post('/api/students/:id/venture-gate', (req, res) => {
  const student = db.getStudent(req.params.id);
  if (!student) return res.status(404).json({ error: 'student not found' });
  const { interested } = req.body ?? {};
  if (typeof interested !== 'boolean') return res.status(400).json({ error: 'expected { interested: boolean }' });
  if (student.level < weights.ventureFit.minLevel) {
    return res.status(403).json({ error: `Venture Gate is only asked of Level ${weights.ventureFit.minLevel}+ students (§16.1)` });
  }
  db.setVentureGateAnswer(req.params.id, interested);
  res.json({ ok: true, interested });
});

app.post('/api/students/:id/venture-interest-form', (req, res) => {
  if (!db.getStudent(req.params.id)) return res.status(404).json({ error: 'student not found' });
  const answers = req.body ?? {};
  db.setVentureInterestAnswers(req.params.id, answers);
  res.json({ ok: true, answers: db.getVentureInterestAnswers(req.params.id) });
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
app.get('/api/students/:id/venture-matches', blockIfDismissed, (req, res) => {
  res.json(db.getVentureMatches(req.params.id).map(withProfessorName));
});

// §16.4 — express interest, optionally attaching a CV in the same action.
// Requires an already-persisted match row (only ever true once threshold
// was cleared at least once) — the UI no longer calls this directly (see
// the project-keyed route below, which also covers below-threshold
// projects); kept for any caller that already has a concrete `matchId`.
app.post('/api/students/:id/venture-matches/:matchId/apply', blockIfDismissed, (req, res) => {
  const { cvFileName, cvDataUrl } = req.body ?? {};
  if ((cvFileName && typeof cvFileName !== 'string') || (cvDataUrl && typeof cvDataUrl !== 'string')) {
    return res.status(400).json({ error: 'expected optional { cvFileName?: string, cvDataUrl?: string }' });
  }
  try {
    const cv = cvFileName && cvDataUrl ? { fileName: cvFileName, dataUrl: cvDataUrl } : undefined;
    res.json(db.applyToVentureMatch(req.params.id, req.params.matchId, cv));
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
app.post('/api/students/:id/venture-projects/:projectId/express-interest', blockIfDismissed, (req, res) => {
  const { cvFileName, cvDataUrl } = req.body ?? {};
  if ((cvFileName && typeof cvFileName !== 'string') || (cvDataUrl && typeof cvDataUrl !== 'string')) {
    return res.status(400).json({ error: 'expected optional { cvFileName?: string, cvDataUrl?: string }' });
  }
  try {
    const cv = cvFileName && cvDataUrl ? { fileName: cvFileName, dataUrl: cvDataUrl } : undefined;
    res.json(db.applyToVentureProject(req.params.id, req.params.projectId, cv));
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

// --- Faculty Console (role: professor) ---
app.get('/api/professors', (_req, res) => {
  // 'advisor-owned' (seedVentureProjects.ts) is an internal attribution
  // anchor for ventures the advisor console posts directly — not a real
  // professor a student should see hosting a project list or a login this
  // route should ever surface as choosable.
  res.json(db.listProfessors().filter(p => p.id !== 'advisor-owned'));
});

// --- Multi-advisor epic: the 5 named advisors (each with their own
// 25-student roster) — mirrors the professors routes above exactly. ---
app.get('/api/advisors', (_req, res) => {
  res.json(db.listAdvisors());
});

app.get('/api/advisors/:id', (req, res) => {
  const advisor = db.getAdvisor(req.params.id);
  if (!advisor) return res.status(404).json({ error: 'advisor not found' });
  res.json(advisor);
});

// --- Vice President portal ---

// Per-advisor summary for the VP dashboard: roster size + average CGPA.
// Not roster-scoped by design — the VP's whole point is a cross-advisor view.
app.get('/api/vp/advisors-summary', (_req, res) => {
  const summary = db.listAdvisors().map(a => {
    const roster = db.listStudents().filter(s => s.advisorId === a.id);
    const avgCgpa = roster.length > 0
      ? roster.reduce((sum, s) => sum + db.getCurrentCgpa(s.id), 0) / roster.length
      : 0;
    return { advisor: a, studentCount: roster.length, averageCgpa: Math.round(avgCgpa * 100) / 100 };
  });
  res.json(summary);
});

// The flat, cross-advisor pending-approvals queue (see
// listPendingProposalsAcrossAllAdvisors's doc comment).
app.get('/api/vp/pending-proposals', (_req, res) => {
  res.json(db.listPendingProposalsAcrossAllAdvisors());
});

// Advisor console's own Venture Board (advisorConsole/venture/*) — the
// advisor "owns" every venture directly rather than browsing a directory of
// separate professors, so this returns every project across every
// professor in one shot (each item still carries its real owning
// professorId, which the client uses to call the existing per-professor
// edit/candidates routes below — those still enforce that a project can
// only be edited via ITS OWN professorId, unchanged).
app.get('/api/advisor/venture-projects', (_req, res) => {
  const projects = db.listVentureProjects().map(project => {
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
  res.json(projects);
});

app.get('/api/professors/:id', (req, res) => {
  const professor = db.getProfessor(req.params.id);
  if (!professor) return res.status(404).json({ error: 'professor not found' });
  res.json({ ...professor, projects: db.listVentureProjectsByProfessor(req.params.id) });
});

app.post('/api/professors/:id/venture-projects', (req, res) => {
  if (!db.getProfessor(req.params.id)) return res.status(404).json({ error: 'professor not found' });
  const { title, description, type, requiredCourseCodes, preferredSkills, capacity, isActive } = req.body ?? {};
  if (typeof title !== 'string' || typeof description !== 'string' || (type !== 'academic_research' && type !== 'commercial_spinoff')) {
    return res.status(400).json({ error: 'expected { title, description, type: "academic_research"|"commercial_spinoff", requiredCourseCodes[], preferredSkills[], capacity, isActive? }' });
  }
  try {
    const project = db.createVentureProject({
      professorId: req.params.id,
      title,
      description,
      type,
      requiredCourseCodes: Array.isArray(requiredCourseCodes) ? requiredCourseCodes : [],
      preferredSkills: Array.isArray(preferredSkills) ? preferredSkills : [],
      capacity: typeof capacity === 'number' && capacity > 0 ? capacity : 1,
      isActive: isActive !== false,
    });
    res.json(project);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.put('/api/professors/:id/venture-projects/:projectId', (req, res) => {
  const project = db.getVentureProject(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'venture project not found' });
  if (project.professorId !== req.params.id) return res.status(403).json({ error: "not this professor's project" });
  try {
    res.json(db.updateVentureProject(req.params.projectId, req.body ?? {}));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// §16.6 — ranked, auto-generated candidate list for one project.
app.get('/api/professors/:id/venture-projects/:projectId/candidates', (req, res) => {
  const project = db.getVentureProject(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'venture project not found' });
  if (project.professorId !== req.params.id) return res.status(403).json({ error: "not this professor's project" });
  try {
    res.json(db.getVentureProjectCandidates(req.params.projectId));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.patch('/api/venture-matches/:matchId', (req, res) => {
  const { status } = req.body ?? {};
  if (status !== 'accepted' && status !== 'declined') return res.status(400).json({ error: 'expected { status: "accepted" | "declined" }' });
  try {
    res.json(db.setVentureMatchStatusByProfessor(req.params.matchId, status));
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
