// Real backend authentication epic — the guard middleware family every
// route in server.ts now composes in front of its handler. Modeled
// directly on the existing blockIfDismissed/requireRole shape already in
// server.ts (look up -> assert -> 403/404 -> next()), not a new pattern.
//
// Kept `db`-free at the type level (a small `GuardPorts` interface, same
// "route handler does the real db.* call, this file stays a pure function
// of its inputs" discipline every curriculumAnalytics/*.service.ts file in
// this codebase already follows) so these are independently unit-testable
// with synthetic fixtures, not just exercised live through server.ts.
import express from 'express';
import { AuthRole, SessionRecord } from '../../db/memory/inMemoryDb';

export interface GuardPorts {
  getSession(token: string): SessionRecord | null;
  /** Only needed by requireStudentAccess, to resolve the target student's
   *  OWN advisorId — real roster-ownership check, not just "any advisor." */
  getStudentAdvisorId(studentId: string): string | null;
}

// Augments Express's Request with the resolved identity — set once by
// `authenticate`, read by every guard/handler after it in the chain.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: { role: AuthRole; id: string | null };
    }
  }
}

function bearerToken(req: express.Request): string | null {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

/** First in the chain on every guarded route: resolves the token to a real
 *  session or 401s. Every guard after this one assumes `req.auth` is set. */
export function authenticate(ports: GuardPorts) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const token = bearerToken(req);
    const session = token ? ports.getSession(token) : null;
    if (!session) return res.status(401).json({ error: 'Not authenticated' });
    req.auth = { role: session.role, id: session.id };
    next();
  };
}

/** VP-only, advisor-only, etc. — exact role match, no ownership check
 *  (use requireStudentAccess/requireAdvisorAccess when a param also needs
 *  to match the authenticated identity, not just its role). */
export function requireAuthRole(...roles: AuthRole[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ error: `requires role: ${roles.join(' or ')}` });
    }
    next();
  };
}

/** VP: always allowed (institution-wide oversight, matches every existing
 *  VP-wide route's own scope). Advisor: only when the TARGET student is
 *  really on their own roster — a real gap this closes: previously any
 *  advisor could reach any student purely because nothing checked the URL
 *  param against who was asking. Student: only their own id. 404 (not 403)
 *  when the student doesn't exist at all, matching blockIfDismissed's own
 *  existing convention for this exact situation. */
export function requireStudentAccess(ports: GuardPorts, paramName = 'id') {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const targetId = req.params[paramName] as string | undefined;
    if (!targetId) return res.status(400).json({ error: `missing :${paramName}` });
    if (!req.auth) return res.status(401).json({ error: 'Not authenticated' });

    if (req.auth.role === 'vice_president') return next();

    if (req.auth.role === 'student') {
      if (req.auth.id === targetId) return next();
      return res.status(403).json({ error: 'forbidden' });
    }

    if (req.auth.role === 'advisor') {
      const ownerAdvisorId = ports.getStudentAdvisorId(targetId);
      if (ownerAdvisorId === null) return res.status(404).json({ error: 'student not found' });
      if (ownerAdvisorId === req.auth.id) return next();
      return res.status(403).json({ error: 'forbidden' });
    }

    return res.status(403).json({ error: 'forbidden' });
  };
}

/** For advisor ACTION routes on a student (approve/decline a proposal,
 *  pick an alternate) — VP: always. Advisor: only when they own the
 *  student's roster. Student: NEVER (unlike requireStudentAccess, which
 *  intentionally also allows the student themselves for read routes — an
 *  advisor's own approve/decline action is not something the student it's
 *  performed on should be able to trigger for themselves). 404 when the
 *  student doesn't exist, same convention as requireStudentAccess. */
export function requireAdvisorOwnsStudent(ports: GuardPorts, paramName = 'id') {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const targetId = req.params[paramName] as string | undefined;
    if (!targetId) return res.status(400).json({ error: `missing :${paramName}` });
    if (!req.auth) return res.status(401).json({ error: 'Not authenticated' });

    if (req.auth.role === 'vice_president') return next();

    if (req.auth.role === 'advisor') {
      const ownerAdvisorId = ports.getStudentAdvisorId(targetId);
      if (ownerAdvisorId === null) return res.status(404).json({ error: 'student not found' });
      if (ownerAdvisorId === req.auth.id) return next();
      return res.status(403).json({ error: 'forbidden' });
    }

    return res.status(403).json({ error: 'forbidden' });
  };
}

/** VP: always allowed. Advisor: only their own id. Student: never. */
export function requireAdvisorAccess(paramName = 'advisorId') {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const targetId = req.params[paramName] as string | undefined;
    if (!targetId) return res.status(400).json({ error: `missing :${paramName}` });
    if (!req.auth) return res.status(401).json({ error: 'Not authenticated' });

    if (req.auth.role === 'vice_president') return next();
    if (req.auth.role === 'advisor' && req.auth.id === targetId) return next();
    return res.status(403).json({ error: 'forbidden' });
  };
}
