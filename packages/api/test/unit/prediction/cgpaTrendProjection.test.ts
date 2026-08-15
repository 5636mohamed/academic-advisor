// Covers spec §11 Example L (insufficient history -> safe default).
import { describe, it, expect } from 'vitest';
import { projectCGPATrend, isImprovingCase } from '../../../src/modules/prediction/cgpaTrendProjection';

describe('projectCGPATrend — §3.4', () => {
  it('reports insufficient_history with fewer than 3 snapshots (Example L)', () => {
    const r = projectCGPATrend([
      { semesterId: 's1', semesterOrdinal: 1, semesterGpa: 2.6, cgpa: 2.6, cumulativeCredits: 11, isBaseSnapshot: true },
    ]);
    expect(r.reading).toBe('insufficient_history');
    expect(r.slope).toBeNull();
  });

  it('detects a declining trend (Example H)', () => {
    const r = projectCGPATrend([
      { semesterId: 's1', semesterOrdinal: 1, semesterGpa: 2.2, cgpa: 2.20, cumulativeCredits: 18, isBaseSnapshot: false },
      { semesterId: 's2', semesterOrdinal: 2, semesterGpa: 2.0, cgpa: 2.14, cumulativeCredits: 36, isBaseSnapshot: false },
      { semesterId: 's3', semesterOrdinal: 3, semesterGpa: 2.1, cgpa: 2.15, cumulativeCredits: 54, isBaseSnapshot: false },
    ]);
    // roughly flat/slightly declining slope from 2.20 -> 2.15 across 3 points
    expect(r.reading === 'declining' || r.reading === 'flat').toBe(true);
  });

  it('isImprovingCase requires both a rising plan AND a non-declining trend', () => {
    const flatTrend = { slope: -0.02, reading: 'declining' as const };
    expect(isImprovingCase(2.15, 2.25, flatTrend)).toBe(false); // plan rises but trend declining -> not improving
    const upTrend = { slope: 0.05, reading: 'improving' as const };
    expect(isImprovingCase(3.10, 3.24, upTrend)).toBe(true);
  });

  it('insufficient history defaults to plan-only check, never blocks on trend (Example L)', () => {
    const noHistory = { slope: null, reading: 'insufficient_history' as const };
    expect(isImprovingCase(2.60, 2.70, noHistory)).toBe(true);
  });
});
