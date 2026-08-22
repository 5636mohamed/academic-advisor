// Real prediction-engine fix, live-reported: "some students with high
// grades... why low expected grades." Root cause: the old 0.45*cohort +
// 0.40*student + 0.15*difficulty blend weighted a course's historical
// cohort mean almost as heavily as the student's own trend. Rebuilt
// around real mean+mode on both sides plus a trend adjustment — see
// expectedPct.ts's own header for the full before/after.
import { describe, it, expect } from 'vitest';
import { expectedPct } from '../../../src/modules/prediction/expectedPct';
import weights from '../../../src/config/predictionWeights.json';

const cfg = weights.expectedPct;

describe('expectedPct — real mean/mode blend', () => {
  it('matches the documented weighted-sum exactly (studentMean/studentMode/cohortMean/cohortMode + trend nudge)', () => {
    const pct = expectedPct({ studentMean: 90, studentModePct: 90, cohortMean: 60, cohortModePct: 60, cohortTrendAdjustment: 0, studentTrendAdjustment: 0, neutralFallback: 72 });
    const expected = cfg.studentMeanWeight * 90 + cfg.studentModeWeight * 90 + cfg.cohortMeanWeight * 60 + cfg.cohortModeWeight * 60;
    expect(pct).toBeCloseTo(Math.round(expected * 10) / 10, 1);
  });

  it('the real live-reported case: a strong student (90.5 mean/mode) in a historically hard course (~55 cohort mean/mode) lands well above the old D-range prediction', () => {
    const pct = expectedPct({ studentMean: 90.5, studentModePct: 90, cohortMean: 55, cohortModePct: 60, cohortTrendAdjustment: 0, studentTrendAdjustment: 0, neutralFallback: 72 });
    // 0.35*90.5 + 0.25*90 + 0.25*55 + 0.15*60 = 31.675+22.5+13.75+9 = 76.925
    expect(pct).toBeCloseTo(76.9, 0);
    expect(pct).toBeGreaterThan(70); // decisively out of the old D-range (60-64) result
  });

  it('the student signal (mean+mode, 0.60 combined) outweighs the cohort signal (mean+mode, 0.40 combined) by design', () => {
    expect(cfg.studentMeanWeight + cfg.studentModeWeight).toBeGreaterThan(cfg.cohortMeanWeight + cfg.cohortModeWeight);
  });

  it('a rising-trend course adds its bonus exactly once', () => {
    const flat = expectedPct({ studentMean: 80, studentModePct: 80, cohortMean: 80, cohortModePct: 80, cohortTrendAdjustment: 0, studentTrendAdjustment: 0, neutralFallback: 72 });
    const rising = expectedPct({ studentMean: 80, studentModePct: 80, cohortMean: 80, cohortModePct: 80, cohortTrendAdjustment: cfg.risingBonus, studentTrendAdjustment: 0, neutralFallback: 72 });
    expect(rising - flat).toBeCloseTo(cfg.risingBonus, 1);
  });

  it('a declining-trend course subtracts its penalty exactly once', () => {
    const flat = expectedPct({ studentMean: 80, studentModePct: 80, cohortMean: 80, cohortModePct: 80, cohortTrendAdjustment: 0, studentTrendAdjustment: 0, neutralFallback: 72 });
    const declining = expectedPct({ studentMean: 80, studentModePct: 80, cohortMean: 80, cohortModePct: 80, cohortTrendAdjustment: -cfg.decliningPenalty, studentTrendAdjustment: 0, neutralFallback: 72 });
    expect(flat - declining).toBeCloseTo(cfg.decliningPenalty, 1);
  });

  it('a student with no history at all leans on the cohort mean (not a flat neutral fallback) when a cohort signal IS available', () => {
    const pct = expectedPct({ studentMean: null, studentModePct: null, cohortMean: 65, cohortModePct: 68, cohortTrendAdjustment: 0, studentTrendAdjustment: 0, neutralFallback: 72 });
    // studentMean/studentModePct both fall back to cohortMean (65) -> (0.35+0.25)*65 + 0.25*65 + 0.15*68
    const expected = (cfg.studentMeanWeight + cfg.studentModeWeight) * 65 + cfg.cohortMeanWeight * 65 + cfg.cohortModeWeight * 68;
    expect(pct).toBeCloseTo(Math.round(expected * 10) / 10, 1);
    expect(pct).not.toBeCloseTo(72, 1); // never silently falls all the way back to neutral when a real signal exists
  });

  it('a brand-new course with no offering history leans on the student mean instead of the flat neutral fallback', () => {
    const pct = expectedPct({ studentMean: 85, studentModePct: 88, cohortMean: null, cohortModePct: null, cohortTrendAdjustment: 0, studentTrendAdjustment: 0, neutralFallback: 72 });
    const expected = cfg.studentMeanWeight * 85 + cfg.studentModeWeight * 88 + (cfg.cohortMeanWeight + cfg.cohortModeWeight) * 85;
    expect(pct).toBeCloseTo(Math.round(expected * 10) / 10, 1);
  });

  it('only the flat neutral fallback is used when BOTH sides have zero history', () => {
    const pct = expectedPct({ studentMean: null, studentModePct: null, cohortMean: null, cohortModePct: null, cohortTrendAdjustment: 0, studentTrendAdjustment: 0, neutralFallback: 72 });
    expect(pct).toBeCloseTo(72, 1);
  });

  it('clamps to [0, 100]', () => {
    expect(expectedPct({ studentMean: 100, studentModePct: 100, cohortMean: 100, cohortModePct: 100, cohortTrendAdjustment: 5, studentTrendAdjustment: 5, neutralFallback: 100 })).toBeLessThanOrEqual(100);
    expect(expectedPct({ studentMean: 0, studentModePct: 0, cohortMean: 0, cohortModePct: 0, cohortTrendAdjustment: -5, studentTrendAdjustment: -5, neutralFallback: 0 })).toBeGreaterThanOrEqual(0);
  });

  it('the student trend adds/subtracts independently of, and summed with, the cohort trend', () => {
    const flat = expectedPct({ studentMean: 80, studentModePct: 80, cohortMean: 80, cohortModePct: 80, cohortTrendAdjustment: 0, studentTrendAdjustment: 0, neutralFallback: 72 });
    const studentRising = expectedPct({ studentMean: 80, studentModePct: 80, cohortMean: 80, cohortModePct: 80, cohortTrendAdjustment: 0, studentTrendAdjustment: cfg.studentRisingBonus, neutralFallback: 72 });
    expect(studentRising - flat).toBeCloseTo(cfg.studentRisingBonus, 1);

    const studentDeclining = expectedPct({ studentMean: 80, studentModePct: 80, cohortMean: 80, cohortModePct: 80, cohortTrendAdjustment: 0, studentTrendAdjustment: -cfg.studentDecliningPenalty, neutralFallback: 72 });
    expect(flat - studentDeclining).toBeCloseTo(cfg.studentDecliningPenalty, 1);

    // Both trends pointing the same way stack additively, neither one
    // silently overriding the other.
    const bothDeclining = expectedPct({ studentMean: 80, studentModePct: 80, cohortMean: 80, cohortModePct: 80, cohortTrendAdjustment: -cfg.decliningPenalty, studentTrendAdjustment: -cfg.studentDecliningPenalty, neutralFallback: 72 });
    expect(flat - bothDeclining).toBeCloseTo(cfg.decliningPenalty + cfg.studentDecliningPenalty, 1);
  });
});
