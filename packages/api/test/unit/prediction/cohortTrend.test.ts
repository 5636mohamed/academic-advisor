import { describe, it, expect } from 'vitest';
import { cohortMeanModeTrend } from '../../../src/modules/prediction/cohortTrend';
import { CourseOffering } from '@advisor/shared';
import { deterministicGradeDistribution } from '../../../src/modules/prediction/gradeDistribution';

function offering(term: string, year: number, meanPct: number, stdDevPct: number, enrolled: number, isUR = false): CourseOffering {
  return { courseCode: 'X', term, year, enrolled, passed: Math.round(enrolled * 0.8), meanPct, stdDevPct, gradeDistribution: deterministicGradeDistribution(meanPct, stdDevPct, enrolled, isUR) };
}

describe('cohortMeanModeTrend', () => {
  it('returns null when there is no offering history at all', () => {
    expect(cohortMeanModeTrend([], false)).toBeNull();
  });

  it('computes a real enrollment-weighted mean across the offering history', () => {
    const offerings = [offering('Fall', 2023, 60, 8, 100), offering('Spring', 2024, 80, 8, 100)];
    const result = cohortMeanModeTrend(offerings, false);
    expect(result?.mean).toBeCloseTo(70, 0); // equal enrollment -> simple average of 60/80
  });

  it('a low-mean course has a modal letter at or below its own mean band, not an inflated one', () => {
    const offerings = [offering('Fall', 2023, 55, 6, 150), offering('Spring', 2024, 55, 6, 150)];
    const result = cohortMeanModeTrend(offerings, false);
    expect(['F', 'D', 'D+']).toContain(result?.modeLetter);
  });

  it('classifies a genuinely rising course (meaningfully increasing term-over-term mean) as rising, with a positive trend adjustment', () => {
    const offerings = [
      offering('Fall', 2023, 55, 8, 100), offering('Spring', 2024, 60, 8, 100),
      offering('Fall', 2024, 68, 8, 100), offering('Spring', 2025, 75, 8, 100),
    ];
    const result = cohortMeanModeTrend(offerings, false);
    expect(result?.trend).toBe('rising');
    expect(result?.trendAdjustment).toBeGreaterThan(0);
  });

  it('classifies a genuinely declining course as declining, with a negative trend adjustment', () => {
    const offerings = [
      offering('Fall', 2023, 80, 8, 100), offering('Spring', 2024, 72, 8, 100),
      offering('Fall', 2024, 65, 8, 100), offering('Spring', 2025, 58, 8, 100),
    ];
    const result = cohortMeanModeTrend(offerings, false);
    expect(result?.trend).toBe('declining');
    expect(result?.trendAdjustment).toBeLessThan(0);
  });

  it('classifies a flat, low-variance course as consistent, with no trend adjustment', () => {
    const offerings = [
      offering('Fall', 2023, 75, 4, 100), offering('Spring', 2024, 76, 4, 100),
      offering('Fall', 2024, 74, 4, 100), offering('Spring', 2025, 75, 4, 100),
    ];
    const result = cohortMeanModeTrend(offerings, false);
    expect(result?.trend).toBe('consistent');
    expect(result?.trendAdjustment).toBe(0);
  });

  it('classifies a flat-mean but high-variance course as inconsistent, with a negative trend adjustment', () => {
    const offerings = [
      offering('Fall', 2023, 75, 15, 100), offering('Spring', 2024, 74, 15, 100),
      offering('Fall', 2024, 76, 15, 100), offering('Spring', 2025, 75, 15, 100),
    ];
    const result = cohortMeanModeTrend(offerings, false);
    expect(result?.trend).toBe('inconsistent');
    expect(result?.trendAdjustment).toBeLessThan(0);
  });

  it('with fewer than 3 offerings, defaults to consistent (not enough history for a real trend read)', () => {
    const offerings = [offering('Fall', 2024, 60, 8, 100), offering('Spring', 2025, 90, 8, 100)];
    const result = cohortMeanModeTrend(offerings, false);
    expect(result?.trend).toBe('consistent');
  });

  it('gracefully handles offerings with no gradeDistribution (e.g. hand-built test fixtures elsewhere) by falling back to the band containing the mean, not throwing', () => {
    const bare: CourseOffering = { courseCode: 'X', term: 'Fall', year: 2023, enrolled: 100, passed: 80, meanPct: 75, stdDevPct: 8 };
    const result = cohortMeanModeTrend([bare], false);
    expect(result?.modeLetter).toBe('C+'); // ENG_SCALE: 75-79 is C+
  });

  // Real bug caught before shipping, live-reported example: a raw per-band
  // headcount comparison let the wide F band (0-59, 60 points) beat the
  // narrow D/D+ bands (5 points each) purely by width, even when the
  // course's real mean sat comfortably in the D/D+ range.
  it("a course whose mean sits in the D/D+ range reports a D-range mode, not F (the exact bug this fix closes)", () => {
    const offerings = [
      offering('Fall', 2023, 62, 7, 50), offering('Spring', 2023, 64, 9, 50),
      offering('Fall', 2024, 67, 10, 58), offering('Spring', 2024, 65, 9, 62),
      offering('Fall', 2025, 61, 9, 59), offering('Spring', 2025, 59, 10, 51),
    ];
    const result = cohortMeanModeTrend(offerings, false);
    expect(result?.mean).toBeCloseTo(63, 0);
    expect(['D', 'D+', 'C']).toContain(result?.modeLetter); // never F, despite F being the widest band
  });
});
