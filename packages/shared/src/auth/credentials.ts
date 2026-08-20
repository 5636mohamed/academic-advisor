// Demo credential scheme, shared between the frontend's login form
// (packages/web/src/pages/Login/Login.tsx, which imports these for
// display/legacy reasons) and the backend's real login route
// (packages/api/src/modules/auth/session.service.ts) — moved here (from
// packages/web/src/auth/credentials.ts) so both sides resolve an email to
// an identity via the EXACT same derivation, not two copies that could
// drift. See docs/LOGIN_CREDENTIALS.md for the full, human-readable
// roster this same pattern produces. (There is no professor login — see
// AuthContext.tsx's header comment for why that role was removed.)
//
// Still a demo credential scheme, not a real per-user credential store —
// one shared password per role (student/advisor) plus one fixed Vice
// President account, all publicly documented on purpose. What changed
// (see the auth epic this file is part of) is that these are now actually
// verified server-side via a real hashed-password check
// (authPassword.service.ts) and a real session token, not just a
// client-side `===` — hashing a known-public demo string doesn't make it
// secret, it exercises the same verification primitive a future real
// per-user-password swap would need.

/** Shared by every seeded student/advisor — this is a demo, not a real
 *  credential store, so one memorable password per role is more useful
 *  than a unique one per person nobody could guess anyway. */
export const STUDENT_PASSWORD = 'Student@123';
export const ADVISOR_PASSWORD = 'Advisor@123';

/** Single global account — one Vice President oversees every advisor,
 *  same "one shared identity" shape the old pre-multi-advisor advisor
 *  login used to have. */
export const VP_EMAIL = 'vice-president@aegis.edu.eg';
export const VP_PASSWORD = 'AEGIS@2025';

/** "Ahmed Mostafa" -> "ahmed.mostafa"; also strips a title prefix ("Prof. ",
 *  "Dr. ") and any trailing parenthetical scenario annotation some named
 *  personas' display names carry (e.g. "Omar Fahmy (warning 1/6)" -> just
 *  "omar.fahmy") — those annotations are a deliberate demo-readability
 *  feature of the display name, not part of anyone's actual name, so they
 *  never belong in an email address. */
export function emailLocalPartFor(fullName: string): string {
  const withoutAnnotation = fullName.split('(')[0].trim();
  const withoutTitle = withoutAnnotation.replace(/^(Prof\.|Dr\.)\s+/i, '');
  return withoutTitle
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2) // first + last; a middle/extra name doesn't also need to be in the address
    .map(part => part.toLowerCase().replace(/[^a-z]/g, ''))
    .join('.');
}

export function studentEmailFor(name: string): string {
  return `${emailLocalPartFor(name)}@aegis.edu.eg`;
}

export function advisorEmailFor(name: string): string {
  return `${emailLocalPartFor(name)}@aegis.edu.eg`;
}
