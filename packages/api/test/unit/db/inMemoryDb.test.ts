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
  it('lists every seeded demo student, including all 13 named §11 personas (plus generated filler students — see advisorSeed.test.ts for the full 125-student roster coverage)', () => {
    const ids = new Set(db.listStudents().map(s => s.id));
    for (const namedId of [
      'ahmed-1', 'fatma-1', 'hassan-1', 'karim-1', 'laila-4', 'mohamed-1', 'mona-2',
      'nourhan-1', 'omar-1', 'salma-1', 'sara-1', 'yara-1', 'youssef-3',
    ]) {
      expect(ids.has(namedId)).toBe(true);
    }
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

// §15.3.2 step 2(b) — an advisor "proposing an alternate" that is actually
// the exact course the system already recommended for that slot isn't a
// real alternative (Approve already covers that case); the store rejects
// it rather than silently accepting a no-op alternate proposal.
describe('advisor alternate proposals — cannot re-propose the system\'s own recommendation', () => {
  function candidate(courseCode: string) {
    return {
      courseCode, isRetake: false, oldPoints: null,
      expectedPct: 80, expectedLetter: 'B', expectedPoints: 3.0,
      deltaPts: null, chainUnlockValue: 2, passRate: 85, score: 50, mandatory: false,
    };
  }
  const scored = { expectedPct: 84, expectedLetter: 'B', expectedPoints: 3.0 };

  it('addAdvisorAlternateProposal throws when courseCode matches the slot\'s live system proposal', () => {
    db.addProposalsFromPlan('ahmed-1', [candidate('ECE314')]);
    expect(() => db.addAdvisorAlternateProposal('ahmed-1', 'ECE314', 'ECE314', scored)).toThrow(/already the system's recommended course/);
  });

  it('addAdvisorAlternateProposal allows a genuinely different course for the same slot', () => {
    db.addProposalsFromPlan('ahmed-1', [candidate('ECE314')]);
    const alt = db.addAdvisorAlternateProposal('ahmed-1', 'ECE314', 'ECE322', scored);
    expect(alt.courseCode).toBe('ECE322');
    expect(alt.origin).toBe('advisor');
  });

  it('previewAdvisorAlternate throws the same guard before persisting anything', () => {
    db.addProposalsFromPlan('ahmed-1', [candidate('ECE314')]);
    const before = db.getProposals('ahmed-1').length; // ahmed-1 seeds with one unrelated registered proposal already
    expect(() => db.previewAdvisorAlternate('ahmed-1', 'ECE314', 'ECE314', scored)).toThrow(/already the system's recommended course/);
    expect(db.getProposals('ahmed-1')).toHaveLength(before); // nothing persisted by the throwing preview
  });

  it('the guard only fires while the system proposal is still live (declined slots are free to reuse)', () => {
    db.addProposalsFromPlan('ahmed-1', [candidate('ECE314')]);
    const sysProposal = db.getProposals('ahmed-1').find(p => p.slotKey === 'ECE314' && p.origin === 'system')!;
    db.declineProposalById(sysProposal.id);
    const alt = db.addAdvisorAlternateProposal('ahmed-1', 'ECE314', 'ECE314', scored);
    expect(alt.courseCode).toBe('ECE314'); // now allowed — the system's recommendation is no longer live
  });
});

// "Approve all" — the advisor accepting the system's whole plan in one
// click instead of clicking Approve on every slot.
describe('approveAllPendingSystemProposals', () => {
  function candidate(courseCode: string) {
    return {
      courseCode, isRetake: false, oldPoints: null,
      expectedPct: 80, expectedLetter: 'B', expectedPoints: 3.0,
      deltaPts: null, chainUnlockValue: 2, passRate: 85, score: 50, mandatory: false,
    };
  }

  it('approves every pending system proposal for the student', () => {
    db.addProposalsFromPlan('ahmed-1', [candidate('ECE314'), candidate('ECE316')]);
    db.approveAllPendingSystemProposals('ahmed-1');
    const proposals = db.getProposals('ahmed-1').filter(p => ['ECE314', 'ECE316'].includes(p.slotKey));
    expect(proposals.every(p => p.status === 'advisor_approved' && p.advisorApproved)).toBe(true);
  });

  it('leaves a slot alone once the advisor has already replaced it with their own alternate', () => {
    db.addProposalsFromPlan('ahmed-1', [candidate('ECE314'), candidate('ECE316')]);
    db.addAdvisorAlternateProposal('ahmed-1', 'ECE314', 'ECE322', { expectedPct: 84, expectedLetter: 'B', expectedPoints: 3.0 });
    db.approveAllPendingSystemProposals('ahmed-1');
    const all = db.getProposals('ahmed-1');
    // the system's original ECE314 proposal stays pending, untouched, underneath the advisor's alternate
    expect(all.find(p => p.slotKey === 'ECE314' && p.origin === 'system')!.status).toBe('pending');
    expect(all.find(p => p.slotKey === 'ECE314' && p.origin === 'advisor')!.status).toBe('advisor_approved');
    // the untouched slot is bulk-approved as normal
    expect(all.find(p => p.slotKey === 'ECE316')!.status).toBe('advisor_approved');
  });

  it('is idempotent and never touches a declined proposal', () => {
    db.addProposalsFromPlan('ahmed-1', [candidate('ECE314')]);
    const p = db.getProposals('ahmed-1').find(x => x.slotKey === 'ECE314')!;
    db.declineProposalById(p.id);
    db.approveAllPendingSystemProposals('ahmed-1');
    expect(db.getProposals('ahmed-1').find(x => x.slotKey === 'ECE314')!.status).toBe('declined');
  });

  it('throws for an unknown student', () => {
    expect(() => db.approveAllPendingSystemProposals('nobody')).toThrow();
  });
});
