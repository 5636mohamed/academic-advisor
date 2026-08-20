import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../../src/modules/auth/authPassword.service';

describe('authPassword.service (real backend authentication epic)', () => {
  it('verifies the correct plaintext against its own hash', () => {
    const hash = hashPassword('Student@123');
    expect(verifyPassword('Student@123', hash)).toBe(true);
  });

  it('rejects an incorrect plaintext', () => {
    const hash = hashPassword('Student@123');
    expect(verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('two hashes of the SAME plaintext are different (real per-call salt, not a deterministic hash)', () => {
    const a = hashPassword('Advisor@123');
    const b = hashPassword('Advisor@123');
    expect(a).not.toBe(b);
    // both still verify correctly despite differing
    expect(verifyPassword('Advisor@123', a)).toBe(true);
    expect(verifyPassword('Advisor@123', b)).toBe(true);
  });

  it('a malformed stored hash (missing salt/hash separator) fails closed, not open', () => {
    expect(verifyPassword('Student@123', 'not-a-real-hash')).toBe(false);
    expect(verifyPassword('Student@123', '')).toBe(false);
  });

  it('is case- and whitespace-sensitive (no accidental normalization)', () => {
    const hash = hashPassword('AEGIS@2025');
    expect(verifyPassword('aegis@2025', hash)).toBe(false);
    expect(verifyPassword('AEGIS@2025 ', hash)).toBe(false);
  });
});
