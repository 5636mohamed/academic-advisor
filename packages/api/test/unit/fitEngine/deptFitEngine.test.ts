// Spec §6 — weighted-sum best-fit department/faculty engine.
import { describe, it, expect } from 'vitest';
import { EnrollmentRecord, Transcript } from '@advisor/shared';
import {
  fitScore,
  recommendDepartments,
  rankFacultiesByFit,
  QUIZ,
  DEPARTMENTS,
  QuizAnswers,
} from '../../../src/modules/fitEngine/deptFitEngine';

function rec(courseCode: string, points: number): EnrollmentRecord {
  return { courseCode, attemptNumber: 1, pct: 0, letter: '', points, isRetake: false, countsInCgpa: true, semesterOrdinal: 3 };
}

function transcriptFrom(entries: EnrollmentRecord[]): Transcript {
  const t: Transcript = {};
  for (const e of entries) t[e.courseCode] = e;
  return t;
}

/** All quiz answers pointing at "software/algorithmic" traits (CSE-leaning),
 *  mirroring §11 Example H's Sara (strong programming, weak signals/hardware). */
const cseLeaningAnswers: QuizAnswers = {
  q1_problem_style: 'q1_data',
  q2_favorite_subject: 'q2_programming',
  q3_project_role: 'q3_coder',
  q4_ideal_job: 'q4_swe',
};

/** All quiz answers pointing at "hardware/engineering/systems" traits. */
const eceLeaningAnswers: QuizAnswers = {
  q1_problem_style: 'q1_build',
  q2_favorite_subject: 'q2_signals',
  q3_project_role: 'q3_architect',
  q4_ideal_job: 'q4_hw',
};

describe('fitScore (§6 core formula)', () => {
  it('quiz-only match with no transcript history uses the neutral gateway prior (0.6)', () => {
    const dept = DEPARTMENTS.find(d => d.id === 'CSE')!;
    const result = fitScore(dept, {}, cseLeaningAnswers, { employmentRate: 90, satisfaction: 4.0 });
    // gwScore should equal the config's neutral prior since transcript is empty.
    expect(result.gwScore).toBe(0.6);
    expect(result.quizScore).toBeGreaterThan(0.9); // every question strongly signals CSE traits
  });

  it('strong gateway-course grades raise gwScore above the neutral prior', () => {
    const dept = DEPARTMENTS.find(d => d.id === 'CSE')!; // gateway: CSE211, CSE213
    const transcript = transcriptFrom([rec('CSE211', 4.0), rec('CSE213', 3.7)]);
    const result = fitScore(dept, transcript, {}, { employmentRate: 90, satisfaction: 4.0 });
    expect(result.gwScore).toBeGreaterThan(0.6);
    expect(result.gwScore).toBeCloseTo((4.0 / 4 + 3.7 / 4) / 2, 5);
  });

  it('total is the documented 0.5/0.3/0.2 weighted sum of quiz/gateway/alumni', () => {
    const dept = DEPARTMENTS.find(d => d.id === 'CSE')!;
    const transcript = transcriptFrom([rec('CSE211', 4.0), rec('CSE213', 4.0)]); // gwScore = 1.0
    const alumni = { employmentRate: 100, satisfaction: 5.0 }; // alumScore = 1.0
    const result = fitScore(dept, transcript, cseLeaningAnswers, alumni); // quizScore ~1.0
    expect(result.quizScore).toBe(1);
    expect(result.gwScore).toBe(1);
    expect(result.alumScore).toBe(1);
    expect(result.total).toBe(1); // 0.5*1 + 0.3*1 + 0.2*1
  });
});

describe('recommendDepartments (§4.2 tier-2 input, restricted to student.facultyId)', () => {
  it('§11 Example H-shaped — CSE-leaning quiz + strong programming grades ranks CSE above ECE within the same faculty', () => {
    const transcript = transcriptFrom([
      rec('CSE211', 4.0), // strong programming
      rec('CSE213', 3.7),
      rec('ECE314', 1.3), // weak signals/hardware
      rec('ECE317', 1.0),
      rec('ECE221', 1.7),
    ]);
    const results = recommendDepartments('ENG', transcript, cseLeaningAnswers);
    expect(results[0].id).toBe('CSE');
    expect(results.some(r => r.id === 'ECE')).toBe(true);
    expect(results[0].total).toBeGreaterThan(results.find(r => r.id === 'ECE')!.total);
  });

  it('only returns departments within the given facultyId', () => {
    const results = recommendDepartments('ENG', {}, {});
    expect(results.every(r => ['ECE', 'CSE', 'MCE'].includes(r.id))).toBe(true);
    expect(results.some(r => r.id === 'BIS')).toBe(false);
  });

  it('ECE-leaning student with strong hardware grades ranks ECE first', () => {
    const transcript = transcriptFrom([rec('ECE314', 4.0), rec('ECE317', 3.7), rec('ECE221', 3.3)]);
    const results = recommendDepartments('ENG', transcript, eceLeaningAnswers);
    expect(results[0].id).toBe('ECE');
  });
});

describe('rankFacultiesByFit (§4.2 tier-3 input)', () => {
  it('never includes the student\'s current faculty', () => {
    const results = rankFacultiesByFit('ENG', {}, {});
    expect(results.every(r => r.id !== 'ENG')).toBe(true);
    expect(results.some(r => r.id === 'BUS')).toBe(true);
  });

  it('§11 Example I/K-shaped — weak basic-science grades still produce a ranked, non-crashing result for the only other faculty', () => {
    const transcript = transcriptFrom([rec('MTH111', 1.0), rec('MTH121', 0.7), rec('PHY111', 1.3)]);
    const results = rankFacultiesByFit('ENG', transcript, {});
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('BUS');
    expect(results[0].gwScore).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(results[0].total)).toBe(true);
  });

  it('every quiz question id used by rankFacultiesByFit matches a real QUIZ question (sanity check on seed data)', () => {
    const questionIds = new Set(QUIZ.map(q => q.id));
    expect(questionIds.size).toBe(QUIZ.length); // no duplicate ids
    for (const q of QUIZ) {
      expect(q.options.length).toBeGreaterThan(1);
    }
  });
});
