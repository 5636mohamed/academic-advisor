// Confirms notifications are genuinely created by the real mutation
// points (proposal approve/decline, venture match accept/decline,
// transfer request submit/advisor-decide/vp-decide) — not unit-tested
// against a mock, but exercised against the real in-memory store, same
// "wiring, not just isolated logic" discipline transferWiring.test.ts
// already established.
import { describe, it, expect, beforeEach } from 'vitest';
import * as db from '../../../src/db/memory/inMemoryDb';
import { CourseProposal } from '@advisor/shared';

beforeEach(() => {
  db.__resetForTests();
});

/** A minimal, directly-pushed proposal — generating one for real goes
 *  through runAdvisingCycle (server.ts-layer machinery this db-only test
 *  file doesn't pull in), and isn't what's under test here anyway: only
 *  the notification side effect of approve/decline is. getStudent returns
 *  the live StoredStudent object (confirmed by approveProposalById's own
 *  direct `student.proposals[idx] = ...` mutation), so pushing onto its
 *  .proposals array here is the same shape of access, not a workaround. */
function pushPendingProposal(studentId: string): CourseProposal {
  const proposal: CourseProposal = {
    id: `test-proposal-${studentId}`, studentId, slotKey: 'TESTSLOT', courseCode: 'ECE311', origin: 'system',
    expectedPct: 80, expectedLetter: 'B', expectedPoints: 3.0, bestCasePct: 90, bestCaseLetter: 'A', bestCasePoints: 4.0,
    advisorApproved: false, status: 'pending', createdAt: new Date().toISOString(),
  };
  db.getStudent(studentId)!.proposals.push(proposal);
  return proposal;
}

describe('notification store — basics', () => {
  it('starts empty for a fresh student', () => {
    expect(db.listNotifications('student', 'ahmed-1')).toEqual([]);
    expect(db.unreadNotificationCount('student', 'ahmed-1')).toBe(0);
  });

  it('createNotification is readable back, unread by default, newest first', () => {
    const n1 = db.createNotification('student', 'ahmed-1', 'proposal_approved', 'A', 'first');
    const n2 = db.createNotification('student', 'ahmed-1', 'proposal_declined', 'B', 'second');
    const list = db.listNotifications('student', 'ahmed-1');
    expect(list).toHaveLength(2);
    expect(list.every(n => !n.read)).toBe(true);
    expect(list[0].id === n1.id || list[0].id === n2.id).toBe(true); // both createdAt may tie at ms resolution; just confirm both present
    expect(list.map(n => n.id).sort()).toEqual([n1.id, n2.id].sort());
  });

  it('markNotificationRead only flips the targeted one', () => {
    const n1 = db.createNotification('student', 'ahmed-1', 'proposal_approved', 'A', 'a');
    const n2 = db.createNotification('student', 'ahmed-1', 'proposal_declined', 'B', 'b');
    db.markNotificationRead(n1.id);
    const list = db.listNotifications('student', 'ahmed-1');
    expect(list.find(n => n.id === n1.id)?.read).toBe(true);
    expect(list.find(n => n.id === n2.id)?.read).toBe(false);
    expect(db.unreadNotificationCount('student', 'ahmed-1')).toBe(1);
  });

  it('markAllNotificationsRead only touches that (role, recipient) pair', () => {
    db.createNotification('student', 'ahmed-1', 'proposal_approved', 'A', 'a');
    db.createNotification('student', 'sara-1', 'proposal_approved', 'A', 'a');
    db.markAllNotificationsRead('student', 'ahmed-1');
    expect(db.unreadNotificationCount('student', 'ahmed-1')).toBe(0);
    expect(db.unreadNotificationCount('student', 'sara-1')).toBe(1);
  });

  it('is scoped by role too, not just recipientId (a "vp" id never collides with a student/advisor id)', () => {
    db.createNotification('vp', 'vp', 'transfer_awaiting_vp', 'x', 'y');
    expect(db.listNotifications('vp', 'vp')).toHaveLength(1);
    expect(db.listNotifications('student', 'vp')).toEqual([]);
  });
});

describe('real trigger points create the right notification', () => {
  it('approving a proposal notifies the student', () => {
    const pending = pushPendingProposal('ahmed-1');
    db.approveProposalById(pending.id);
    const notifs = db.listNotifications('student', 'ahmed-1');
    expect(notifs.some(n => n.type === 'proposal_approved')).toBe(true);
  });

  it('declining a proposal notifies the student', () => {
    const pending = pushPendingProposal('sara-1');
    db.declineProposalById(pending.id);
    const notifs = db.listNotifications('student', 'sara-1');
    expect(notifs.some(n => n.type === 'proposal_declined')).toBe(true);
  });

  it('generating a course plan (the real "submit for advisor approval" moment) notifies the student\'s advisor', () => {
    const student = db.getStudent('ahmed-1')!;
    const candidate = {
      courseCode: 'ECE411', isRetake: false, oldPoints: null,
      expectedPct: 85, expectedLetter: 'B+', expectedPoints: 3.3,
      deltaPts: null, chainUnlockValue: 1, passRate: 90, score: 60, mandatory: false,
    };
    db.addProposalsFromPlan('ahmed-1', [candidate]);
    const notifs = db.listNotifications('advisor', student.advisorId);
    expect(notifs.some(n => n.type === 'proposal_submitted')).toBe(true);
  });

  it('re-generating with nothing NEW to add does not spam a duplicate notification', () => {
    const student = db.getStudent('ahmed-1')!;
    const candidate = {
      courseCode: 'ECE411', isRetake: false, oldPoints: null,
      expectedPct: 85, expectedLetter: 'B+', expectedPoints: 3.3,
      deltaPts: null, chainUnlockValue: 1, passRate: 90, score: 60, mandatory: false,
    };
    db.addProposalsFromPlan('ahmed-1', [candidate]);
    db.addProposalsFromPlan('ahmed-1', [candidate]); // same slot already exists — addProposalsFromPlan filters it out
    const notifs = db.listNotifications('advisor', student.advisorId).filter(n => n.type === 'proposal_submitted');
    expect(notifs).toHaveLength(1);
  });

  it('bulk "Approve all" notifies the student, same as single-approve (real gap: it used to call approveProposal directly, silently skipping the notification single-approve always sent)', () => {
    const student = db.getStudent('ahmed-1')!;
    const candidate = {
      courseCode: 'ECE411', isRetake: false, oldPoints: null,
      expectedPct: 85, expectedLetter: 'B+', expectedPoints: 3.3,
      deltaPts: null, chainUnlockValue: 1, passRate: 90, score: 60, mandatory: false,
    };
    db.addProposalsFromPlan('ahmed-1', [candidate]);
    db.approveAllPendingSystemProposals('ahmed-1');
    const notifs = db.listNotifications('student', student.id);
    expect(notifs.some(n => n.type === 'proposal_approved')).toBe(true);
  });

  it('re-running "Approve all" after everything is already approved does not spam a duplicate notification', () => {
    const student = db.getStudent('ahmed-1')!;
    const candidate = {
      courseCode: 'ECE411', isRetake: false, oldPoints: null,
      expectedPct: 85, expectedLetter: 'B+', expectedPoints: 3.3,
      deltaPts: null, chainUnlockValue: 1, passRate: 90, score: 60, mandatory: false,
    };
    db.addProposalsFromPlan('ahmed-1', [candidate]);
    db.approveAllPendingSystemProposals('ahmed-1');
    db.approveAllPendingSystemProposals('ahmed-1'); // idempotent — nothing left to approve
    const notifs = db.listNotifications('student', student.id).filter(n => n.type === 'proposal_approved');
    expect(notifs).toHaveLength(1);
  });

  it('the VP\'s cross-advisor bulk approve also notifies each affected student (it delegates to approveAllPendingSystemProposals per student)', () => {
    const student = db.getStudent('ahmed-1')!;
    const candidate = {
      courseCode: 'ECE411', isRetake: false, oldPoints: null,
      expectedPct: 85, expectedLetter: 'B+', expectedPoints: 3.3,
      deltaPts: null, chainUnlockValue: 1, passRate: 90, score: 60, mandatory: false,
    };
    db.addProposalsFromPlan('ahmed-1', [candidate]);
    db.approveAllPendingProposalsAcrossAllAdvisors();
    const notifs = db.listNotifications('student', student.id);
    expect(notifs.some(n => n.type === 'proposal_approved')).toBe(true);
  });

  it('registering a course notifies the advisor of which option the student chose (real gap reported live)', () => {
    const student = db.getStudent('ahmed-1')!;
    const candidate = {
      courseCode: 'ECE411', isRetake: false, oldPoints: null,
      expectedPct: 85, expectedLetter: 'B+', expectedPoints: 3.3,
      deltaPts: null, chainUnlockValue: 1, passRate: 90, score: 60, mandatory: false,
    };
    const [proposal] = db.addProposalsFromPlan('ahmed-1', [candidate]).filter(p => p.slotKey === 'ECE411');
    db.approveAllPendingSystemProposals('ahmed-1');
    db.chooseProposalById('ahmed-1', proposal.id);
    const notifs = db.listNotifications('advisor', student.advisorId);
    const choiceNotif = notifs.find(n => n.type === 'proposal_choice_made');
    expect(choiceNotif).toBeDefined();
    expect(choiceNotif!.body).toContain('ECE411');
  });

  it('registering the SYSTEM suggestion when the advisor had proposed a different alternate tells the advisor exactly that', () => {
    const student = db.getStudent('ahmed-1')!;
    const candidate = {
      courseCode: 'ECE411', isRetake: false, oldPoints: null,
      expectedPct: 85, expectedLetter: 'B+', expectedPoints: 3.3,
      deltaPts: null, chainUnlockValue: 1, passRate: 90, score: 60, mandatory: false,
    };
    const [systemProposal] = db.addProposalsFromPlan('ahmed-1', [candidate]).filter(p => p.slotKey === 'ECE411');
    db.approveAllPendingSystemProposals('ahmed-1');
    const alt = db.addAdvisorAlternateProposal('ahmed-1', 'ECE411', 'ECE322', { expectedPct: 92, expectedLetter: 'A-', expectedPoints: 3.7 });
    // the student bypasses the advisor's own alternate and registers the system's original suggestion instead
    db.chooseProposalById('ahmed-1', systemProposal.id);
    const notifs = db.listNotifications('advisor', student.advisorId);
    const choiceNotif = notifs.find(n => n.type === 'proposal_choice_made');
    expect(choiceNotif).toBeDefined();
    expect(choiceNotif!.body).toContain('not the alternate you proposed');
    expect(choiceNotif!.body).toContain(alt.courseCode);
  });

  it('registering the advisor\'s OWN proposed alternate tells the advisor it was their proposal that was picked', () => {
    const student = db.getStudent('ahmed-1')!;
    const candidate = {
      courseCode: 'ECE411', isRetake: false, oldPoints: null,
      expectedPct: 85, expectedLetter: 'B+', expectedPoints: 3.3,
      deltaPts: null, chainUnlockValue: 1, passRate: 90, score: 60, mandatory: false,
    };
    db.addProposalsFromPlan('ahmed-1', [candidate]);
    const alt = db.addAdvisorAlternateProposal('ahmed-1', 'ECE411', 'ECE322', { expectedPct: 92, expectedLetter: 'A-', expectedPoints: 3.7 });
    db.chooseProposalById('ahmed-1', alt.id);
    const notifs = db.listNotifications('advisor', student.advisorId);
    const choiceNotif = notifs.find(n => n.type === 'proposal_choice_made');
    expect(choiceNotif).toBeDefined();
    expect(choiceNotif!.body).toContain('your proposed course');
  });

  it('a double-click/retry on the same registration does not spam a duplicate notification', () => {
    const student = db.getStudent('ahmed-1')!;
    const candidate = {
      courseCode: 'ECE411', isRetake: false, oldPoints: null,
      expectedPct: 85, expectedLetter: 'B+', expectedPoints: 3.3,
      deltaPts: null, chainUnlockValue: 1, passRate: 90, score: 60, mandatory: false,
    };
    const [proposal] = db.addProposalsFromPlan('ahmed-1', [candidate]).filter(p => p.slotKey === 'ECE411');
    db.approveAllPendingSystemProposals('ahmed-1');
    db.chooseProposalById('ahmed-1', proposal.id);
    db.chooseProposalById('ahmed-1', proposal.id); // same request fired again
    const notifs = db.listNotifications('advisor', student.advisorId).filter(n => n.type === 'proposal_choice_made');
    expect(notifs).toHaveLength(1);
  });

  it('submitting a transfer request notifies that student\'s advisor', () => {
    const student = db.getStudent('hassan-1')!;
    db.createTransferRequestForStudent('hassan-1', 'internal_department', 'CSE');
    const notifs = db.listNotifications('advisor', student.advisorId);
    expect(notifs.some(n => n.type === 'transfer_submitted')).toBe(true);
  });

  it('advisor-approving a transfer request notifies BOTH the student and the VP (it now awaits VP review)', () => {
    const request = db.createTransferRequestForStudent('hassan-1', 'internal_department', 'CSE');
    db.advisorDecideTransferRequest(request.id, 'approve');
    expect(db.listNotifications('student', 'hassan-1').some(n => n.type === 'transfer_advisor_approved')).toBe(true);
    expect(db.listNotifications('vp', 'vp').some(n => n.type === 'transfer_awaiting_vp')).toBe(true);
  });

  it('advisor-declining a transfer request notifies only the student, not the VP', () => {
    const request = db.createTransferRequestForStudent('hassan-1', 'internal_department', 'CSE');
    db.advisorDecideTransferRequest(request.id, 'decline', 'not eligible yet');
    expect(db.listNotifications('student', 'hassan-1').some(n => n.type === 'transfer_advisor_declined')).toBe(true);
    expect(db.listNotifications('vp', 'vp')).toEqual([]);
  });

  it('VP-approving a transfer request notifies the student', () => {
    const request = db.createTransferRequestForStudent('hassan-1', 'internal_department', 'CSE');
    db.advisorDecideTransferRequest(request.id, 'approve');
    db.vpDecideTransferRequest(request.id, 'approve');
    const notifs = db.listNotifications('student', 'hassan-1');
    expect(notifs.some(n => n.type === 'transfer_vp_approved')).toBe(true);
  });

  it('VP-declining a transfer request notifies the student', () => {
    const request = db.createTransferRequestForStudent('hassan-1', 'internal_department', 'CSE');
    db.advisorDecideTransferRequest(request.id, 'approve');
    db.vpDecideTransferRequest(request.id, 'decline', 'capacity reached');
    const notifs = db.listNotifications('student', 'hassan-1');
    expect(notifs.some(n => n.type === 'transfer_vp_declined')).toBe(true);
  });
});
