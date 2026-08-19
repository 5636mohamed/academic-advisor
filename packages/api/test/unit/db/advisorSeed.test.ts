// Multi-advisor epic, extended by the real-FoE-department expansion — one
// advisor per real seeded department (see db/seed/seedAdvisors.ts's
// ADVISORS and seedCatalog.ts's CATALOG_BY_DEPARTMENT), each owning a
// 25-35-student roster (deterministic per-advisor size, not a fixed 25).
// See db/seed/seedAdvisors.ts and inMemoryDb.ts's generateFillerStudents().
import { describe, it, expect, beforeEach } from 'vitest';
import * as db from '../../../src/db/memory/inMemoryDb';
import { ADVISORS, NAMED_STUDENT_ADVISOR, rosterSizeFor } from '../../../src/db/seed/seedAdvisors';
import { CATALOG_BY_DEPARTMENT } from '../../../src/db/seed/seedCatalog';

const TOTAL_ROSTER_SIZE = ADVISORS.reduce((sum, a) => sum + rosterSizeFor(a.id), 0);

beforeEach(() => {
  db.__resetForTests();
});

describe(`advisor seed — ${ADVISORS.length} advisors, ${TOTAL_ROSTER_SIZE} students total`, () => {
  it(`seeds exactly ${ADVISORS.length} advisors`, () => {
    expect(db.listAdvisors()).toHaveLength(ADVISORS.length);
    expect(ADVISORS).toHaveLength(ADVISORS.length);
  });

  it('every advisor\'s departmentId has a real seeded catalog', () => {
    for (const a of ADVISORS) {
      expect(CATALOG_BY_DEPARTMENT[a.departmentId]).toBeDefined();
      expect(CATALOG_BY_DEPARTMENT[a.departmentId].length).toBeGreaterThan(0);
    }
  });

  it('getAdvisor resolves each seeded id, and returns undefined for an unknown one', () => {
    for (const a of ADVISORS) {
      expect(db.getAdvisor(a.id)?.name).toBe(a.name);
    }
    expect(db.getAdvisor('nobody')).toBeUndefined();
  });

  it('seeds the expected total student count (sum of each advisor\'s own 25-35 roster size)', () => {
    expect(db.listStudents()).toHaveLength(TOTAL_ROSTER_SIZE);
  });

  it('every student has a valid advisorId pointing at a real seeded advisor', () => {
    const advisorIds = new Set(ADVISORS.map(a => a.id));
    for (const s of db.listStudents()) {
      expect(advisorIds.has(s.advisorId)).toBe(true);
    }
  });

  it('every generated/named student\'s departmentId matches their advisor\'s own department', () => {
    const advisorById = new Map(ADVISORS.map(a => [a.id, a]));
    for (const s of db.listStudents()) {
      expect(s.departmentId).toBe(advisorById.get(s.advisorId)!.departmentId);
    }
  });

  it('every advisor owns exactly their own deterministic 25-35 roster size', () => {
    const students = db.listStudents();
    for (const a of ADVISORS) {
      const count = students.filter(s => s.advisorId === a.id).length;
      expect(count).toBe(rosterSizeFor(a.id));
      expect(count).toBeGreaterThanOrEqual(25);
      expect(count).toBeLessThanOrEqual(35);
    }
  });

  it('the hand-authored named personas keep their original ids and are assigned per NAMED_STUDENT_ADVISOR', () => {
    for (const [studentId, advisorId] of Object.entries(NAMED_STUDENT_ADVISOR)) {
      const student = db.getStudent(studentId);
      expect(student).toBeDefined();
      expect(student!.advisorId).toBe(advisorId);
    }
    // exactly the 14 ECE-only named ones (13 original + the cold-start
    // trial persona) — every new non-ECE advisor's roster is 100% generated.
    expect(Object.keys(NAMED_STUDENT_ADVISOR)).toHaveLength(14);
  });

  it('named personas keep their real hand-authored fields untouched (spot check Ahmed)', () => {
    const ahmed = db.getStudent('ahmed-1');
    expect(ahmed?.name).toBe('Ahmed Mostafa');
    expect(ahmed?.facultyId).toBe('ENG');
    expect(ahmed?.departmentId).toBe('ECE');
  });

  it('generated filler students show a real spread of standing, not identical CGPAs', () => {
    const generated = db.listStudents().filter(s => s.id.includes('-gen-'));
    expect(generated.length).toBeGreaterThan(TOTAL_ROSTER_SIZE - 20); // total minus the 14 named
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

  it('a non-ECE generated student\'s filled-in courses are all real courses from their OWN department\'s catalog', () => {
    const cseAdvisor = ADVISORS.find(a => a.departmentId === 'CSE')!;
    const cseStudents = db.listStudents().filter(s => s.advisorId === cseAdvisor.id && s.id.includes('-gen-'));
    expect(cseStudents.length).toBeGreaterThan(0);
    const cseCodes = new Set(CATALOG_BY_DEPARTMENT['CSE'].map(c => c.code));
    for (const s of cseStudents) {
      const transcript = db.getTranscript(s.id);
      for (const code of Object.keys(transcript)) {
        expect(cseCodes.has(code)).toBe(true); // never an ECE-only or other-department-only code
      }
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
    expect(db.getAdvisorReport()).toHaveLength(TOTAL_ROSTER_SIZE);
  });

  it('scoped to one advisor returns exactly that advisor\'s own roster size', () => {
    for (const a of ADVISORS) {
      const rows = db.getAdvisorReport(a.id);
      expect(rows).toHaveLength(rosterSizeFor(a.id));
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
