import { describe, it, expect } from 'vitest';
import { levelFromCredits, creditCapFor } from '../../../src/modules/grading/level';

describe('creditCapFor — §2.4 three-tier precedence', () => {
  it('half-load (16) takes precedence over probation cap', () => {
    expect(creditCapFor({ isPostLowFirstSemester: true, cgpa: 1.5 })).toBe(16);
  });
  it('probation cap (14) applies when cgpa < 2.00 and not post-low-first-semester', () => {
    expect(creditCapFor({ isPostLowFirstSemester: false, cgpa: 1.9 })).toBe(14);
  });
  it('normal cap (20) otherwise', () => {
    expect(creditCapFor({ isPostLowFirstSemester: false, cgpa: 3.0 })).toBe(20);
  });
  it('hasCompletedAnyCourse defaults true — omitting it preserves the exact original behavior for every real caller', () => {
    expect(creditCapFor({ isPostLowFirstSemester: false, cgpa: 1.9 })).toBe(14);
  });
  it('a fresh student with cgpa=0 and NO completed courses gets the normal cap, not the probation cap (cold-start trial fix)', () => {
    expect(creditCapFor({ isPostLowFirstSemester: false, cgpa: 0, hasCompletedAnyCourse: false })).toBe(20);
  });
  it('a student who genuinely earned a sub-2.0 GPA still gets the probation cap even if explicitly marked hasCompletedAnyCourse', () => {
    expect(creditCapFor({ isPostLowFirstSemester: false, cgpa: 1.5, hasCompletedAnyCourse: true })).toBe(14);
  });
});

describe('levelFromCredits — §2.3', () => {
  it.each([
    [0, 1], [35, 1], [36, 2], [71, 2], [72, 3], [107, 3], [108, 4], [143, 4], [144, 5], [200, 5],
  ])('cr=%i -> level %i', (cr, lvl) => {
    expect(levelFromCredits(cr)).toBe(lvl);
  });
});
