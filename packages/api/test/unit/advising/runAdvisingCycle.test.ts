// Spec §4.2 — end-to-end test of the async orchestrator using mock
// AdvisingCyclePorts (PROGRESS.md item 1: "write a test for
// `runAdvisingCycle` itself using mock ports, assert it produces the right
// `AdvisingActionResult` for at least Example A end-to-end").
//
// Two scenarios are covered:
//   - §11 Example A: normal good-standing student -> SHOW_PLAN, and the
//     fit-engine ports (recommendDepartments/simulateUnderDepartment/
//     rankFacultiesByFit/alreadyTransferredInternallyOnce) must NOT be
//     called at all (the short-circuit optimization documented in
//     advisingCycle.service.ts's file header and PROGRESS.md).
//   - §11 Example H-shaped case: flat/declining trend with CGPA >= 2.00 ->
//     RECOMMEND_INTERNAL_TRANSFER, and this time the fit-engine ports DO
//     get exercised end-to-end through the real async plumbing.
import { describe, it, expect, vi } from 'vitest';
import { Course } from '@advisor/shared';
import {
  runAdvisingCycle,
  AdvisingCyclePorts,
  ScoredCandidate,
  StudentWithCgpa,
  DeptFitResult,
} from '../../../src/modules/advising/advisingCycle.service';
import { EligibleCourse } from '../../../src/modules/retakeGate/retakePreference.service';

function course(code: string, credits = 3): Course {
  return {
    code,
    name: code,
    credits,
    level: 3,
    semesterOrdinal: 5,
    category: 'program',
    isUR: false,
    isBasicScience: false,
    departmentId: 'ECE',
    prereq: [],
    coreq: [],
    transferable: true,
  };
}

function scored(courseCode: string, expectedPoints = 3.6): ScoredCandidate {
  return {
    courseCode,
    coreq: [],
    oldPoints: null,
    expectedPct: 88,
    expectedLetter: 'A-',
    expectedPoints,
    credits: 3,
    isRetake: false,
    deltaPts: null,
    passRate: 92,
    chainUnlockValue: 1,
    retakeGateYes: false,
  };
}

function baseStudent(cgpa: number): StudentWithCgpa {
  return {
    id: 'ahmed-1',
    name: 'Ahmed',
    facultyId: 'ENG',
    departmentId: 'ECE',
    status: 'active',
    activeBaseSnapshotId: null,
    cumulativeEarnedCredits: 72,
    level: 3,
    advisorId: 'advisor-nabil',
    cgpa,
  };
}

describe('runAdvisingCycle (§4.2 orchestrator, full async wiring)', () => {
  it('Example A — good-standing student, improving plan+trend => SHOW_PLAN, fit-engine ports never called', async () => {
    const student = baseStudent(3.1);
    const eligible: EligibleCourse[] = [{ course: course('ECE411'), isRetake: false, oldLetter: null, oldPoints: null }];

    const recommendDepartments = vi.fn();
    const simulateUnderDepartment = vi.fn();
    const rankFacultiesByFit = vi.fn();
    const alreadyTransferredInternallyOnce = vi.fn();

    const ports: AdvisingCyclePorts = {
      getRetakeGateAnswer: () => true,
      getEligibleCourses: () => eligible,
      scoreEligibleCourse: (_s, c) => scored(c.course.code),
      isPostLowFirstSemester: () => false,
      projectPlanCGPA: () => 3.24, // > 3.10 + 0.01
      getCgpaSnapshots: () => [
        { semesterId: 's2', semesterOrdinal: 2, semesterGpa: 2.9, cgpa: 2.9, cumulativeCredits: 30, isBaseSnapshot: false },
        { semesterId: 's3', semesterOrdinal: 3, semesterGpa: 3.0, cgpa: 3.0, cumulativeCredits: 48, isBaseSnapshot: false },
        { semesterId: 's4', semesterOrdinal: 4, semesterGpa: 3.2, cgpa: 3.1, cumulativeCredits: 72, isBaseSnapshot: false },
      ],
      recommendDepartments,
      simulateUnderDepartment,
      rankFacultiesByFit,
      alreadyTransferredInternallyOnce,
      getProbationCounter: () => ({ studentId: student.id, count: 0, armed: true }),
    };

    const result = await runAdvisingCycle(student, ports);

    expect(result.action).toBe('SHOW_PLAN');
    expect(result.explain).toBe('plan_projected_to_raise_cgpa');
    expect(result.projectedCGPA).toBe(3.24);
    expect(result.plan.length).toBe(1);
    expect(result.plan[0].courseCode).toBe('ECE411');
    expect(result.plan[0].mandatory).toBe(false);

    // The whole point of the tier-1 short-circuit (documented in the file
    // header / PROGRESS.md) is that these expensive fit-engine ports are
    // never invoked once tier 1 already resolves the action.
    expect(recommendDepartments).not.toHaveBeenCalled();
    expect(simulateUnderDepartment).not.toHaveBeenCalled();
    expect(rankFacultiesByFit).not.toHaveBeenCalled();
    expect(alreadyTransferredInternallyOnce).not.toHaveBeenCalled();
  });

  it('§11 Example H-shaped — flat/declining trend, CGPA >= 2.00, better-fit dept exists => RECOMMEND_INTERNAL_TRANSFER', async () => {
    const student = baseStudent(2.15);
    const eligible: EligibleCourse[] = [{ course: course('ECE320'), isRetake: false, oldLetter: null, oldPoints: null }];

    const cseDept: DeptFitResult = { id: 'CSE', name: 'Computer Science', total: 8.2, quizScore: 3, gwScore: 3.5, alumScore: 1.7 };
    const eceDept: DeptFitResult = { id: 'ECE', name: 'Electronics', total: 4.1, quizScore: 1, gwScore: 2, alumScore: 1.1 };

    const ports: AdvisingCyclePorts = {
      getRetakeGateAnswer: () => false,
      getEligibleCourses: () => eligible,
      scoreEligibleCourse: (_s, c) => scored(c.course.code),
      isPostLowFirstSemester: () => false,
      projectPlanCGPA: () => 2.16, // plan barely nudges CGPA up
      getCgpaSnapshots: () => [
        { semesterId: 's1', semesterOrdinal: 1, semesterGpa: 2.2, cgpa: 2.2, cumulativeCredits: 18, isBaseSnapshot: false },
        { semesterId: 's2', semesterOrdinal: 2, semesterGpa: 2.1, cgpa: 2.14, cumulativeCredits: 36, isBaseSnapshot: false },
        { semesterId: 's3', semesterOrdinal: 3, semesterGpa: 2.1, cgpa: 2.15, cumulativeCredits: 54, isBaseSnapshot: false },
      ], // flat/slightly-declining series -> trend.reading should not be 'improving'
      recommendDepartments: () => [eceDept, cseDept],
      simulateUnderDepartment: (_s, deptId) =>
        deptId === 'CSE'
          ? { projectedCGPA: 2.6, trend: { slope: 0.05, reading: 'improving' } }
          : { projectedCGPA: 2.1, trend: { slope: -0.02, reading: 'declining' } },
      rankFacultiesByFit: () => [],
      alreadyTransferredInternallyOnce: () => false,
      getProbationCounter: () => ({ studentId: student.id, count: 0, armed: true }),
    };

    const result = await runAdvisingCycle(student, ports);

    expect(result.action).toBe('RECOMMEND_INTERNAL_TRANSFER');
    expect(result.suggestedDepartmentId).toBe('CSE');
    expect(result.explain).toBe('flat_or_declining_trend_but_better_fit_department_available_in_faculty');
    // Still shows the in-major plan as the fallback/status-quo option (§4.2).
    expect(result.plan.length).toBe(1);
  });

  it('cold-start student (cgpa=0, no cgpaSnapshots yet) gets the normal 20-credit cap and "fast" mode, not the probation 14-credit cap/mode — real bug the cold-start trial persona surfaced', async () => {
    const student = baseStudent(0); // a brand-new student's cgpa really is 0 — no grade exists yet, not poor performance
    // Enough eligible credit-mass that a wrongly-applied 14-credit
    // probation cap would visibly truncate the plan below what a genuine
    // 20-credit cap allows — the actual observable signal, not an
    // internal implementation detail.
    const eligible: EligibleCourse[] = [
      { course: course('MTH111', 3), isRetake: false, oldLetter: null, oldPoints: null },
      { course: course('PHY111', 3), isRetake: false, oldLetter: null, oldPoints: null },
      { course: course('CHM111', 3), isRetake: false, oldLetter: null, oldPoints: null },
      { course: course('MCE111', 3), isRetake: false, oldLetter: null, oldPoints: null },
      { course: course('IME111', 3), isRetake: false, oldLetter: null, oldPoints: null },
      { course: course('LRA101', 2), isRetake: false, oldLetter: null, oldPoints: null },
    ]; // 17 credits total — fits under 20, would be truncated under 14

    const ports: AdvisingCyclePorts = {
      getRetakeGateAnswer: () => true,
      getEligibleCourses: () => eligible,
      scoreEligibleCourse: (_s, c) => ({ ...scored(c.course.code), credits: c.course.credits }),
      isPostLowFirstSemester: () => false,
      projectPlanCGPA: () => 3.0, // a real first plan obviously "raises" a from-zero cgpa -> tier-1 short-circuits, same as Example A
      getCgpaSnapshots: () => [], // the real "no semester has ever closed" signal
      recommendDepartments: vi.fn(),
      simulateUnderDepartment: vi.fn(),
      rankFacultiesByFit: vi.fn(),
      alreadyTransferredInternallyOnce: vi.fn(),
      getProbationCounter: () => ({ studentId: student.id, count: 0, armed: true }),
    };

    const result = await runAdvisingCycle(student, ports);
    const totalCredits = result.plan.reduce((sum, p) => sum + (eligible.find(e => e.course.code === p.courseCode)?.course.credits ?? 0), 0);

    expect(totalCredits).toBeGreaterThan(14); // proves the 20-credit cap applied, not the 14-credit probation one
    expect(result.action).toBe('SHOW_PLAN'); // not routed through the probation-repair branch at all
  });
});
