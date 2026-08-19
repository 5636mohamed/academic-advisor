import { describe, it, expect } from 'vitest';
import { computeInstitutionalBottlenecks, StudentForBottleneck } from '../../../src/modules/friction/institutionalBottleneck.service';
import { SyllabusMilestone } from '@advisor/shared';

const milestonesByCourse: Record<string, SyllabusMilestone[]> = {
  X: [{ courseCode: 'X', weekNumber: 8, type: 'midterm', title: 'X midterm' }],
  Y: [{ courseCode: 'Y', weekNumber: 8, type: 'final', title: 'Y final' }], // clusters with X in week 8, every semester
  Z: [{ courseCode: 'Z', weekNumber: 2, type: 'quiz', title: 'Z quiz' }],
};
const credits = () => 3;

function studentsForSemesters(semesters: number[]): StudentForBottleneck[] {
  // One synthetic student per semester, always taking the X+Y (clustered)
  // pair — deliberately repeats across every semester so week 8 should
  // qualify as a "consistent" bottleneck for department 'D'.
  return semesters.map(semesterOrdinal => ({
    departmentId: 'D',
    transcript: [
      { courseCode: 'X', semesterOrdinal },
      { courseCode: 'Y', semesterOrdinal },
      { courseCode: 'Z', semesterOrdinal },
    ],
  }));
}

describe('computeInstitutionalBottlenecks — §1.8', () => {
  it('produces one cell per (department, week) actually seen in the data', () => {
    const cells = computeInstitutionalBottlenecks(studentsForSemesters([1, 2, 3]), milestonesByCourse, credits);
    const depts = new Set(cells.map(c => c.departmentId));
    expect(depts).toEqual(new Set(['D']));
    expect(cells.some(c => c.weekNumber === 8)).toBe(true);
  });

  it('a clustered week (X+Y overlap) scores higher than an isolated week (Z alone)', () => {
    const cells = computeInstitutionalBottlenecks(studentsForSemesters([1, 2, 3]), milestonesByCourse, credits);
    const week8 = cells.find(c => c.departmentId === 'D' && c.weekNumber === 8)!;
    const week2 = cells.find(c => c.departmentId === 'D' && c.weekNumber === 2)!;
    expect(week8.meanFrictionScore).toBeGreaterThan(week2.meanFrictionScore);
  });

  it('flags a repeated clustered week as a consistent bottleneck across >=2 recent semesters', () => {
    const cells = computeInstitutionalBottlenecks(studentsForSemesters([1, 2, 3]), milestonesByCourse, credits);
    const week8 = cells.find(c => c.departmentId === 'D' && c.weekNumber === 8)!;
    expect(week8.isConsistentBottleneck).toBe(true);
  });

  it('does NOT flag a one-off spike (only 1 semester has it) as consistent', () => {
    // Semester 1: X+Y cluster in week 8. Semesters 2 and 3: a completely
    // flat, unclustered load (courses that don't overlap and score low).
    const students: StudentForBottleneck[] = [
      { departmentId: 'D', transcript: [{ courseCode: 'X', semesterOrdinal: 1 }, { courseCode: 'Y', semesterOrdinal: 1 }] },
      { departmentId: 'D', transcript: [{ courseCode: 'Z', semesterOrdinal: 2 }] },
      { departmentId: 'D', transcript: [{ courseCode: 'Z', semesterOrdinal: 3 }] },
    ];
    const cells = computeInstitutionalBottlenecks(students, milestonesByCourse, credits);
    const week8 = cells.find(c => c.departmentId === 'D' && c.weekNumber === 8);
    // week 8 only ever appears in semester 1's data — can't be "consistent"
    // by definition (needs >=2 of the last 3 semesters to hit the top decile).
    expect(week8?.isConsistentBottleneck ?? false).toBe(false);
  });

  it('handles an empty student list without throwing', () => {
    expect(computeInstitutionalBottlenecks([], milestonesByCourse, credits)).toEqual([]);
  });
});
