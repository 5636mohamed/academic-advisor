// Covers spec §7.2.1/§7.2.2 and §11 Example K's Transfer Semester build.
import { describe, it, expect } from 'vitest';
import { buildTransferSemester, transferableCourses } from '../../../src/modules/transfer/transferSemester.builder';
import { CourseEquivalencyEntry } from '../../../src/modules/transfer/courseEquivalency';

describe('transferableCourses — §7.2.1', () => {
  it('includes UR courses and isBasicScience courses, excludes plain program courses', () => {
    const result = transferableCourses([
      { courseCode: 'LRA401', category: 'ur_core', isBasicScience: false, credits: 1, pct: 90, letter: 'A', points: 4 },
      { courseCode: 'MTH111', category: 'faculty', isBasicScience: true, credits: 3, pct: 88, letter: 'A', points: 3.7 },
      { courseCode: 'ECE314', category: 'program', isBasicScience: false, credits: 2, pct: 80, letter: 'B', points: 3.0 },
    ]);
    expect(result.map(c => c.courseCode).sort()).toEqual(['LRA401', 'MTH111']);
  });
});

describe('buildTransferSemester — §7.2.2 / §11 Example K', () => {
  const equivalencyMap: CourseEquivalencyEntry[] = [
    { sourceCourseCode: 'MTH111', targetFacultyId: 'BUS', targetCourseCode: 'BUS-MTH1' },
    { sourceCourseCode: 'MTH121', targetFacultyId: 'BUS', targetCourseCode: 'BUS-MTH2' },
    { sourceCourseCode: 'CSE211', targetFacultyId: 'BUS', targetCourseCode: 'BUS-CS1' },
    // LRA401 deliberately has NO row for BUS -> must be excluded, not crash.
  ];

  it('transfers only courses with an equivalency row, excludes the rest visibly', () => {
    const result = buildTransferSemester({
      toFacultyId: 'BUS',
      semesterId: 'ts-1',
      ordinal: 6,
      passedCourses: [
        { courseCode: 'MTH111', category: 'faculty', isBasicScience: true, credits: 3, pct: 88, letter: 'A', points: 3.7 },
        { courseCode: 'MTH121', category: 'faculty', isBasicScience: true, credits: 3, pct: 90, letter: 'A', points: 3.7 },
        { courseCode: 'CSE211', category: 'faculty', isBasicScience: true, credits: 2, pct: 92, letter: 'A', points: 4.0 },
        { courseCode: 'LRA401', category: 'ur_core', isBasicScience: false, credits: 1, pct: 85, letter: 'B+', points: 3.0 },
        { courseCode: 'ECE314', category: 'program', isBasicScience: false, credits: 2, pct: 80, letter: 'B', points: 3.0 }, // not even eligible-category
      ],
      equivalencyMap,
    });

    expect(result.transferredCourses.map(c => c.courseCode).sort()).toEqual(['CSE211', 'MTH111', 'MTH121']);
    expect(result.excludedCourses).toEqual([{ courseCode: 'LRA401', reason: 'no_equivalency' }]);
    expect(result.totalCredits).toBe(8); // 3 + 3 + 2
  });

  it('computes semester GPA as the weighted-sum over transferred courses only (Example K: ~2.60)', () => {
    const result = buildTransferSemester({
      toFacultyId: 'BUS',
      semesterId: 'ts-1',
      ordinal: 6,
      passedCourses: [
        { courseCode: 'MTH111', category: 'faculty', isBasicScience: true, credits: 3, pct: 65, letter: 'D+', points: 2.0 },
        { courseCode: 'MTH121', category: 'faculty', isBasicScience: true, credits: 4, pct: 78, letter: 'C+', points: 2.7 },
        { courseCode: 'CSE211', category: 'faculty', isBasicScience: true, credits: 4, pct: 82, letter: 'B', points: 3.0 },
      ],
      equivalencyMap,
    });
    // (2.0*3 + 2.7*4 + 3.0*4) / 11 = (6 + 10.8 + 12) / 11 = 28.8/11 = 2.6182 -> 2.62
    expect(result.gpa).toBeCloseTo(2.62, 2);
    expect(result.totalCredits).toBe(11);
  });

  it('an empty transferable set yields gpa 0 rather than NaN/crashing', () => {
    const result = buildTransferSemester({
      toFacultyId: 'BUS',
      semesterId: 'ts-1',
      ordinal: 1,
      passedCourses: [],
      equivalencyMap,
    });
    expect(result.gpa).toBe(0);
    expect(result.totalCredits).toBe(0);
    expect(result.transferredCourses).toEqual([]);
  });
});
