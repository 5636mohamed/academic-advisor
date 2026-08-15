// Confirms the §7 transfer engine is really wired into the in-memory store
// (not just unit-tested in isolation), and that seeded warning-ladder
// counters are reproduced exactly by replaying real cgpaSnapshots (the old
// "seeded directly, not derived" caveat from PROGRESS.md is resolved).
import { describe, it, expect, beforeEach } from 'vitest';
import * as db from '../../../src/db/memory/inMemoryDb';

beforeEach(() => {
  db.__resetForTests();
});

describe('derived probation counters match their intended demo rung', () => {
  it.each([
    ['omar-1', 1],
    ['mona-2', 2],
    ['youssef-3', 3],
    ['laila-4', 4],
    ['nourhan-1', 6],
  ])('%s replays to warning count %i', (id, expected) => {
    expect(db.getStudent(id)?.probationCounter.count).toBe(expected);
  });

  it('nourhan-1 is dismissed and her log stops right at the dismissing semester', () => {
    const { counter, log } = db.getProbationHistory('nourhan-1');
    expect(counter.count).toBe(6);
    expect(log[log.length - 1].newCount).toBe(6);
  });
});

describe('internal transfer wiring — §7.1', () => {
  it('executeInternalTransferForStudent mutates the store and leaves the counter untouched', () => {
    const before = db.getStudent('youssef-3')!;
    const beforeCount = before.probationCounter.count;

    const result = db.executeInternalTransferForStudent('youssef-3', 'CSE', 'sem-6');

    const after = db.getStudent('youssef-3')!;
    expect(after.departmentId).toBe('CSE');
    expect(after.probationCounter.count).toBe(beforeCount); // untouched, §7.1
    expect(db.hasInternalTransfer('youssef-3')).toBe(true);
    expect(result.transferRecord.type).toBe('internal_department');
  });
});

describe('external transfer wiring — §7.2.3', () => {
  it('executeExternalTransferForStudent anchors a new base CGPA and resets the counter', () => {
    const result = db.executeExternalTransferForStudent('hassan-1', 'BUS', 'BIS');

    const after = db.getStudent('hassan-1')!;
    expect(after.facultyId).toBe('BUS');
    expect(after.departmentId).toBe('BIS');
    expect(after.activeBaseSnapshotId).toBe(result.activeBaseSnapshot.semesterId);
    expect(after.probationCounter).toEqual({ studentId: 'hassan-1', count: 0, armed: false });
    expect(db.getCurrentCgpa('hassan-1')).toBe(result.activeBaseSnapshot.cgpa);
  });

  it('previewExternalTransfer is a pure dry-run — does not mutate the store', () => {
    const before = db.getStudent('hassan-1')!.facultyId;
    db.previewExternalTransfer('hassan-1', 'BUS');
    expect(db.getStudent('hassan-1')!.facultyId).toBe(before);
  });
});
