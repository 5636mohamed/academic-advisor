// No supertest/full-Express-app dependency in this codebase — these guards
// are pure `(req, res, next)` functions, so hand-rolled minimal req/res
// doubles are enough to exercise every branch without spinning up a real
// server, matching this codebase's general preference for testing logic
// directly rather than through an HTTP round-trip.
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import { authenticate, requireAuthRole, requireStudentAccess, requireAdvisorAccess, GuardPorts } from '../../../src/modules/auth/guards';

function fakeReq(overrides: Partial<{ headers: Record<string, string>; params: Record<string, string>; auth: { role: string; id: string | null } }> = {}) {
  const headers = overrides.headers ?? {};
  return {
    header: (name: string) => headers[name.toLowerCase()],
    params: overrides.params ?? {},
    auth: overrides.auth,
  } as unknown as express.Request;
}

function fakeRes() {
  const res: Record<string, unknown> = {};
  res.statusCode = 200;
  res.status = vi.fn((code: number) => { res.statusCode = code; return res; });
  res.json = vi.fn();
  return res as unknown as express.Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn>; statusCode: number };
}

describe('authenticate', () => {
  const ports: GuardPorts = {
    getSession: (token: string) => (token === 'valid-token' ? { token, role: 'advisor', id: 'advisor-nabil', expiresAt: Date.now() + 1000 } : null),
    getStudentAdvisorId: () => null,
  };

  it('401s when there is no Authorization header at all', () => {
    const req = fakeReq();
    const res = fakeRes();
    const next = vi.fn();
    authenticate(ports)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('401s on a malformed header (not "Bearer <token>")', () => {
    const req = fakeReq({ headers: { authorization: 'Basic abc123' } });
    const res = fakeRes();
    const next = vi.fn();
    authenticate(ports)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('401s on a well-formed but invalid/expired token', () => {
    const req = fakeReq({ headers: { authorization: 'Bearer garbage-token' } });
    const res = fakeRes();
    const next = vi.fn();
    authenticate(ports)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('sets req.auth and calls next() on a valid token', () => {
    const req = fakeReq({ headers: { authorization: 'Bearer valid-token' } });
    const res = fakeRes();
    const next = vi.fn();
    authenticate(ports)(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.auth).toEqual({ role: 'advisor', id: 'advisor-nabil' });
  });
});

describe('requireAuthRole', () => {
  it('calls next() when the role matches', () => {
    const req = fakeReq({ auth: { role: 'vice_president', id: null } });
    const res = fakeRes();
    const next = vi.fn();
    requireAuthRole('vice_president')(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('403s when the role does not match any allowed role', () => {
    const req = fakeReq({ auth: { role: 'student', id: 'ahmed-1' } });
    const res = fakeRes();
    const next = vi.fn();
    requireAuthRole('advisor', 'vice_president')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireStudentAccess (real roster-ownership check — the actual gap this epic closes)', () => {
  const ports: GuardPorts = {
    getSession: () => null,
    getStudentAdvisorId: (studentId: string) => (studentId === 'ahmed-1' ? 'advisor-nabil' : studentId === 'sara-1' ? 'advisor-mervat' : null),
  };

  it('the VP can access ANY student', () => {
    const req = fakeReq({ params: { id: 'ahmed-1' }, auth: { role: 'vice_president', id: null } });
    const res = fakeRes();
    const next = vi.fn();
    requireStudentAccess(ports)(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('a student can access their OWN record', () => {
    const req = fakeReq({ params: { id: 'ahmed-1' }, auth: { role: 'student', id: 'ahmed-1' } });
    const res = fakeRes();
    const next = vi.fn();
    requireStudentAccess(ports)(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("a student CANNOT access another student's record", () => {
    const req = fakeReq({ params: { id: 'sara-1' }, auth: { role: 'student', id: 'ahmed-1' } });
    const res = fakeRes();
    const next = vi.fn();
    requireStudentAccess(ports)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("an advisor CAN access a student on their OWN roster", () => {
    const req = fakeReq({ params: { id: 'ahmed-1' }, auth: { role: 'advisor', id: 'advisor-nabil' } });
    const res = fakeRes();
    const next = vi.fn();
    requireStudentAccess(ports)(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("an advisor CANNOT access a student on a DIFFERENT advisor's roster (the real gap this closes)", () => {
    const req = fakeReq({ params: { id: 'sara-1' }, auth: { role: 'advisor', id: 'advisor-nabil' } });
    const res = fakeRes();
    const next = vi.fn();
    requireStudentAccess(ports)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('404s when the target student does not exist at all', () => {
    const req = fakeReq({ params: { id: 'ghost-1' }, auth: { role: 'advisor', id: 'advisor-nabil' } });
    const res = fakeRes();
    const next = vi.fn();
    requireStudentAccess(ports)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('requireAdvisorAccess', () => {
  it('the VP can access ANY advisor-scoped route', () => {
    const req = fakeReq({ params: { advisorId: 'advisor-nabil' }, auth: { role: 'vice_president', id: null } });
    const res = fakeRes();
    const next = vi.fn();
    requireAdvisorAccess()(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('an advisor can access their OWN advisor-scoped route', () => {
    const req = fakeReq({ params: { advisorId: 'advisor-nabil' }, auth: { role: 'advisor', id: 'advisor-nabil' } });
    const res = fakeRes();
    const next = vi.fn();
    requireAdvisorAccess()(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("an advisor CANNOT access a DIFFERENT advisor's scoped route", () => {
    const req = fakeReq({ params: { advisorId: 'advisor-mervat' }, auth: { role: 'advisor', id: 'advisor-nabil' } });
    const res = fakeRes();
    const next = vi.fn();
    requireAdvisorAccess()(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('a student can NEVER access an advisor-scoped route', () => {
    const req = fakeReq({ params: { advisorId: 'advisor-nabil' }, auth: { role: 'student', id: 'ahmed-1' } });
    const res = fakeRes();
    const next = vi.fn();
    requireAdvisorAccess()(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
