// Demo credential scheme for the redesigned login (login.pdf) — still not a
// real auth backend (no server-side session, no hashing), just a client-side
// gate on top of the same three `loginAsX` calls AuthContext always had, per
// the user's explicit ask for real id/password pairs instead of a bare
// picker list. Every student/professor's email is DERIVED from their real
// seeded id (never a second hardcoded roster that could drift from the
// actual data) — only the two shared passwords and the one fixed advisor
// account are hardcoded. See docs/LOGIN_CREDENTIALS.md for the full,
// human-readable roster this same pattern produces.
export const ADVISOR_EMAIL = 'advisor@ejust.edu.eg';
export const ADVISOR_PASSWORD = 'admin';

/** Shared by every seeded student — this is a demo, not a real credential
 *  store, so one memorable password for the whole roster is more useful
 *  than 13 unique ones nobody could guess anyway. */
export const STUDENT_PASSWORD = 'Student@123';
export const PROFESSOR_PASSWORD = 'Professor@123';

export function studentEmailFor(studentId: string): string {
  return `${studentId}@ejust.edu.eg`;
}

export function professorEmailFor(professorId: string): string {
  return `${professorId}@ejust.edu.eg`;
}
