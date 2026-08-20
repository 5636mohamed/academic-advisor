// Real backend authentication epic — password hashing/verification, Node's
// built-in crypto only (no new dependency: the codebase's own stated
// preference throughout is "no new dependency unless justified," and
// scrypt is already in Node core — bcrypt/bcryptjs would be a new
// package for no real gain here).
//
// Still demo-grade in one specific sense worth being honest about: the 3
// passwords this hashes (STUDENT_PASSWORD/ADVISOR_PASSWORD/VP_PASSWORD,
// @advisor/shared) are shared, publicly documented constants
// (docs/LOGIN_CREDENTIALS.md), not real per-user secrets — hashing a
// known-public string doesn't make it secret. What this DOES provide for
// real: the password is now actually verified server-side (constant-time
// comparison, never the plaintext client-side `===` this replaced), and
// this is the exact primitive a future real per-user-password swap would
// reuse unchanged.
import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';

const KEY_LENGTH = 64;

/** `salt:hash`, both hex — self-contained, no separate salt column needed
 *  wherever a hash is stored. */
export function hashPassword(plaintext: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plaintext, salt, KEY_LENGTH).toString('hex');
  return `${salt}:${hash}`;
}

/** Constant-time comparison (timingSafeEqual, not `===`) so a failed
 *  verification can't leak how many leading bytes matched via response
 *  timing — the actual property "real" verification needs that a plain
 *  string compare never had. */
export function verifyPassword(plaintext: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = scryptSync(plaintext, salt, KEY_LENGTH);
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}
