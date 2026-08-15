// Spec §4.1 dismissal trigger + §12 lockout rule (dismissed students are
// fully locked out at the API layer, not just hidden in the UI).
import { DISMISSAL_THRESHOLD } from '@advisor/shared';

export function isDismissed(count: number): boolean {
  return count >= DISMISSAL_THRESHOLD;
}

export class DismissedStudentError extends Error {
  constructor(studentId: string) {
    super(`Student ${studentId} is dismissed and cannot access advising/registration endpoints.`);
    this.name = 'DismissedStudentError';
  }
}

/** Call at the top of every /advise, /transfer/*, and registration route.
 *  Spec §12: "Dismissed students must be fully locked out ... at the API
 *  layer (403), not just hidden in the UI." */
export function assertNotDismissed(studentId: string, currentCount: number): void {
  if (isDismissed(currentCount)) {
    throw new DismissedStudentError(studentId);
  }
}
