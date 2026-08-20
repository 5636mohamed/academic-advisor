// Real backend authentication epic — POST /api/auth/login's actual logic,
// factored out of server.ts so it's independently unit-testable (same
// "route handler stays thin, the real logic lives in a pure-ish service"
// discipline every other module in this codebase already follows).
//
// Mirrors Login.tsx's OLD client-side search order exactly (VP constant,
// then advisors, then students) so the login UX is unchanged — only WHERE
// the check happens moved, from the browser to here.
import { STUDENT_PASSWORD, ADVISOR_PASSWORD, VP_EMAIL, VP_PASSWORD, advisorEmailFor, studentEmailFor } from '@advisor/shared';
import { verifyPassword, hashPassword } from './authPassword.service';
import { AuthRole, SessionRecord } from '../../db/memory/inMemoryDb';

export interface LoginPorts {
  listAdvisors(): Array<{ id: string; name: string }>;
  listStudents(): Array<{ id: string; name: string }>;
  createSession(role: AuthRole, id: string | null): SessionRecord;
}

/** Hashed once, at module load — these 3 constants never change at
 *  runtime, so there's no reason to re-hash on every login attempt. See
 *  authPassword.service.ts's own header for why hashing a public demo
 *  string is still the right primitive to exercise here. */
const HASHED_STUDENT_PASSWORD = hashPassword(STUDENT_PASSWORD);
const HASHED_ADVISOR_PASSWORD = hashPassword(ADVISOR_PASSWORD);
const HASHED_VP_PASSWORD = hashPassword(VP_PASSWORD);

export interface LoginResult {
  token: string;
  role: AuthRole;
  id: string | null;
}

/** Returns null on any failure (wrong email, wrong password, unrecognized
 *  identity) — deliberately a single generic outcome so the route handler
 *  can return one generic 401 message, not distinguish "no such user" from
 *  "wrong password" (avoids user-enumeration via response text). */
export function login(email: string, password: string, ports: LoginPorts): LoginResult | null {
  const normalizedEmail = email.trim().toLowerCase();

  if (normalizedEmail === VP_EMAIL && verifyPassword(password, HASHED_VP_PASSWORD)) {
    const session = ports.createSession('vice_president', null);
    return { token: session.token, role: session.role, id: session.id };
  }

  const advisor = ports.listAdvisors().find(a => advisorEmailFor(a.name) === normalizedEmail);
  if (advisor && verifyPassword(password, HASHED_ADVISOR_PASSWORD)) {
    const session = ports.createSession('advisor', advisor.id);
    return { token: session.token, role: session.role, id: session.id };
  }

  const student = ports.listStudents().find(s => studentEmailFor(s.name) === normalizedEmail);
  if (student && verifyPassword(password, HASHED_STUDENT_PASSWORD)) {
    const session = ports.createSession('student', student.id);
    return { token: session.token, role: session.role, id: session.id };
  }

  return null;
}
