// Covers spec §7.1, §11 Example H's execution step, and §13 checklist item 7:
// "internal transfer leaves counter value and armed-state untouched."
import { describe, it, expect } from 'vitest';
import { executeInternalTransfer } from '../../../src/modules/transfer/internalTransfer.service';

describe('executeInternalTransfer — §7.1', () => {
  it('carries credits over 1:1 and keeps department-specific courses without a match flagged excessCredit', () => {
    const result = executeInternalTransfer({
      studentId: 'sara-1',
      facultyId: 'ENG',
      fromDepartmentId: 'ECE',
      toDepartmentId: 'CSE',
      effectiveSemesterId: 'sem-4',
      cumulativeEarnedCredits: 40,
      passedCourses: [
        { courseCode: 'MTH111', category: 'faculty' }, // shared -> remaps
        { courseCode: 'CSE211', category: 'faculty' }, // in CSE's own catalog -> remaps
        { courseCode: 'ECE211', category: 'school' }, // ECE-only, no CSE equivalent -> excess
        { courseCode: 'LRA401', category: 'ur_core' }, // UR -> always remaps
      ],
      newDepartmentCourseCodes: new Set(['MTH111', 'CSE211', 'LRA401', 'CSE213']),
      counterCountAtTransfer: 0,
    });

    expect(result.departmentId).toBe('CSE');
    expect(result.excessCreditCourseCodes).toEqual(['ECE211']);
    expect(result.level).toBe(2); // levelFromCredits(40) — unchanged by the transfer itself
  });

  it('leaves the probation counter value completely untouched (§13 item 7)', () => {
    const result = executeInternalTransfer({
      studentId: 's1',
      facultyId: 'ENG',
      fromDepartmentId: 'ECE',
      toDepartmentId: 'CSE',
      effectiveSemesterId: 'sem-5',
      cumulativeEarnedCredits: 60,
      passedCourses: [],
      newDepartmentCourseCodes: new Set(),
      counterCountAtTransfer: 3, // e.g. a warning-ladder student transferring at rung 3
    });

    expect(result.probationLog.previousCount).toBe(3);
    expect(result.probationLog.newCount).toBe(3);
    expect(result.probationLog.reason).toBe('unchanged_internal_transfer');
  });

  it('records a TransferRecord with type internal_department and counterAction retained, faculty unchanged', () => {
    const result = executeInternalTransfer({
      studentId: 's1',
      facultyId: 'ENG',
      fromDepartmentId: 'ECE',
      toDepartmentId: 'CSE',
      effectiveSemesterId: 'sem-4',
      cumulativeEarnedCredits: 40,
      passedCourses: [],
      newDepartmentCourseCodes: new Set(),
      counterCountAtTransfer: 0,
    });

    expect(result.transferRecord.type).toBe('internal_department');
    expect(result.transferRecord.counterAction).toBe('retained');
    expect(result.transferRecord.fromFacultyId).toBe('ENG');
    expect(result.transferRecord.toFacultyId).toBe('ENG');
    expect(result.transferRecord.fromDepartmentId).toBe('ECE');
    expect(result.transferRecord.toDepartmentId).toBe('CSE');
  });

  it('a fully-covered curriculum produces no excess credit at all', () => {
    const result = executeInternalTransfer({
      studentId: 's1',
      facultyId: 'ENG',
      fromDepartmentId: 'ECE',
      toDepartmentId: 'MTE',
      effectiveSemesterId: 'sem-4',
      cumulativeEarnedCredits: 40,
      passedCourses: [{ courseCode: 'MTH111', category: 'faculty' }],
      newDepartmentCourseCodes: new Set(['MTH111']),
      counterCountAtTransfer: 0,
    });
    expect(result.excessCreditCourseCodes).toEqual([]);
  });
});
