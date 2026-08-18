// Covers spec §15.2.
import { describe, it, expect } from 'vitest';
import { bestCasePct } from '../../../src/modules/prediction/bestCaseProjection';

const courseByCode = {
  ECE314: { category: 'program' as const },
  ECE322: { category: 'program' as const },
  LRA401: { category: 'ur_core' as const },
};

function rec(courseCode: string, pct: number, ordinal = 1) {
  return { courseCode, attemptNumber: 1, pct, letter: 'x', points: 0, isRetake: false, countsInCgpa: true, semesterOrdinal: ordinal };
}

describe('bestCasePct — §15.2', () => {
  it('uses the max comparable-category pct when history exists', () => {
    const history = [rec('ECE314', 71), rec('ECE322', 92, 2), rec('LRA401', 99, 3)];
    const result = bestCasePct({ category: 'program', isUR: false }, history, courseByCode, 60);
    expect(result.bestCasePct).toBe(92); // ignores the UR course's 99
    expect(result.bestCaseLetter).toBe('A');
  });

  it('falls back to overall max when no comparable-category history exists', () => {
    const history = [rec('LRA401', 88)];
    const result = bestCasePct({ category: 'program', isUR: false }, history, courseByCode, 60);
    expect(result.bestCasePct).toBe(88);
  });

  it('falls back to the provided expectedPct for a brand-new student with no history', () => {
    const result = bestCasePct({ category: 'program', isUR: false }, [], courseByCode, 65);
    expect(result.bestCasePct).toBe(65);
  });

  it('never returns a worse letter than the realistic expected grade would imply', () => {
    const history = [rec('ECE314', 96)];
    const result = bestCasePct({ category: 'program', isUR: false }, history, courseByCode, 60);
    expect(result.bestCaseLetter).toBe('A+');
    expect(result.bestCasePoints).toBe(4.0);
  });

  it('clamps up to the live expected pct when the student\'s own historical best is worse — "best case" must never look worse than "expected"', () => {
    // A student whose only comparable-category result ever was a 52 (F)
    // being told their "best case" for a new course is also an F, even
    // though that same course's realistic expected grade is a healthy 78,
    // is exactly the confusing Expected > Best Case pairing reported
    // against live data — clamp instead of ever showing that.
    const history = [rec('ECE314', 52)];
    const result = bestCasePct({ category: 'program', isUR: false }, history, courseByCode, 78);
    expect(result.bestCasePct).toBe(78);
    expect(result.bestCaseLetter).not.toBe('F');
  });

  it('leaves a genuinely higher historical best alone even when it clears the expected pct by a lot', () => {
    const history = [rec('ECE314', 96)];
    const result = bestCasePct({ category: 'program', isUR: false }, history, courseByCode, 78);
    expect(result.bestCasePct).toBe(96);
  });
});
