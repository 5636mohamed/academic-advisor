// Multi-advisor epic — the 5 named advisors, and the 125-student roster
// (13 hand-authored §11 personas + generated filler students) each of
// them owns 25 of. See db/seed/seedAdvisors.ts and inMemoryDb.ts's
// generateFillerStudents().
import { describe, it, expect, beforeEach } from 'vitest';
import * as db from '../../../src/db/memory/inMemoryDb';
import { ADVISORS, NAMED_STUDENT_ADVISOR, STUDENTS_PER_ADVISOR } from '../../../src/db/seed/seedAdvisors';

beforeEach(() => {
  db.__resetForTests();
});

describe('advisor seed — 5 advisors, 125 students total', () => {
  it('seeds exactly 5 advisors', () => {
    expect(db.listAdvisors()).toHaveLength(5);
    expect(ADVISORS).toHaveLength(5);
  });

  it('getAdvisor resolves each seeded id, and returns undefined for an unknown one', () => {
    for (const a of ADVISORS) {
      expect(db.getAdvisor(a.id)?.name).toBe(a.name);
    }
    expect(db.getAdvisor('nobody')).toBeUndefined();
  });

  it('seeds exactly 125 students total (5 advisors x 25)', () => {
    expect(db.listStudents()).toHaveLength(5 * STUDENTS_PER_ADVISOR);
  });

  it('every student has a valid advisorId pointing at a real seeded advisor', () => {
    const advisorIds = new Set(ADVISORS.map(a => a.id));
    for (const s of db.listStudents()) {
      expect(advisorIds.has(s.advisorId)).toBe(true);
    }
  });

  it('every advisor owns exactly 25 students', () => {
    const students = db.listStudents();
    for (const a of ADVISORS) {
      const count = students.filter(s => s.advisorId === a.id).length;
      expect(count).toBe(STUDENTS_PER_ADVISOR);
    }
  });

  it('the 13 hand-authored named personas keep their original ids and are assigned per NAMED_STUDENT_ADVISOR', () => {
    for (const [studentId, advisorId] of Object.entries(NAMED_STUDENT_ADVISOR)) {
      const student = db.getStudent(studentId);
      expect(student).toBeDefined();
      expect(student!.advisorId).toBe(advisorId);
    }
    // exactly the 13 named ones, no more no less
    expect(Object.keys(NAMED_STUDENT_ADVISOR)).toHaveLength(13);
  });

  it('named personas keep their real hand-authored fields untouched (spot check Ahmed)', () => {
    const ahmed = db.getStudent('ahmed-1');
    expect(ahmed?.name).toBe('Ahmed');
    expect(ahmed?.facultyId).toBe('ENG');
    expect(ahmed?.departmentId).toBe('ECE');
  });

  it('generated filler students show a real spread of standing, not identical CGPAs', () => {
    const generated = db.listStudents().filter(s => s.id.includes('-gen-'));
    expect(generated.length).toBeGreaterThan(100); // 125 - 13 named = 112
    const cgpas = generated.map(s => db.getCurrentCgpa(s.id));
    const distinctBuckets = new Set(cgpas.map(c => Math.floor(c * 2))); // coarse buckets of 0.5
    expect(distinctBuckets.size).toBeGreaterThan(3); // real variety, not a flat line
    // and a real spread across standing tiers, not everyone clustered safe
    expect(cgpas.some(c => c < 2.0)).toBe(true); // at least one probation-risk case exists
    expect(cgpas.some(c => c >= 3.5)).toBe(true); // at least one strong case exists
  });

  it('generated students have plausible level/credits derived from their filled transcript, not the placeholder 0/1', () => {
    const generated = db.listStudents().filter(s => s.id.includes('-gen-'));
    for (const s of generated) {
      expect(s.cumulativeEarnedCredits).toBeGreaterThan(0);
      expect(s.level).toBeGreaterThanOrEqual(1);
    }
  });

  it('the generator is deterministic — resetting produces byte-identical rosters', () => {
    const before = db.listStudents().map(s => ({ id: s.id, advisorId: s.advisorId, cgpa: db.getCurrentCgpa(s.id), level: s.level }));
    db.__resetForTests();
    const after = db.listStudents().map(s => ({ id: s.id, advisorId: s.advisorId, cgpa: db.getCurrentCgpa(s.id), level: s.level }));
    expect(after).toEqual(before);
  });
});

describe('getAdvisorReport — per-advisor roster scoping (real server-side filtering, not just client-side hiding)', () => {
  it('unscoped (no advisorId) still returns every student, same as before this epic', () => {
    expect(db.getAdvisorReport()).toHaveLength(5 * STUDENTS_PER_ADVISOR);
  });

  it('scoped to one advisor returns exactly that advisor\'s 25 students', () => {
    for (const a of ADVISORS) {
      const rows = db.getAdvisorReport(a.id);
      expect(rows).toHaveLength(STUDENTS_PER_ADVISOR);
    }
  });

  it('two different advisors\' scoped reports are fully disjoint sets of studentIds', () => {
    const [a, b] = ADVISORS;
    const idsA = new Set(db.getAdvisorReport(a.id).map(r => r.studentId));
    const idsB = new Set(db.getAdvisorReport(b.id).map(r => r.studentId));
    for (const id of idsA) expect(idsB.has(id)).toBe(false);
  });

  it('an unknown advisorId returns an empty report rather than silently falling back to everyone', () => {
    expect(db.getAdvisorReport('nobody')).toHaveLength(0);
  });
});

describe('listPendingProposalsAcrossAllAdvisors — the VP dashboard\'s flat cross-advisor queue', () => {
  it('every row carries the real owning advisorId, and approving one via the normal advisor route removes it from the queue', () => {
    const proposals = db.addProposalsFromPlan('ahmed-1', [{
      courseCode: 'ECE314', isRetake: false, oldPoints: null,
      expectedPct: 80, expectedLetter: 'B', expectedPoints: 3.0,
      deltaPts: null, chainUnlockValue: 2, passRate: 85, score: 50, mandatory: false,
    }]);
    const before = db.listPendingProposalsAcrossAllAdvisors();
    const row = before.find(p => p.studentId === 'ahmed-1' && p.slotKey === 'ECE314');
    expect(row).toBeDefined();
    expect(row!.advisorId).toBe(db.getStudent('ahmed-1')!.advisorId);

    db.approveProposalById(proposals.find(p => p.slotKey === 'ECE314')!.id);
    const after = db.listPendingProposalsAcrossAllAdvisors();
    expect(after.some(p => p.studentId === 'ahmed-1' && p.slotKey === 'ECE314')).toBe(false);
  });

  it('never includes advisor-authored alternates (those are self-approved on creation, never pending)', () => {
    const rows = db.listPendingProposalsAcrossAllAdvisors();
    // every row in the queue must be a genuinely still-pending SYSTEM proposal
    for (const r of rows) {
      const student = db.getStudent(r.studentId)!;
      const proposal = student.proposals.find(p => p.id === r.proposalId)!;
      expect(proposal.origin).toBe('system');
      expect(proposal.status).toBe('pending');
    }
  });
});
