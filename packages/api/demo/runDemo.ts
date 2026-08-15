
// Runnable demo — NOT part of the test suite. Shows the §4.2 orchestrator's
// real output for a couple of sample students, using in-memory fixtures
// (no database needed yet — see PROGRESS.md item 4 for real DB wiring).
//
// Run with:
//   cd packages/api
//   npx tsx demo/runDemo.ts
import {
  runAdvisingCycle,
  AdvisingCyclePorts,
  StudentWithCgpa,
  ScoredCandidate,
} from '../src/modules/advising/advisingCycle.service';
import { EligibleCourse } from '../src/modules/retakeGate/retakePreference.service';
import { recommendDepartments, rankFacultiesByFit, DEPARTMENTS } from '../src/modules/fitEngine/deptFitEngine';
import { CATALOG } from '../src/db/seed/seedCatalog';
import { Course } from '@advisor/shared';

function findCourse(code: string): Course {
  const c = CATALOG.find(c => c.code === code);
  if (!c) throw new Error(`demo fixture references unknown course ${code}`);
  return c;
}

function scoreFixture(courseCode: string, expectedPoints: number, chainUnlockValue = 1): ScoredCandidate {
  const course = findCourse(courseCode);
  return {
    courseCode,
    coreq: course.coreq,
    oldPoints: null,
    expectedPct: Math.round(expectedPoints * 22.5 + 10),
    expectedLetter: expectedPoints >= 3.7 ? 'A-' : expectedPoints >= 3.0 ? 'B' : expectedPoints >= 2.0 ? 'C' : 'D',
    expectedPoints,
    credits: course.credits,
    isRetake: false,
    deltaPts: null,
    passRate: 88,
    chainUnlockValue,
    retakeGateYes: false,
  };
}

async function runScenario(label: string, student: StudentWithCgpa, ports: AdvisingCyclePorts) {
  console.log(`\n=== ${label} ===`);
  console.log(`Student: ${student.name} | CGPA ${student.cgpa} | Level ${student.level} | Faculty ${student.facultyId}`);
  const result = await runAdvisingCycle(student, ports);
  console.log(`Action: ${result.action}`);
  console.log(`Explain: ${result.explain}`);
  console.log(`Projected CGPA: ${result.projectedCGPA} | Trend slope: ${result.trendSlope}`);
  if (result.suggestedDepartmentId) console.log(`Suggested department: ${result.suggestedDepartmentId}`);
  if (result.suggestedFaculties) console.log(`Suggested faculties: ${result.suggestedFaculties.map(f => `${f.name} (${f.total})`).join(', ')}`);
  console.log('Plan:');
  for (const c of result.plan) {
    console.log(`  - ${c.courseCode}${c.mandatory ? ' [MANDATORY RETAKE]' : ''} — expected ${c.expectedLetter} (${c.expectedPct}%), score ${c.score}`);
  }
}

async function main() {
  // --- Scenario 1: §11 Example A — Ahmed, good standing, plan improves CGPA ---
  const ahmed: StudentWithCgpa = {
    id: 'ahmed-1', name: 'Ahmed', facultyId: 'ENG', departmentId: 'ECE',
    status: 'active', activeBaseSnapshotId: null, cumulativeEarnedCredits: 72, level: 3, cgpa: 3.10,
  };
  const ahmedEligible: EligibleCourse[] = [
    { course: findCourse('ECE411'), isRetake: false, oldLetter: null, oldPoints: null },
    { course: findCourse('ECE413'), isRetake: false, oldLetter: null, oldPoints: null },
  ];
  const ahmedPorts: AdvisingCyclePorts = {
    getRetakeGateAnswer: () => true,
    getEligibleCourses: () => ahmedEligible,
    scoreEligibleCourse: (_s, c) => scoreFixture(c.course.code, 3.8, 2),
    isPostLowFirstSemester: () => false,
    projectPlanCGPA: () => 3.24,
    getCgpaSnapshots: () => [
      { semesterId: 's2', semesterOrdinal: 2, semesterGpa: 2.9, cgpa: 2.9, cumulativeCredits: 30, isBaseSnapshot: false },
      { semesterId: 's3', semesterOrdinal: 3, semesterGpa: 3.0, cgpa: 3.0, cumulativeCredits: 48, isBaseSnapshot: false },
      { semesterId: 's4', semesterOrdinal: 4, semesterGpa: 3.2, cgpa: 3.1, cumulativeCredits: 72, isBaseSnapshot: false },
    ],
    recommendDepartments: () => [],
    simulateUnderDepartment: () => ({ projectedCGPA: 0, trend: { slope: null, reading: 'insufficient_history' } }),
    rankFacultiesByFit: () => [],
    alreadyTransferredInternallyOnce: () => false,
    getProbationCounter: () => ({ studentId: ahmed.id, count: 0, armed: true }),
  };
  await runScenario('Scenario 1 — Ahmed (§11 Example A: good standing)', ahmed, ahmedPorts);

  // --- Scenario 2 — Sara, flat/declining trend, strong-programming quiz signal
  // (§11 Example H-shaped), now wired through the REAL §6 fit engine instead
  // of hand-built fixtures. ---
  const sara: StudentWithCgpa = {
    id: 'sara-1', name: 'Sara', facultyId: 'ENG', departmentId: 'ECE',
    status: 'active', activeBaseSnapshotId: null, cumulativeEarnedCredits: 40, level: 2, cgpa: 2.15,
  };
  const saraTranscript = {
    CSE211: { courseCode: 'CSE211', attemptNumber: 1, pct: 92, letter: 'A', points: 4.0, isRetake: false, countsInCgpa: true, semesterOrdinal: 3 },
    CSE213: { courseCode: 'CSE213', attemptNumber: 1, pct: 88, letter: 'A-', points: 3.7, isRetake: false, countsInCgpa: true, semesterOrdinal: 4 },
    ECE314: { courseCode: 'ECE314', attemptNumber: 1, pct: 58, letter: 'D+', points: 1.3, isRetake: false, countsInCgpa: true, semesterOrdinal: 5 },
    ECE317: { courseCode: 'ECE317', attemptNumber: 1, pct: 55, letter: 'D', points: 1.0, isRetake: false, countsInCgpa: true, semesterOrdinal: 5 },
  };
  const saraQuizAnswers = {
    q1_problem_style: 'q1_data',
    q2_favorite_subject: 'q2_programming',
    q3_project_role: 'q3_coder',
    q4_ideal_job: 'q4_swe',
  };
  const saraEligible: EligibleCourse[] = [{ course: findCourse('ECE321'), isRetake: false, oldLetter: null, oldPoints: null }];
  const saraPorts: AdvisingCyclePorts = {
    getRetakeGateAnswer: () => false,
    getEligibleCourses: () => saraEligible,
    scoreEligibleCourse: (_s, c) => scoreFixture(c.course.code, 3.0, 1),
    isPostLowFirstSemester: () => false,
    projectPlanCGPA: () => 2.16, // barely moves — not enough on its own
    getCgpaSnapshots: () => [
      { semesterId: 's1', semesterOrdinal: 1, semesterGpa: 2.20, cgpa: 2.20, cumulativeCredits: 16, isBaseSnapshot: false },
      { semesterId: 's2', semesterOrdinal: 2, semesterGpa: 2.10, cgpa: 2.14, cumulativeCredits: 28, isBaseSnapshot: false },
      { semesterId: 's3', semesterOrdinal: 3, semesterGpa: 2.10, cgpa: 2.15, cumulativeCredits: 40, isBaseSnapshot: false },
    ],
    // *** This is the real §6 engine from deptFitEngine.ts, not a fixture. ***
    recommendDepartments: () => recommendDepartments('ENG', saraTranscript, saraQuizAnswers),
    simulateUnderDepartment: (_s, deptId) =>
      deptId === 'CSE'
        ? { projectedCGPA: 2.60, trend: { slope: 0.05, reading: 'improving' } }
        : { projectedCGPA: 2.10, trend: { slope: -0.02, reading: 'declining' } },
    rankFacultiesByFit: () => rankFacultiesByFit('ENG', saraTranscript, saraQuizAnswers),
    alreadyTransferredInternallyOnce: () => false,
    getProbationCounter: () => ({ studentId: sara.id, count: 0, armed: true }),
  };
  await runScenario('Scenario 2 — Sara (§11 Example H-shaped: flat trend, better-fit dept exists)', sara, saraPorts);
  console.log('\nReal §6 fit-engine department ranking for Sara (from deptFitEngine.ts):');
  for (const d of recommendDepartments('ENG', saraTranscript, saraQuizAnswers)) {
    console.log(`  ${d.id.padEnd(4)} total=${d.total}  quiz=${d.quizScore.toFixed(2)}  gateway=${d.gwScore.toFixed(2)}  alumni=${d.alumScore.toFixed(2)}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
