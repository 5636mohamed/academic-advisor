// Spec §3.1(c) — expectedPct = 0.45*cohort + 0.40*student + 0.15*difficulty.
// Real bug caught by code review: the formula used to compute
// 0.15*(cohort + difficulty), silently re-adding the cohort term a second
// time (effective cohort weight 0.60, not 0.45). No test previously
// isolated this formula — the advising-cycle tests all mock the ports
// layer, so the bug went unexercised despite feeding straight into
// runAdvisingCycle via repositoryBackedPorts.ts.
import { describe, it, expect } from 'vitest';
import { expectedPct, courseDifficultyAdjustment } from '../../../src/modules/prediction/expectedPct';

describe('expectedPct — §3.1(c) weighted blend', () => {
  it('matches the documented 0.45/0.40/0.15 formula exactly (no cohort double-count)', () => {
    // 0.45*85 + 0.40*55 + 0.15*0 = 60.25 -> rounds to 60.3
    const pct = expectedPct({ cohortProjectedPct: 85, studentTrendPct: 55, cohortMeanFallback: 72, tier: 'moderate' });
    expect(pct).toBeCloseTo(60.3, 1);
    // The buggy version (0.15*(cohort+difficulty)) would have produced 73.0 here.
    expect(pct).not.toBeCloseTo(73.0, 1);
  });

  it('a low-risk course adds its +5 difficulty bonus exactly once, not blended into the cohort term', () => {
    const flat = expectedPct({ cohortProjectedPct: 80, studentTrendPct: 80, cohortMeanFallback: 72, tier: 'moderate' });
    const lowRisk = expectedPct({ cohortProjectedPct: 80, studentTrendPct: 80, cohortMeanFallback: 72, tier: 'low-risk' });
    // difficultyWeight (0.15) * bonus (5) = 0.75
    expect(lowRisk - flat).toBeCloseTo(0.75, 1);
  });

  it('a historically-tough course subtracts its -5 difficulty penalty exactly once', () => {
    const flat = expectedPct({ cohortProjectedPct: 80, studentTrendPct: 80, cohortMeanFallback: 72, tier: 'moderate' });
    const tough = expectedPct({ cohortProjectedPct: 80, studentTrendPct: 80, cohortMeanFallback: 72, tier: 'historically tough' });
    expect(flat - tough).toBeCloseTo(0.75, 1);
  });

  it('with identical cohort/student inputs and a neutral tier, cohort+student weights (0.45+0.40=0.85) are the only contribution — the difficulty term never silently adds a second cohort weight', () => {
    const pct = expectedPct({ cohortProjectedPct: 72, studentTrendPct: 72, cohortMeanFallback: 72, tier: 'moderate' });
    // 0.45*72 + 0.40*72 + 0.15*0 = 0.85*72 = 61.2. The pre-fix bug would
    // have added a further 0.15*72 = 10.8, landing at 72.0 instead.
    expect(pct).toBeCloseTo(61.2, 1);
    expect(pct).not.toBeCloseTo(72, 1);
  });

  it('falls back to cohortMeanFallback when cohortProjectedPct is null, and to the cohort value when studentTrendPct is null', () => {
    const pct = expectedPct({ cohortProjectedPct: null, studentTrendPct: null, cohortMeanFallback: 75, tier: 'moderate' });
    // both fall back to 75 -> 0.45*75 + 0.40*75 + 0.15*0 = 63.75
    expect(pct).toBeCloseTo(63.8, 1);
  });

  it('clamps to [0, 100]', () => {
    expect(expectedPct({ cohortProjectedPct: 100, studentTrendPct: 100, cohortMeanFallback: 100, tier: 'low-risk' })).toBeLessThanOrEqual(100);
    expect(expectedPct({ cohortProjectedPct: 0, studentTrendPct: 0, cohortMeanFallback: 0, tier: 'historically tough' })).toBeGreaterThanOrEqual(0);
  });
});

describe('courseDifficultyAdjustment', () => {
  it('low-risk is +5, historically tough is -5, moderate is 0', () => {
    expect(courseDifficultyAdjustment('low-risk')).toBe(5);
    expect(courseDifficultyAdjustment('historically tough')).toBe(-5);
    expect(courseDifficultyAdjustment('moderate')).toBe(0);
  });
});
