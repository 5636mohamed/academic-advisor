// Demo credential scheme for the redesigned login (login.pdf) — still not a
// real auth backend (no server-side session, no hashing), just a client-side
// gate on top of the loginAsX calls AuthContext provides, per the user's
// explicit ask for real id/password pairs instead of a bare picker list.
// Every student/professor/advisor's email is DERIVED from their real seeded
// id (never a second hardcoded roster that could drift from the actual
// data) — only the shared passwords and the one fixed Vice President
// account are hardcoded. See docs/LOGIN_CREDENTIALS.md for the full,
// human-readable roster this same pattern produces.

/** Shared by every seeded student/advisor/professor — this is a demo, not a
 *  real credential store, so one memorable password per role is more
 *  useful than a unique one per person nobody could guess anyway. */
export const STUDENT_PASSWORD = 'Student@123';
export const PROFESSOR_PASSWORD = 'Professor@123';
export const ADVISOR_PASSWORD = 'Advisor@123';

/** Single global account — one Vice President oversees all 5 advisors,
 *  same "one shared identity" shape the old pre-multi-advisor advisor
 *  login used to have. */
export const VP_EMAIL = 'vice-president@ejust.edu.eg';
export const VP_PASSWORD = 'EJUST@2025';

export function studentEmailFor(studentId: string): string {
  return `${studentId}@ejust.edu.eg`;
}

export function professorEmailFor(professorId: string): string {
  return `${professorId}@ejust.edu.eg`;
}

export function advisorEmailFor(advisorId: string): string {
  return `${advisorId}@ejust.edu.eg`;
}
