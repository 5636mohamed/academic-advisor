import { describe, it, expect, vi } from 'vitest';
import { login } from '../../../src/modules/auth/session.service';
import { STUDENT_PASSWORD, ADVISOR_PASSWORD, VP_EMAIL, VP_PASSWORD } from '@advisor/shared';

const ADVISORS = [{ id: 'advisor-nabil', name: 'Prof. Nabil Fathy' }];
const STUDENTS = [{ id: 'ahmed-1', name: 'Ahmed Mostafa' }];

function fakePorts() {
  const createSession = vi.fn((role, id) => ({ token: `tok-${role}-${id}`, role, id, expiresAt: Date.now() + 1000 }));
  return { listAdvisors: () => ADVISORS, listStudents: () => STUDENTS, createSession };
}

describe('login (real backend authentication epic)', () => {
  it('the VP logs in with the exact VP email/password', () => {
    const ports = fakePorts();
    const result = login(VP_EMAIL, VP_PASSWORD, ports);
    expect(result).toEqual({ token: 'tok-vice_president-null', role: 'vice_president', id: null });
    expect(ports.createSession).toHaveBeenCalledWith('vice_president', null);
  });

  it('an advisor logs in via their derived email + the shared advisor password', () => {
    const ports = fakePorts();
    const result = login('nabil.fathy@aegis.edu.eg', ADVISOR_PASSWORD, ports);
    expect(result).toEqual({ token: 'tok-advisor-advisor-nabil', role: 'advisor', id: 'advisor-nabil' });
  });

  it('a student logs in via their derived email + the shared student password', () => {
    const ports = fakePorts();
    const result = login('ahmed.mostafa@aegis.edu.eg', STUDENT_PASSWORD, ports);
    expect(result).toEqual({ token: 'tok-student-ahmed-1', role: 'student', id: 'ahmed-1' });
  });

  it('email matching is case-insensitive (real users retype emails inconsistently)', () => {
    const ports = fakePorts();
    const result = login('AHMED.MOSTAFA@AEGIS.EDU.EG', STUDENT_PASSWORD, ports);
    expect(result?.role).toBe('student');
  });

  it('rejects a real email with the WRONG password', () => {
    const ports = fakePorts();
    expect(login('ahmed.mostafa@aegis.edu.eg', 'wrong-password', ports)).toBeNull();
    expect(ports.createSession).not.toHaveBeenCalled();
  });

  it('rejects an email that matches no advisor, student, or the VP', () => {
    const ports = fakePorts();
    expect(login('nobody@aegis.edu.eg', STUDENT_PASSWORD, ports)).toBeNull();
  });

  it('an advisor email typed with the STUDENT password is rejected (roles do not cross-authenticate)', () => {
    const ports = fakePorts();
    expect(login('nabil.fathy@aegis.edu.eg', STUDENT_PASSWORD, ports)).toBeNull();
  });
});
