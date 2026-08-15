// Covers spec §15.2's "how it would affect his CGPA" figure.
import { describe, it, expect } from 'vitest';
import { projectExpectedVsBestCase } from '../../../src/modules/prediction/whatIfProjection';

describe('projectExpectedVsBestCase — §15.2', () => {
  it('the best-case projection is never lower than the expected one for the same course set', () => {
    const existing = [
      { courseCode: 'MTH111', attemptNumber: 1, pct: 80, letter: 'B', points: 3.0, isRetake: false, countsInCgpa: true, semesterOrdinal: 1 },
    ];
    const courseByCode = { MTH111: { credits: 3 } };
    const result = projectExpectedVsBestCase(
      existing,
      courseByCode,
      [{ courseCode: 'ECE314', credits: 2, expectedPoints: 2.0, bestCasePoints: 4.0 }],
      2
    );
    expect(result.bestCaseProjectedCGPA).toBeGreaterThan(result.expectedProjectedCGPA);
  });

  it('matches a hand-computed weighted average', () => {
    const result = projectExpectedVsBestCase(
      [],
      {},
      [
        { courseCode: 'A', credits: 3, expectedPoints: 2.0, bestCasePoints: 3.0 },
        { courseCode: 'B', credits: 2, expectedPoints: 3.0, bestCasePoints: 4.0 },
      ],
      1
    );
    // expected: (2*3 + 3*2)/5 = 12/5 = 2.4 ; best: (3*3 + 4*2)/5 = 17/5 = 3.4
    expect(result.expectedProjectedCGPA).toBe(2.4);
    expect(result.bestCaseProjectedCGPA).toBe(3.4);
  });
});
