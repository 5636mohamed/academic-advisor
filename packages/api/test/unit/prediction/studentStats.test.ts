import { describe, it, expect } from 'vitest';
import { studentMeanAndMode } from '../../../src/modules/prediction/studentStats';
import { EnrollmentRecord } from '@advisor/shared';

const targetCourse = { category: 'program' as const, isUR: false };
const courseByCode: Record<string, { category: 'program' | 'ur_core' }> = {
  ECE211: { category: 'program' }, ECE212: { category: 'program' }, ECE213: { category: 'program' }, ECE214: { category: 'program' }, ECE215: { category: 'program' },
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

// Follow-up (live user request): predictions should also reflect whether
// THIS student's own comparable-category performance has been trending up
// or down over their real semester history, not just a flat average — the
// personal counterpart to cohortTrend.ts's subject-wide trend classification.
describe('studentMeanAndMode — personal trend', () => {
  it('classifies a clearly climbing comparable-category record as rising, with a positive trend adjustment', () => {
    const history = [attempt('ECE211', 60, 'D', 1), attempt('ECE212', 75, 'C', 2), attempt('ECE213', 90, 'A', 3)];
    const result = studentMeanAndMode(targetCourse, history, courseByCode);
    expect(result?.trend).toBe('rising');
    expect(result?.trendAdjustment).toBeGreaterThan(0);
  });

  it('classifies a clearly sliding comparable-category record as declining, with a negative trend adjustment', () => {
    const history = [attempt('ECE211', 90, 'A', 1), attempt('ECE212', 75, 'C', 2), attempt('ECE213', 60, 'D', 3)];
    const result = studentMeanAndMode(targetCourse, history, courseByCode);
    expect(result?.trend).toBe('declining');
    expect(result?.trendAdjustment).toBeLessThan(0);
  });

  it('classifies a flat comparable-category record as consistent, with no trend adjustment', () => {
    const history = [attempt('ECE211', 80, 'B', 1), attempt('ECE212', 81, 'B', 2), attempt('ECE213', 79, 'B', 3), attempt('ECE214', 80, 'B', 4)];
    const result = studentMeanAndMode(targetCourse, history, courseByCode);
    expect(result?.trend).toBe('consistent');
    expect(result?.trendAdjustment).toBe(0);
  });

  it('classifies a flat-average but high-variance (bouncing between strong and weak) record as inconsistent, with a negative trend adjustment', () => {
    const history = [
      attempt('ECE211', 70, 'C', 1), attempt('ECE212', 90, 'A', 2), attempt('ECE213', 55, 'F', 3),
      attempt('ECE214', 88, 'A', 4), attempt('ECE215', 72, 'C', 5),
    ];
    const result = studentMeanAndMode(targetCourse, history, courseByCode);
    expect(result?.trend).toBe('inconsistent');
    expect(result?.trendAdjustment).toBeLessThan(0);
  });

  it('with fewer than 3 comparable attempts, defaults to consistent (not enough history for a real trend read) even though the mean/mode still compute', () => {
    const history = [attempt('ECE211', 60, 'D', 1), attempt('ECE212', 95, 'A+', 2)];
    const result = studentMeanAndMode(targetCourse, history, courseByCode);
    expect(result?.trend).toBe('consistent');
    expect(result?.trendAdjustment).toBe(0);
    expect(result?.mean).toBeCloseTo(77.5, 1); // mean/mode still fall back to using the sparse history
  });

  it('orders by the semester the grade was actually earned, not by array/insertion order', () => {
    // Same rising 60/75/90 series as the first test, deliberately shuffled
    // in the input array — the trend must still read as rising because
    // it's sorted by semesterOrdinal internally, not iterated as given.
    const shuffled = [attempt('ECE213', 90, 'A', 3), attempt('ECE211', 60, 'D', 1), attempt('ECE212', 75, 'C', 2)];
    const result = studentMeanAndMode(targetCourse, shuffled, courseByCode);
    expect(result?.trend).toBe('rising');
  });

  it('many comparable courses landing in the SAME semester (a lock-step transcript with several courses per term) is not mistaken for a multi-point trend', () => {
    // All 5 records share semesterOrdinal 3 — genuinely only one real
    // semester of comparable history, even though there are 5 raw records
    // (well past the >=3 floor for a naive per-record count). Must read as
    // 'consistent' (not enough DISTINCT semesters), not as some spurious
    // slope across which course happened to sort first.
    const history = [
      attempt('ECE211', 60, 'D', 3), attempt('ECE212', 90, 'A', 3), attempt('ECE213', 55, 'F', 3),
      attempt('ECE214', 88, 'A', 3), attempt('ECE215', 72, 'C', 3),
    ];
    const result = studentMeanAndMode(targetCourse, history, courseByCode);
    expect(result?.trend).toBe('consistent');
    expect(result?.trendAdjustment).toBe(0);
  });

  it("a rising trend and a declining trend of the same magnitude produce opposite, equal-sized adjustments", () => {
    const rising = studentMeanAndMode(targetCourse, [attempt('ECE211', 60, 'D', 1), attempt('ECE212', 75, 'C', 2), attempt('ECE213', 90, 'A', 3)], courseByCode);
    const declining = studentMeanAndMode(targetCourse, [attempt('ECE211', 90, 'A', 1), attempt('ECE212', 75, 'C', 2), attempt('ECE213', 60, 'D', 3)], courseByCode);
    expect(rising?.trendAdjustment).toBe(-declining!.trendAdjustment);
  });
});
