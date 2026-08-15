// Covers the PROGRESS.md item-1 follow-up: simulateUnderDepartment now
// re-runs real computeCGPA/OLS math instead of a linear-fudge heuristic.
import { describe, it, expect } from 'vitest';
import { simulateUnderDepartment } from '../../../src/modules/fitEngine/simulateUnderDepartment';

const courseByCode = { CSE211: { credits: 2 }, CSE213: { credits: 3 }, ECE211: { credits: 2 } };

describe('simulateUnderDepartment', () => {
  it('a strong gateway performer projects a CGPA pulled toward their gateway average', () => {
    const transcript = {
      CSE211: { courseCode: 'CSE211', attemptNumber: 1, pct: 92, letter: 'A', points: 4.0, isRetake: false, countsInCgpa: true, semesterOrdinal: 3 },
      CSE213: { courseCode: 'CSE213', attemptNumber: 1, pct: 88, letter: 'A', points: 3.7, isRetake: false, countsInCgpa: true, semesterOrdinal: 4 },
      ECE211: { courseCode: 'ECE211', attemptNumber: 1, pct: 65, letter: 'D+', points: 2.0, isRetake: false, countsInCgpa: true, semesterOrdinal: 3 },
    };
    const result = simulateUnderDepartment({
      transcript,
      courseByCode,
      cgpaSnapshots: [
        { semesterId: 's1', semesterOrdinal: 1, semesterGpa: 2.2, cgpa: 2.2, cumulativeCredits: 16, isBaseSnapshot: false },
        { semesterId: 's2', semesterOrdinal: 2, semesterGpa: 2.1, cgpa: 2.15, cumulativeCredits: 28, isBaseSnapshot: false },
        { semesterId: 's3', semesterOrdinal: 3, semesterGpa: 2.1, cgpa: 2.15, cumulativeCredits: 40, isBaseSnapshot: false },
      ],
      dept: { id: 'CSE', gatewayCourseCodes: ['CSE211', 'CSE213'] },
      nextSemesterOrdinal: 4,
    });
    // gateway avg points = (4.0+3.7)/2 = 3.85, well above the real transcript's
    // weighted CGPA (2.15), so the projection should be pulled upward.
    expect(result.projectedCGPA).toBeGreaterThan(2.15);
    expect(result.trend.reading).not.toBe('insufficient_history');
  });

  it('falls back to overall transcript average when no gateway grades exist yet', () => {
    const transcript = {
      MTH111: { courseCode: 'MTH111', attemptNumber: 1, pct: 80, letter: 'B', points: 3.0, isRetake: false, countsInCgpa: true, semesterOrdinal: 1 },
    };
    const result = simulateUnderDepartment({
      transcript,
      courseByCode: { MTH111: { credits: 3 } },
      cgpaSnapshots: [],
      dept: { id: 'CSE', gatewayCourseCodes: ['CSE211'] }, // student has no CSE211 grade
      nextSemesterOrdinal: 2,
    });
    expect(result.projectedCGPA).toBeGreaterThan(0);
    expect(result.trend.reading).toBe('insufficient_history'); // <3 total snapshot points
  });

  it('a brand-new student with no transcript at all does not crash (neutral 2.5 fallback)', () => {
    const result = simulateUnderDepartment({
      transcript: {},
      courseByCode: {},
      cgpaSnapshots: [],
      dept: { id: 'CSE', gatewayCourseCodes: [] },
      nextSemesterOrdinal: 1,
    });
    expect(result.projectedCGPA).toBeCloseTo(2.5, 1);
  });
});
