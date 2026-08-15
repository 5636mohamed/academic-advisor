// Covers spec §7.2.3, §11 Example K, and §13 checklist items 8-9:
// "external transfer resets counter to 0 and sets armed=false" /
// "CGPA after external transfer is computed only from the base snapshot forward."
import { describe, it, expect } from 'vitest';
import { executeExternalTransfer } from '../../../src/modules/transfer/externalTransfer.service';
import { buildTransferSemester } from '../../../src/modules/transfer/transferSemester.builder';
import { computeCGPA } from '../../../src/modules/grading/cgpa';

describe('executeExternalTransfer — §7.2.3 / §11 Example K', () => {
  const transferSemester = buildTransferSemester({
    toFacultyId: 'BUS',
    semesterId: 'ts-1',
    ordinal: 6,
    passedCourses: [
      { courseCode: 'MTH111', category: 'faculty', isBasicScience: true, credits: 4, pct: 78, letter: 'C+', points: 2.7 },
      { courseCode: 'CSE211', category: 'faculty', isBasicScience: true, credits: 7, pct: 82, letter: 'B', points: 3.0 },
    ],
    equivalencyMap: [
      { sourceCourseCode: 'MTH111', targetFacultyId: 'BUS', targetCourseCode: 'X1' },
      { sourceCourseCode: 'CSE211', targetFacultyId: 'BUS', targetCourseCode: 'X2' },
    ],
  });

  it('the Transfer Semester GPA becomes the new isBaseSnapshot CGPA anchor', () => {
    const result = executeExternalTransfer({
      studentId: 'hassan-1',
      fromFacultyId: 'ENG',
      toFacultyId: 'BUS',
      toDepartmentId: 'BIS',
      transferSemester,
      counterCountBeforeTransfer: 4,
    });

    expect(result.activeBaseSnapshot.isBaseSnapshot).toBe(true);
    expect(result.activeBaseSnapshot.cgpa).toBe(transferSemester.gpa);
    expect(result.activeBaseSnapshot.semesterGpa).toBe(transferSemester.gpa);
    expect(result.activeBaseSnapshot.cumulativeCredits).toBe(11);
  });

  it('resets counter to 0 and sets armed=false regardless of prior count (§13 item 8)', () => {
    const result = executeExternalTransfer({
      studentId: 'hassan-1',
      fromFacultyId: 'ENG',
      toFacultyId: 'BUS',
      toDepartmentId: 'BIS',
      transferSemester,
      counterCountBeforeTransfer: 5,
    });
    expect(result.counter).toEqual({ studentId: 'hassan-1', count: 0, armed: false });
    expect(result.probationLog.previousCount).toBe(5);
    expect(result.probationLog.newCount).toBe(0);
    expect(result.probationLog.reason).toBe('reset_faculty_transfer');
  });

  it('recalculates level from the transferred credit total, not the old faculty history', () => {
    const result = executeExternalTransfer({
      studentId: 'hassan-1',
      fromFacultyId: 'ENG',
      toFacultyId: 'BUS',
      toDepartmentId: 'BIS',
      transferSemester, // 11 transferred credits
      counterCountBeforeTransfer: 0,
    });
    expect(result.level).toBe(1); // levelFromCredits(11) < 36 -> Level 1
  });

  it('records a TransferRecord type=external_faculty, counterAction=reset', () => {
    const result = executeExternalTransfer({
      studentId: 'hassan-1',
      fromFacultyId: 'ENG',
      toFacultyId: 'BUS',
      toDepartmentId: 'BIS',
      transferSemester,
      counterCountBeforeTransfer: 0,
    });
    expect(result.transferRecord.type).toBe('external_faculty');
    expect(result.transferRecord.counterAction).toBe('reset');
    expect(result.transferRecord.fromFacultyId).toBe('ENG');
    expect(result.transferRecord.toFacultyId).toBe('BUS');
  });

  it('§13 item 9 — old-faculty history is excluded once sinceSemesterOrdinal anchors at the base snapshot', () => {
    // Simulate: old ENG transcript at ordinals 1-5 (low CGPA), then the
    // Transfer Semester at ordinal 6 with strong grades. CGPA computed with
    // sinceSemesterOrdinal = the base snapshot's ordinal must reflect ONLY
    // ordinal 6 — this is the same mechanism §7.2.3 relies on.
    const allAttempts = [
      { courseCode: 'OLD1', attemptNumber: 1, pct: 40, letter: 'F', points: 1.0, isRetake: false, countsInCgpa: true, semesterOrdinal: 3 },
      { courseCode: 'MTH111', attemptNumber: 1, pct: 78, letter: 'C+', points: 2.7, isRetake: false, countsInCgpa: true, semesterOrdinal: 6 },
      { courseCode: 'CSE211', attemptNumber: 1, pct: 82, letter: 'B', points: 3.0, isRetake: false, countsInCgpa: true, semesterOrdinal: 6 },
    ];
    const courseByCode = { OLD1: { credits: 10 }, MTH111: { credits: 4 }, CSE211: { credits: 7 } };
    const cgpa = computeCGPA({ latestAttempts: allAttempts, courseByCode, sinceSemesterOrdinal: 6 });
    expect(cgpa).toBe(transferSemester.gpa); // OLD1 (a 1.0-point, 10-credit disaster) must NOT drag this down
  });
});
