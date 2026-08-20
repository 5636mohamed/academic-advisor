import { describe, it, expect } from 'vitest';
import { deterministicGradeDistribution, combineDistributions, modalLetter, modalLetterByDensity, pctForLetter } from '../../../src/modules/prediction/gradeDistribution';
import { ENG_SCALE, UR_SCALE } from '@advisor/shared';

describe('deterministicGradeDistribution', () => {
  it('always sums to exactly `enrolled`, no matter the rounding', () => {
    for (const [mean, std, enrolled] of [[75, 8, 137], [90, 4, 55], [50, 15, 23], [65, 10, 1]] as const) {
      const dist = deterministicGradeDistribution(mean, std, enrolled, false);
      const total = Object.values(dist).reduce((s, c) => s + c, 0);
      expect(total).toBe(enrolled);
    }
  });

  it('is fully deterministic — the exact same inputs always produce the exact same distribution', () => {
    const a = deterministicGradeDistribution(78, 9, 100, false);
    const b = deterministicGradeDistribution(78, 9, 100, false);
    expect(a).toEqual(b);
  });

  it('a high mean with tight stdDev concentrates most students in/near the top bands', () => {
    const dist = deterministicGradeDistribution(93, 3, 200, false);
    const topBands = (dist['A+'] ?? 0) + (dist['A'] ?? 0);
    expect(topBands).toBeGreaterThan(150); // the clear majority
  });

  it('a low mean concentrates most students in/near the failing band', () => {
    const dist = deterministicGradeDistribution(50, 5, 200, false);
    expect(dist['F'] ?? 0).toBeGreaterThan(100);
  });

  it('every count is non-negative (rounding-remainder reconciliation never drives a band below 0)', () => {
    const dist = deterministicGradeDistribution(97, 2, 3, false);
    expect(Object.values(dist).every(c => c >= 0)).toBe(true);
  });

  it('UR courses use the UR scale (lower pass floor, D band starts at 50 not 60)', () => {
    // A mean right at 55 should land real weight in UR's wider D band (50-64)
    // that would mostly be F on the ENG scale (F is <60 there).
    const eng = deterministicGradeDistribution(55, 5, 100, false);
    const ur = deterministicGradeDistribution(55, 5, 100, true);
    expect((ur['D'] ?? 0) + (ur['D+'] ?? 0)).toBeGreaterThan((eng['D'] ?? 0) + (eng['D+'] ?? 0));
  });
});

describe('combineDistributions', () => {
  it('sums per-letter counts across multiple terms', () => {
    const combined = combineDistributions([{ A: 5, B: 10 }, { A: 3, C: 7 }, { B: 2 }]);
    expect(combined).toEqual({ A: 8, B: 12, C: 7 });
  });

  it('an empty list combines to an empty distribution', () => {
    expect(combineDistributions([])).toEqual({});
  });
});

describe('modalLetter', () => {
  it('returns the letter with the highest count', () => {
    expect(modalLetter({ A: 5, 'B+': 20, C: 3 }, ENG_SCALE)).toBe('B+');
  });

  it('breaks a tie toward the higher-grade-point letter, not iteration order', () => {
    expect(modalLetter({ C: 10, 'A+': 10 }, ENG_SCALE)).toBe('A+');
  });

  it('returns null for an empty or all-zero distribution', () => {
    expect(modalLetter({}, ENG_SCALE)).toBeNull();
    expect(modalLetter({ A: 0, B: 0 }, ENG_SCALE)).toBeNull();
  });
});

describe('modalLetterByDensity (the correct comparison for a distribution discretized across unequal-width bands)', () => {
  it("the real live-reported bug: a course with mean 63 (solidly D/D+) is never called an F, even though F's raw headcount can exceed any single narrow band's", () => {
    const dist = deterministicGradeDistribution(63, 8, 1000, false);
    // Confirm the bug precondition actually holds for this distribution:
    // raw modalLetter (unequal-width-biased) really does pick F here.
    expect(modalLetter(dist, ENG_SCALE)).toBe('F');
    // The fix: density-normalized comparison picks a band that actually
    // contains the real mean instead.
    expect(['D', 'D+', 'C']).toContain(modalLetterByDensity(dist, ENG_SCALE));
  });

  it('for a narrow, symmetric distribution the density mode still matches the plain arithmetic mode (both point to the same real peak)', () => {
    const dist = deterministicGradeDistribution(90, 3, 500, false);
    expect(modalLetterByDensity(dist, ENG_SCALE)).toBe('A'); // 90 is squarely inside the A band (90-94)
  });

  it('returns null for an empty distribution', () => {
    expect(modalLetterByDensity({}, ENG_SCALE)).toBeNull();
  });
});

describe('pctForLetter', () => {
  it('returns the band minimum for a real letter on the ENG scale', () => {
    expect(pctForLetter('B+', false)).toBe(85);
    expect(pctForLetter('F', false)).toBe(0);
  });

  it('returns the band minimum for a real letter on the UR scale (different D floor)', () => {
    expect(pctForLetter('D', true)).toBe(50);
    expect(pctForLetter('D', false)).toBe(60);
  });

  it('returns null for an unrecognized letter', () => {
    expect(pctForLetter('Z', false)).toBeNull();
  });
});
