import { describe, it, expect, beforeEach } from 'vitest';
import * as db from '../../../src/db/memory/inMemoryDb';

beforeEach(() => {
  db.__resetForTests();
});

describe('requestGrantForVentureProject', () => {
  it('the owning advisor can request a grant, and the VP is notified', () => {
    const project = db.getVentureProject('proj-lora')!; // owned by advisor-waleed after the per-advisor ownership fix
    expect(project.professorId).toBe('advisor-waleed');
    const updated = db.requestGrantForVentureProject('advisor-waleed', 'proj-lora', 5000, 'Prototype fabrication costs');
    expect(updated.grantRequest).toMatchObject({ amount: 5000, note: 'Prototype fabrication costs', status: 'pending' });
    expect(db.listNotifications('vp', 'vp').some(n => n.type === 'grant_requested')).toBe(true);
  });

  it('a different advisor cannot request a grant on a venture they do not own', () => {
    expect(() => db.requestGrantForVentureProject('advisor-nabil', 'proj-lora', 5000, 'x')).toThrow(/not this professor's project/);
  });

  it('rejects a non-positive amount', () => {
    expect(() => db.requestGrantForVentureProject('advisor-waleed', 'proj-lora', 0, 'x')).toThrow(/positive number/);
    expect(() => db.requestGrantForVentureProject('advisor-waleed', 'proj-lora', -10, 'x')).toThrow(/positive number/);
  });

  it('allowed on an archived (isActive: false) project too — funding to wrap up doesn\'t require staying active', () => {
    const archived = db.getVentureProject('proj-archived')!;
    expect(archived.isActive).toBe(false);
    const updated = db.requestGrantForVentureProject(archived.professorId, 'proj-archived', 2000, 'Final report costs');
    expect(updated.grantRequest?.status).toBe('pending');
  });

  it('blocks a second request while an earlier one is still pending', () => {
    db.requestGrantForVentureProject('advisor-waleed', 'proj-lora', 5000, 'first ask');
    expect(() => db.requestGrantForVentureProject('advisor-waleed', 'proj-lora', 3000, 'second ask')).toThrow(/already pending/);
  });
});

describe('decideVentureGrantRequest', () => {
  it('approving notifies the requesting advisor and sets status/decidedAt', () => {
    db.requestGrantForVentureProject('advisor-waleed', 'proj-lora', 5000, 'ask');
    const decided = db.decideVentureGrantRequest('proj-lora', 'approved', 'Approved from the innovation fund');
    expect(decided.grantRequest?.status).toBe('approved');
    expect(decided.grantRequest?.decidedAt).toBeTruthy();
    const notifs = db.listNotifications('advisor', 'advisor-waleed');
    expect(notifs.some(n => n.type === 'grant_decided' && /approved/.test(n.title))).toBe(true);
  });

  it('declining notifies the requesting advisor with the decision note in the body', () => {
    db.requestGrantForVentureProject('advisor-waleed', 'proj-lora', 5000, 'ask');
    db.decideVentureGrantRequest('proj-lora', 'declined', 'Budget exhausted this quarter');
    const notifs = db.listNotifications('advisor', 'advisor-waleed');
    expect(notifs.some(n => n.type === 'grant_decided' && n.body.includes('Budget exhausted this quarter'))).toBe(true);
  });

  it('throws when there is no pending request to decide', () => {
    expect(() => db.decideVentureGrantRequest('proj-lora', 'approved')).toThrow(/no pending grant request/);
  });

  it('a request can be resubmitted once the earlier one is decided', () => {
    db.requestGrantForVentureProject('advisor-waleed', 'proj-lora', 5000, 'first');
    db.decideVentureGrantRequest('proj-lora', 'declined', 'not this time');
    const second = db.requestGrantForVentureProject('advisor-waleed', 'proj-lora', 3000, 'second, smaller ask');
    expect(second.grantRequest).toMatchObject({ amount: 3000, status: 'pending' });
  });
});

describe('per-advisor venture ownership (real fix — was pooled under one shared anchor)', () => {
  it('each of the 5 real advisors owns a distinct set of the seeded ventures', () => {
    const projects = db.listVentureProjects();
    const owners = new Set(projects.map(p => p.professorId));
    expect(owners).toEqual(new Set(['advisor-waleed', 'advisor-mervat', 'advisor-nabil', 'advisor-tarek', 'advisor-hoda']));
  });

  it('a student applying to a venture notifies the REAL owning advisor, not a generic shared anchor', () => {
    db.applyToVentureProject('mona-2', 'proj-edge-ml'); // owned by advisor-mervat
    expect(db.listNotifications('advisor', 'advisor-mervat').some(n => n.type === 'venture_new_candidate')).toBe(true);
  });
});
