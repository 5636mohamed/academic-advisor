// Demo credential scheme for the redesigned login (login.pdf) — still not a
// real auth backend (no server-side session, no hashing), just a client-side
// gate on top of the loginAsX calls AuthContext provides, per the user's
// explicit ask for real id/password pairs instead of a bare picker list.
// Every student/advisor's email is DERIVED from their real seeded NAME
// (firstname.lastname@aegis.edu.eg — never a second hardcoded roster that
// could drift from the actual data) — only the shared passwords and the one
// fixed Vice President account are hardcoded. See docs/LOGIN_CREDENTIALS.md
// for the full, human-readable roster this same pattern produces. (There is
// no professor login — see AuthContext.tsx's header comment for why that
// role was removed.)

/** Shared by every seeded student/advisor — this is a demo, not a real
 *  credential store, so one memorable password per role is more useful
 *  than a unique one per person nobody could guess anyway. */
export const STUDENT_PASSWORD = 'Student@123';
export const ADVISOR_PASSWORD = 'Advisor@123';

/** Single global account — one Vice President oversees all 5 advisors,
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
function emailLocalPartFor(fullName: string): string {
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
