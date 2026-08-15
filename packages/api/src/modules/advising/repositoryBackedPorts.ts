// Wires the in-memory store (src/db/memory/inMemoryDb.ts) into a real
// `AdvisingCyclePorts` implementation, so `runAdvisingCycle` can be called
// with actual (if in-memory) student data instead of hand-built test
// fixtures. This is the adapter flagged as pending in
// `advisingCycle.service.ts`'s header comment — swapping the in-memory
// calls below for Prisma queries later should not require changing
// `AdvisingCyclePorts` itself or `runAdvisingCycle`.
import { CgpaSnapshot } from '@advisor/shared';
import {
  AdvisingCyclePorts,
  ScoredCandidate,
  StudentWithCgpa,
  DeptFitResult,
  SimulateUnderDepartmentResult,
} from './advisingCycle.service';
import { EligibleCourse } from '../retakeGate/retakePreference.service';
import { PackPlanResult } from '../prediction/planPacker';
import { expectedPct } from '../prediction/expectedPct';
import { cohortProjectedPct } from '../prediction/cohortTrend';
import { studentTrendPct } from '../prediction/studentTrend';
import { chainUnlockValue } from '../prediction/chainUnlockValue';
import { passRateFromOfferings, tierFromOfferings } from '../prediction/offeringStats';
import { CATALOG } from '../../db/seed/seedCatalog';
import { OFFERINGS_BY_COURSE } from '../../db/seed/seedCourseOfferings';
import * as db from '../../db/memory/inMemoryDb';
import { recommendDepartments, rankFacultiesByFit, DEPARTMENTS, OTHER_FACULTY_DEPARTMENTS } from '../fitEngine/deptFitEngine';
import { simulateUnderDepartment as simulateUnderDepartmentReal } from '../fitEngine/simulateUnderDepartment';

/** §3.1(a)'s cohort signal now reads real (if synthetic) 3-year offering
 *  history per course (seedCourseOfferings.ts) instead of always falling
 *  back to one flat neutral number — see that file's header for why this
 *  used to be `cohortProjectedPct([])` unconditionally, and why that made
 *  every course predict roughly the same C+/C band regardless of the
 *  student's real ability or the course's real difficulty. Difficulty tier
 *  and pass-rate/confidence are now likewise derived from that same history
 *  (offeringStats.ts) instead of the old hardcoded 'moderate' / 85. */
function scoreEligibleCourse(student: StudentWithCgpa, c: EligibleCourse, retakeGateYes: boolean): ScoredCandidate {
  const history = Object.values(db.getTranscript(student.id));
  const courseByCode = Object.fromEntries(CATALOG.map(course => [course.code, { category: course.category }]));

  const offerings = OFFERINGS_BY_COURSE[c.course.code] ?? [];
  const cohort = cohortProjectedPct(offerings);
  const studentTrend = studentTrendPct({ category: c.course.category }, history, courseByCode);
  const pct = expectedPct({
    cohortProjectedPct: cohort,
    studentTrendPct: studentTrend,
    cohortMeanFallback: 72, // only reached if a course somehow has < 3 seeded offerings
    tier: tierFromOfferings(offerings),
  });
  const band = pct >= 95 ? 'A+' : pct >= 90 ? 'A' : pct >= 85 ? 'B+' : pct >= 80 ? 'B' : pct >= 75 ? 'C+' : pct >= 70 ? 'C' : pct >= 65 ? 'D+' : pct >= 60 ? 'D' : 'F';
  const expectedPoints = pct >= 95 ? 4.0 : pct >= 90 ? 3.7 : pct >= 85 ? 3.3 : pct >= 80 ? 3.0 : pct >= 75 ? 2.7 : pct >= 70 ? 2.3 : pct >= 65 ? 2.0 : pct >= 60 ? 1.7 : 1.0;

  const chainValue = chainUnlockValue(c.course.code, CATALOG);
  const deltaPts = c.isRetake && c.oldPoints !== null ? expectedPoints - c.oldPoints : null;

  return {
    courseCode: c.course.code,
    coreq: c.course.coreq,
    oldPoints: c.oldPoints,
    expectedPct: pct,
    expectedLetter: band,
    expectedPoints,
    credits: c.course.credits,
    isRetake: c.isRetake,
    deltaPts,
    passRate: passRateFromOfferings(offerings),
    chainUnlockValue: chainValue,
    retakeGateYes,
  };
}

/** Simulates the §3.4 projection as if the student's course pool were drawn
 *  from `deptId` instead of their real department. This now calls the real
 *  `simulateUnderDepartment` (modules/fitEngine/simulateUnderDepartment.ts),
 *  which re-runs actual §2.2 computeCGPA arithmetic and the same §3.4 OLS
 *  trend routine — see that file's header for exactly what's real math vs.
 *  still approximated (no full per-department course catalog is seeded
 *  beyond ECE, only gateway-course signal). This replaces the old
 *  fitScore-linear-fudge heuristic that used to live here. */
function simulateUnderDepartment(student: StudentWithCgpa, deptId: string): SimulateUnderDepartmentResult {
  const transcript = db.getTranscript(student.id);
  const dept = [...DEPARTMENTS, ...OTHER_FACULTY_DEPARTMENTS].find(d => d.id === deptId);
  if (!dept) return { projectedCGPA: student.cgpa, trend: { slope: null, reading: 'insufficient_history' } };

  const courseByCode = Object.fromEntries(CATALOG.map(c => [c.code, { credits: c.credits }]));
  const snapshots = db.getStudent(student.id)?.cgpaSnapshots ?? [];
  const nextOrdinal = Math.max(0, ...snapshots.map(s => s.semesterOrdinal)) + 1;

  return simulateUnderDepartmentReal({
    transcript,
    courseByCode,
    cgpaSnapshots: snapshots,
    dept: { id: dept.id, gatewayCourseCodes: dept.gatewayCourseCodes },
    nextSemesterOrdinal: nextOrdinal,
  });
}

export function buildRepositoryBackedPorts(): AdvisingCyclePorts {
  return {
    getRetakeGateAnswer: (studentId: string) => db.getRetakePreference(studentId), // §5 — POST /students/:id/retake-preference
    getEligibleCourses: (studentId: string) => db.getEligibleCourses(studentId),
    scoreEligibleCourse: (student, course, retakeGateYes) => scoreEligibleCourse(student, course, retakeGateYes),
    isPostLowFirstSemester: () => false, // no first-semester tracking seeded in this demo yet
    projectPlanCGPA: (student: StudentWithCgpa, plan: PackPlanResult) => {
      const transcript = db.getTranscript(student.id);
      const members = [...plan.mandatoryBundles, ...plan.optimizedBundles].flatMap(b => b.members as ScoredCandidate[]);
      const attempts = Object.values(transcript);
      const courseByCode = Object.fromEntries(CATALOG.map(c => [c.code, { credits: c.credits }]));
      let totalPts = attempts.reduce((s, r) => s + r.points * (courseByCode[r.courseCode]?.credits ?? 0), 0);
      let totalCr = attempts.reduce((s, r) => s + (courseByCode[r.courseCode]?.credits ?? 0), 0);
      for (const m of members) {
        totalPts += m.expectedPoints * m.credits;
        totalCr += m.credits;
      }
      return totalCr > 0 ? Math.round((totalPts / totalCr) * 100) / 100 : student.cgpa;
    },
    getCgpaSnapshots: (studentId: string): CgpaSnapshot[] => db.getStudent(studentId)?.cgpaSnapshots ?? [],
    recommendDepartments: (student: StudentWithCgpa): DeptFitResult[] => {
      const transcript = db.getTranscript(student.id);
      const answers = db.getStudent(student.id)?.quizAnswers ?? {};
      return recommendDepartments(student.facultyId, transcript, answers);
    },
    simulateUnderDepartment: (student: StudentWithCgpa, deptId: string) => simulateUnderDepartment(student, deptId),
    rankFacultiesByFit: (student: StudentWithCgpa): DeptFitResult[] => {
      const transcript = db.getTranscript(student.id);
      const answers = db.getStudent(student.id)?.quizAnswers ?? {};
      return rankFacultiesByFit(student.facultyId, transcript, answers);
    },
    alreadyTransferredInternallyOnce: (studentId: string) => db.hasInternalTransfer(studentId), // §7/§4.2.1, real TransferRecord list
    getProbationCounter: (studentId: string) =>
      db.getStudent(studentId)?.probationCounter ?? { studentId, count: 0, armed: true },
  };
}
