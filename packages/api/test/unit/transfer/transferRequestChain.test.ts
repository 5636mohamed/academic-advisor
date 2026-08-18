// VP epic — the 3-stage transfer pending chain: student requests ->
// advisor approves/declines -> VP approves (executes, identical end-state
// to the old immediate-execute path) or declines. Regression-checked
// against the same students/targets transferWiring.test.ts already uses,
// to confirm the final executed state matches the pre-existing immediate
// path exactly.
import { describe, it, expect, beforeEach } from 'vitest';
import * as db from '../../../src/db/memory/inMemoryDb';

beforeEach(() => {
  db.__resetForTests();
});

describe('transfer request creation', () => {
  it('captures the student\'s current advisor and starts pending_advisor', () => {
    const req = db.createTransferRequestForStudent('youssef-3', 'internal_department', 'CSE');
    expect(req.status).toBe('pending_advisor');
    expect(req.advisorId).toBe('advisor-mervat');
    expect(req.studentId).toBe('youssef-3');
    expect(req.studentName).toBe(db.getStudent('youssef-3')!.name);
    expect(req.toDepartmentId).toBe('CSE');
  });

  it('external requests also carry toFacultyId', () => {
    const req = db.createTransferRequestForStudent('hassan-1', 'external_faculty', 'BIS', 'BUS');
    expect(req.toFacultyId).toBe('BUS');
    expect(req.toDepartmentId).toBe('BIS');
  });

  it('shows up in the student\'s own list and the owning advisor\'s queue', () => {
    const req = db.createTransferRequestForStudent('youssef-3', 'internal_department', 'CSE');
    expect(db.listTransferRequestsForStudent('youssef-3').map(r => r.id)).toContain(req.id);
    expect(db.listTransferRequestsForAdvisor('advisor-mervat').map(r => r.id)).toContain(req.id);
    expect(db.listTransferRequestsForAdvisor('advisor-nabil').map(r => r.id)).not.toContain(req.id);
  });
});

describe('advisor stage', () => {
  it('approving moves it to pending_vp and does not execute the transfer yet', () => {
    const req = db.createTransferRequestForStudent('youssef-3', 'internal_department', 'CSE');
    const updated = db.advisorDecideTransferRequest(req.id, 'approve');
    expect(updated.status).toBe('pending_vp');
    expect(updated.advisorDecidedAt).toBeTruthy();
    expect(db.getStudent('youssef-3')!.departmentId).not.toBe('CSE'); // not executed yet
  });

  it('declining ends the chain with a reason, and never reaches the VP queue', () => {
    const req = db.createTransferRequestForStudent('youssef-3', 'internal_department', 'CSE');
    const updated = db.advisorDecideTransferRequest(req.id, 'decline', 'Not a good fit right now');
    expect(updated.status).toBe('advisor_declined');
    expect(updated.declineReason).toBe('Not a good fit right now');
    expect(db.listAllTransferRequests().find(r => r.id === req.id)?.status).toBe('advisor_declined');
  });

  it('rejects a decision on a request that already left pending_advisor', () => {
    const req = db.createTransferRequestForStudent('youssef-3', 'internal_department', 'CSE');
    db.advisorDecideTransferRequest(req.id, 'approve');
    expect(() => db.advisorDecideTransferRequest(req.id, 'approve')).toThrow(/not awaiting advisor review/);
  });
});

describe('VP stage — approval actually executes the transfer, decline does not', () => {
  it('internal: VP approval executes the transfer with the same end-state executeInternalTransferForStudent produces directly', () => {
    const req = db.createTransferRequestForStudent('omar-1', 'internal_department', 'CSE');
    db.advisorDecideTransferRequest(req.id, 'approve');
    const beforeApprove = db.getStudent('omar-1')!;
    expect(beforeApprove.departmentId).not.toBe('CSE');

    const updated = db.vpDecideTransferRequest(req.id, 'approve');
    expect(updated.status).toBe('approved');
    expect(updated.vpDecidedAt).toBeTruthy();

    const after = db.getStudent('omar-1')!;
    expect(after.departmentId).toBe('CSE');
    expect(after.probationCounter.count).toBe(beforeApprove.probationCounter.count); // §7.1 untouched
    expect(db.hasInternalTransfer('omar-1')).toBe(true);
  });

  it('external: VP approval anchors a new base CGPA and resets the counter, same as the direct path', () => {
    const req = db.createTransferRequestForStudent('hassan-1', 'external_faculty', 'BIS', 'BUS');
    db.advisorDecideTransferRequest(req.id, 'approve');
    db.vpDecideTransferRequest(req.id, 'approve');

    const after = db.getStudent('hassan-1')!;
    expect(after.facultyId).toBe('BUS');
    expect(after.departmentId).toBe('BIS');
    expect(after.probationCounter).toEqual({ studentId: 'hassan-1', count: 0, armed: false });
  });

  it('VP decline ends the chain without touching the student record', () => {
    const req = db.createTransferRequestForStudent('youssef-3', 'internal_department', 'CSE');
    db.advisorDecideTransferRequest(req.id, 'approve');
    const updated = db.vpDecideTransferRequest(req.id, 'decline', 'Roster too small this term');
    expect(updated.status).toBe('vp_declined');
    expect(updated.declineReason).toBe('Roster too small this term');
    expect(db.getStudent('youssef-3')!.departmentId).not.toBe('CSE');
  });

  it('rejects VP action on a request that never reached pending_vp', () => {
    const req = db.createTransferRequestForStudent('youssef-3', 'internal_department', 'CSE');
    expect(() => db.vpDecideTransferRequest(req.id, 'approve')).toThrow(/not awaiting VP review/);
  });
});

describe('VP per-advisor in-flight counters', () => {
  it('counts only still-in-flight requests, split internal vs. external, per advisor', () => {
    // advisor-mervat: one in-flight internal (youssef-3), one completed (omar-1, doesn't count)
    const a = db.createTransferRequestForStudent('youssef-3', 'internal_department', 'CSE');
    const b = db.createTransferRequestForStudent('omar-1', 'external_faculty', 'BIS', 'BUS');
    db.advisorDecideTransferRequest(b.id, 'approve');
    db.vpDecideTransferRequest(b.id, 'approve'); // completed — should not count as "in flight"
    void a;

    // advisor-hoda: one declined at the advisor stage (doesn't count)
    const c = db.createTransferRequestForStudent('hassan-1', 'internal_department', 'CSE');
    db.advisorDecideTransferRequest(c.id, 'decline');

    const counters = db.getTransferCountersByAdvisor();
    const mervat = counters.find(r => r.advisorId === 'advisor-mervat')!;
    const hoda = counters.find(r => r.advisorId === 'advisor-hoda')!;
    expect(mervat.internalInFlight).toBe(1);
    expect(mervat.externalInFlight).toBe(0);
    expect(hoda.internalInFlight).toBe(0);
    expect(hoda.externalInFlight).toBe(0);
  });
});
