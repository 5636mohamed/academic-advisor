// Multi-advisor epic, extended by the real-FoE-department expansion, then
// re-modeled for a genuinely random cross-department roster: 35 students
// per real department (10*35=350), 25 per advisor (14*25=350) — the two
// totals agree, but an advisor's roster is a real (deterministic) random
// mix across departments, not "one advisor per department". See
// db/seed/seedAdvisors.ts and inMemoryDb.ts's generateDepartmentStudents().
import { describe, it, expect, beforeEach } from 'vitest';
import * as db from '../../../src/db/memory/inMemoryDb';
import { ADVISORS, NAMED_STUDENT_ADVISOR, STUDENTS_PER_DEPARTMENT, STUDENTS_PER_ADVISOR } from '../../../src/db/seed/seedAdvisors';
import { CATALOG_BY_DEPARTMENT } from '../../../src/db/seed/seedCatalog';
import { DISMISSAL_THRESHOLD } from '@advisor/shared';

const TOTAL_ROSTER_SIZE = ADVISORS.length * STUDENTS_PER_ADVISOR;
const REAL_DEPARTMENT_IDS = Object.keys(CATALOG_BY_DEPARTMENT);

beforeEach(() => {
  db.__resetForTests();
});

describe(`advisor seed — ${ADVISORS.length} advisors, ${REAL_DEPARTMENT_IDS.length} departments, ${TOTAL_ROSTER_SIZE} students total`, () => {
  it(`seeds exactly ${ADVISORS.length} advisors`, () => {
    expect(db.listAdvisors()).toHaveLength(ADVISORS.length);
    expect(ADVISORS).toHaveLength(ADVISORS.length);
  });

  it('every advisor\'s home departmentId has a real seeded catalog', () => {
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

  it(`seeds exactly ${STUDENTS_PER_DEPARTMENT} students per department (${REAL_DEPARTMENT_IDS.length} * ${STUDENTS_PER_DEPARTMENT} = ${TOTAL_ROSTER_SIZE})`, () => {
    const students = db.listStudents();
    expect(students).toHaveLength(TOTAL_ROSTER_SIZE);
    for (const deptId of REAL_DEPARTMENT_IDS) {
      const count = students.filter(s => s.departmentId === deptId).length;
      expect(count, `department ${deptId}`).toBe(STUDENTS_PER_DEPARTMENT);
    }
  });

  it(`every advisor owns exactly ${STUDENTS_PER_ADVISOR} students (named + randomly-assigned generated)`, () => {
    const students = db.listStudents();
    for (const a of ADVISORS) {
      const count = students.filter(s => s.advisorId === a.id).length;
      expect(count, a.id).toBe(STUDENTS_PER_ADVISOR);
    }
  });

  it('every student has a valid advisorId pointing at a real seeded advisor', () => {
    const advisorIds = new Set(ADVISORS.map(a => a.id));
    for (const s of db.listStudents()) {
      expect(advisorIds.has(s.advisorId)).toBe(true);
    }
  });

  it('at least one advisor genuinely has students from more than one department — the whole point of the random cross-department assignment, not just technically possible', () => {
    const students = db.listStudents();
    const anyMixedAdvisor = ADVISORS.some(a => {
      const deptsForThisAdvisor = new Set(students.filter(s => s.advisorId === a.id).map(s => s.departmentId));
      return deptsForThisAdvisor.size > 1;
    });
    expect(anyMixedAdvisor).toBe(true);
  });

  it('the hand-authored named personas keep their original ids and are assigned per NAMED_STUDENT_ADVISOR', () => {
    for (const [studentId, advisorId] of Object.entries(NAMED_STUDENT_ADVISOR)) {
      const student = db.getStudent(studentId);
      expect(student).toBeDefined();
      expect(student!.advisorId).toBe(advisorId);
    }
    // exactly the 14 ECE-only named ones (13 original + the cold-start
    // trial persona) — every other student (across every department) is
    // generated and randomly assigned.
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
    expect(generated.length).toBe(TOTAL_ROSTER_SIZE - 14); // total minus the 14 named
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

  it('a generated student\'s filled-in courses are all real courses from their OWN department\'s catalog, regardless of which advisor they were randomly assigned to', () => {
    const cseStudents = db.listStudents().filter(s => s.departmentId === 'CSE' && s.id.includes('-gen-'));
    expect(cseStudents.length).toBeGreaterThan(0);
    const cseCodes = new Set(CATALOG_BY_DEPARTMENT['CSE'].map(c => c.code));
    for (const s of cseStudents) {
      const transcript = db.getTranscript(s.id);
      for (const code of Object.keys(transcript)) {
        expect(cseCodes.has(code)).toBe(true); // never an ECE-only or other-department-only code
      }
    }
  });

  it('the generator is deterministic — resetting produces byte-identical rosters and advisor assignments', () => {
    const before = db.listStudents().map(s => ({ id: s.id, advisorId: s.advisorId, cgpa: db.getCurrentCgpa(s.id), level: s.level }));
    db.__resetForTests();
    const after = db.listStudents().map(s => ({ id: s.id, advisorId: s.advisorId, cgpa: db.getCurrentCgpa(s.id), level: s.level }));
    expect(after).toEqual(before);
  });

  // Real bug caught by a full student-by-student live audit (350 students,
  // not just the one reported): a GENERATED student's replayed probation
  // history can organically land at count >= DISMISSAL_THRESHOLD (6) —
  // same as a real student's could at runtime through /semesters/close —
  // but deriveStudent used to only sync `probationCounter` from the
  // replay, never `status`. That left "phantom dismissed" students: every
  // advising/registration/venture endpoint (blockIfDismissed, keyed off
  // the counter) already 403'd them, while every UI surface that trusts
  // `status` (roster lists, profile badges) still showed them as a normal
  // active student. This asserts the invariant holds across the ENTIRE
  // seeded roster (fixtures and generated alike), not just a spot check.
  it('every student\'s status and probation counter agree on dismissal — no "phantom dismissed" student where the counter says 6/6 but status still reads active', () => {
    for (const s of db.listStudents()) {
      const shouldBeDismissed = s.probationCounter.count >= DISMISSAL_THRESHOLD;
      expect(s.status === 'dismissed').toBe(shouldBeDismissed);
    }
  });

  it('the one intentionally-dismissed fixture (nourhan-1) is still dismissed after this fix', () => {
    const nourhan = db.getStudent('nourhan-1');
    expect(nourhan?.status).toBe('dismissed');
    expect(nourhan?.probationCounter.count).toBe(6);
  });
});

describe('getAdvisorReport — per-advisor roster scoping (real server-side filtering, not just client-side hiding)', () => {
  it('unscoped (no advisorId) still returns every student, same as before this epic', () => {
    expect(db.getAdvisorReport()).toHaveLength(TOTAL_ROSTER_SIZE);
  });

  it(`scoped to one advisor returns exactly ${STUDENTS_PER_ADVISOR} students`, () => {
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
