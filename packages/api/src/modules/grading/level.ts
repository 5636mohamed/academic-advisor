// Spec §2.3 (levels) and §2.4 (EXTENDED three-tier credit cap)
export function levelFromCredits(cr: number): number {
  if (cr >= 144) return 5;
  if (cr >= 108) return 4;
  if (cr >= 72) return 3;
  if (cr >= 36) return 2;
  return 1;
}

export interface CreditCapContext {
  /** true only for the semester immediately following a Level-1 first semester
   *  (or a faculty-transfer's Transfer Semester, per the §7.2.3 extension)
   *  whose GPA landed below 2.00 — the half-load trigger, §4.5. */
  isPostLowFirstSemester: boolean;
  cgpa: number;
  /** Defaults true. A brand-new student's cgpa is 0 not because of poor
   *  performance but because there's no grade yet at all — the cold-start
   *  trial case (a real Level-1/semester-1 student with zero completed
   *  courses) surfaced this: without this flag, cgpa=0 < 2.00 tripped the
   *  same "reduced due to probation" cap a student who actually EARNED a
   *  sub-2.0 GPA gets, which is a real, misleading claim to show someone
   *  who's never taken an exam yet. Every other real caller has genuine
   *  completed coursework, so this stays a narrow, backward-compatible
   *  opt-out rather than changing default behavior anywhere else. */
  hasCompletedAnyCourse?: boolean;
}

/** Precedence, exactly as specified in §12's edge-case checklist:
 *  1) half-load (16) — only the single semester right after a low first/transfer semester
 *  2) probation (14) — cgpa < 2.00, and only once there's real coursework behind that number
 *  3) normal (20)
 */
export function creditCapFor(ctx: CreditCapContext): 16 | 14 | 20 {
  if (ctx.isPostLowFirstSemester) return 16;
  if (ctx.cgpa < 2.00 && (ctx.hasCompletedAnyCourse ?? true)) return 14;
  return 20;
}

export const MIN_CREDITS_NORMAL = 14;
export const LEVEL_THRESHOLDS = [0, 36, 72, 108, 144, 160];
