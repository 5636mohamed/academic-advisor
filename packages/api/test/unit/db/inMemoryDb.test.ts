// Tests the in-memory "database" (src/db/memory/inMemoryDb.ts) itself —
// how data is seeded, read, modified, and re-read. This is deliberately
// separate from the pure-function tests elsewhere: those test the
// business-logic modules in isolation; this tests the storage layer that
// glues them to something resembling persisted data (see that file's
// header comment for how this differs from the real Prisma layer, still
// pending per PROGRESS.md item 4).
import { describe, it, expect, beforeEach } from 'vitest';
import * as db from '../../../src/db/memory/inMemoryDb';

beforeEach(() => {
  db.__resetForTests(); // this module is a singleton — isolate each test from prior writes
});

describe('in-memory store — seed / read', () => {
  it('lists all seeded demo students', () => {
    const list = db.listStudents();
    expect(list.map(s => s.id).sort()).toEqual([
      'ahmed-1', 'fatma-1', 'hassan-1', 'karim-1', 'laila-4', 'mohamed-1', 'mona-2',
      'nourhan-1', 'omar-1', 'salma-1', 'sara-1', 'yara-1', 'youssef-3',
    ]);
  });

  it('getStudent returns undefined for an unknown id (no crash)', () => {
    expect(db.getStudent('nobody')).toBeUndefined();
  });

  it('getTranscript applies the §2.2 replacement rule — one row per course code', () => {
    const transcript = db.getTranscript('ahmed-1');
    const codes = Object.keys(transcript);
    expect(new Set(codes).size).toBe(codes.length); // no duplicates
    expect(transcript['MTH111'].pct).toBe(88);
  });

  it('getCurrentCgpa computes a plausible weighted average from seeded attempts', () => {
    const cgpa = db.getCurrentCgpa('ahmed-1');
    expect(cgpa).toBeGreaterThan(0);
    expect(cgpa).toBeLessThanOrEqual(4.0);
  });

  it('getEligibleCourses flags Karim\'s PHY121 (F) and MTH121 (D) as retake candidates', () => {
    const eligible = db.getEligibleCourses('karim-1');
    const phy121 = eligible.find(e => e.course.code === 'PHY121');
    const mth121 = eligible.find(e => e.course.code === 'MTH121');
    expect(phy121?.isRetake).toBe(true);
    expect(phy121?.oldLetter).toBe('F');
    expect(mth121?.isRetake).toBe(true);
    expect(mth121?.oldLetter).toBe('D');
  });

  it('getEligibleCourses does not re-offer a course already passed with C or better', () => {
    const eligible = db.getEligibleCourses('ahmed-1');
    expect(eligible.some(e => e.course.code === 'MTH111')).toBe(false); // Ahmed passed this with an A
  });

  // BUILD_SPEC.md §"Course categories": "ur_core/ur_elective (LRA/
  // University-Requirement courses, may be taken from any year's list)" —
  // a flat exemption from level-gating, distinct from core/program/
  // faculty/school courses which "must be taken at-or-before the
  // student's current level".
  it('a semester-7 LRA/UR elective is eligible even for a Level 2 student (LRA courses are never level-gated)', () => {
    const eligible = db.getEligibleCourses('karim-1'); // karim-1 is Level 2
    expect(eligible.some(e => e.course.code === 'LRAE4')).toBe(true);
  });

  it('a semester-7 program elective (not LRA/UR) stays locked for a Level 2 student, same course with no prereqs to confound it', () => {
    const eligible = db.getEligibleCourses('karim-1');
    expect(eligible.some(e => e.course.code === 'ECEEL1')).toBe(false);
  });

  it('getCurriculum marks that same LRA elective "eligible" (not "locked") for a Level 2 student', () => {
    const rows = db.getCurriculum('karim-1');
    const lra = rows.find(r => r.course.code === 'LRAE4');
    expect(lra?.status).toBe('eligible');
  });
});

describe('in-memory store — write / modify', () => {
  it('recordEnrollment saves a NEW attempt without erasing the prior one (full history preserved)', () => {
    const before = db.getStudent('karim-1')!.allAttempts.filter(a => a.courseCode === 'PHY121');
    expect(before).toHaveLength(1); // the original F

    db.recordEnrollment('karim-1', 'PHY121', 78, 3); // retake, passes with C+

    const after = db.getStudent('karim-1')!.allAttempts.filter(a => a.courseCode === 'PHY121');
    expect(after).toHaveLength(2); // both attempts still present — replacement rule is a READ-time projection
    expect(after[0].letter).toBe('F'); // original attempt untouched
    expect(after[1].letter).toBe('C+'); // new attempt appended
    expect(after[1].attemptNumber).toBe(2);
  });

  it('recordEnrollment\'s replacement rule surfaces only the LATEST attempt on subsequent reads', () => {
    db.recordEnrollment('karim-1', 'PHY121', 78, 3);
    const transcript = db.getTranscript('karim-1');
    expect(transcript['PHY121'].letter).toBe('C+'); // latest attempt wins, not averaged with the F
  });

  it('recordEnrollment recomputes and returns the new CGPA reflecting the write immediately', () => {
    const cgpaBefore = db.getCurrentCgpa('karim-1');
    const { newCgpa } = db.recordEnrollment('karim-1', 'PHY121', 78, 3);
    expect(newCgpa).not.toBe(cgpaBefore);
    expect(newCgpa).toBe(db.getCurrentCgpa('karim-1')); // store and return value agree
    expect(newCgpa).toBeGreaterThan(cgpaBefore); // F -> C+ should raise CGPA
  });

  it('a retake that no longer scores D/D+/F removes that course from future eligible-retake lists', () => {
    expect(db.getEligibleCourses('karim-1').find(e => e.course.code === 'PHY121')?.isRetake).toBe(true);
    db.recordEnrollment('karim-1', 'PHY121', 78, 3); // now C+, a real pass
    expect(db.getEligibleCourses('karim-1').some(e => e.course.code === 'PHY121')).toBe(false);
  });

  it('recordEnrollment throws (does not silently no-op) for an unknown student or course', () => {
    expect(() => db.recordEnrollment('nobody', 'MTH111', 80, 1)).toThrow();
    expect(() => db.recordEnrollment('karim-1', 'ZZZ999', 80, 1)).toThrow();
  });

  it('setQuizAnswers merges new answers into the store rather than replacing the whole object', () => {
    db.setQuizAnswers('karim-1', { q1_problem_style: 'q1_build' });
    db.setQuizAnswers('karim-1', { q2_favorite_subject: 'q2_signals' });
    const stored = db.getStudent('karim-1')!.quizAnswers;
    expect(stored.q1_problem_style).toBe('q1_build');
    expect(stored.q2_favorite_subject).toBe('q2_signals'); // both present — merge, not overwrite
  });

  it('updateStudentStatus writes the new status and it is visible on the next read', () => {
    expect(db.getStudent('karim-1')!.status).toBe('active');
    db.updateStudentStatus('karim-1', 'probation');
    expect(db.getStudent('karim-1')!.status).toBe('probation');
    db.updateStudentStatus('karim-1', 'active'); // restore for other tests in this file
  });
});
