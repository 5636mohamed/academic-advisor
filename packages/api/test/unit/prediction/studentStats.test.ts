import { describe, it, expect } from 'vitest';
import { studentMeanAndMode } from '../../../src/modules/prediction/studentStats';
import { EnrollmentRecord } from '@advisor/shared';

const targetCourse = { category: 'program' as const, isUR: false };
const courseByCode: Record<string, { category: 'program' | 'ur_core' }> = {
  ECE211: { category: 'program' }, ECE212: { category: 'program' }, ECE213: { category: 'program' }, ECE214: { category: 'program' },
  LRA101: { category: 'ur_core' },
};

function attempt(courseCode: string, pct: number, letter: string, semesterOrdinal: number): EnrollmentRecord {
  return { courseCode, attemptNumber: 1, pct, letter, points: 0, isRetake: false, countsInCgpa: true, semesterOrdinal };
}

describe('studentMeanAndMode', () => {
  it('computes a real mean and modal letter from comparable-category history', () => {
    const history = [
      attempt('ECE211', 92, 'A', 1),
      attempt('ECE212', 90, 'A', 2),
      attempt('ECE213', 88, 'A', 3), // 3 comparable attempts, all A -> clear mode
    ];
    const result = studentMeanAndMode(targetCourse, history, courseByCode);
    expect(result?.mean).toBeCloseTo((92 + 90 + 88) / 3, 1);
    expect(result?.modeLetter).toBe('A');
  });

  it('excludes non-comparable-category (UR) history from a program-course prediction', () => {
    const history = [
      attempt('ECE211', 90, 'A', 1),
      attempt('ECE212', 88, 'A', 2),
      attempt('ECE213', 85, 'B+', 3),
      attempt('LRA101', 98, 'A+', 4), // UR — should NOT count toward a 'program' target course
    ];
    const result = studentMeanAndMode(targetCourse, history, courseByCode);
    expect(result?.mean).toBeCloseTo((90 + 88 + 85) / 3, 1); // LRA101 excluded
  });

  it('falls back to ALL history when there is not enough comparable-category history yet', () => {
    const history = [attempt('LRA101', 95, 'A+', 1)]; // only 1 record, and it's not comparable to a program course
    const result = studentMeanAndMode(targetCourse, history, courseByCode);
    expect(result?.mean).toBeCloseTo(95, 1); // falls back to using it anyway rather than returning null
  });

  it('returns null when the student has genuinely zero graded history', () => {
    expect(studentMeanAndMode(targetCourse, [], courseByCode)).toBeNull();
  });

  it('breaks a tied mode toward the higher grade point, not iteration order', () => {
    const history = [
      attempt('ECE211', 92, 'A', 1),
      attempt('ECE212', 72, 'C', 2),
      attempt('ECE213', 90, 'A', 3),
      attempt('ECE214', 70, 'C', 4), // A and C both appear twice
    ];
    const result = studentMeanAndMode(targetCourse, history, courseByCode);
    expect(result?.modeLetter).toBe('A');
  });

  it('a UR target course resolves modePct against the UR scale (different D floor from ENG)', () => {
    const urTarget = { category: 'ur_core' as const, isUR: true };
    const history = [attempt('LRA101', 52, 'D', 1), attempt('LRA101', 51, 'D', 2), attempt('LRA101', 53, 'D', 3)];
    const result = studentMeanAndMode(urTarget, history, courseByCode);
    expect(result?.modePct).toBe(50); // UR_SCALE's D band starts at 50, not ENG's 60
  });
});
