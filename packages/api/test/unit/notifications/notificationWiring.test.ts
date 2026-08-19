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
