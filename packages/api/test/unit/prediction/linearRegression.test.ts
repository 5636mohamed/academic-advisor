import { describe, it, expect } from 'vitest';
import { ols, project, recencyWeights } from '../../../src/modules/prediction/linearRegression';

describe('ols — §3.1/§3.4 core regression primitive', () => {
  it('fits a perfect line exactly', () => {
    const { a, b } = ols([0, 1, 2, 3], [10, 12, 14, 16]);
    expect(b).toBeCloseTo(2, 5);
    expect(a).toBeCloseTo(10, 5);
    expect(project({ a, b }, 4)).toBeCloseTo(18, 5);
  });

  it('returns slope 0 for a flat series', () => {
    const { b } = ols([0, 1, 2, 3], [2.5, 2.5, 2.5, 2.5]);
    expect(b).toBeCloseTo(0, 5);
  });

  it('handles n=1 without throwing (returns that value, slope 0)', () => {
    const { a, b } = ols([0], [3.3]);
    expect(a).toBe(3.3);
    expect(b).toBe(0);
  });

  it('handles n=0 without throwing', () => {
    const { a, b } = ols([], []);
    expect(a).toBe(0);
    expect(b).toBe(0);
  });

  it('an all-equal weights array reduces to the same result as unweighted', () => {
    const x = [0, 1, 2, 3, 4];
    const y = [65, 70, 68, 75, 80];
    const plain = ols(x, y);
    const weighted = ols(x, y, [1, 1, 1, 1, 1]);
    expect(weighted.a).toBeCloseTo(plain.a, 10);
    expect(weighted.b).toBeCloseTo(plain.b, 10);
  });

  it('weighting emphasizes the recent segment: an upturn after a downturn projects higher weighted than unweighted', () => {
    // Declines for 3 terms, then sharply recovers for the last 2 — a
    // trend-follower should weight that recovery more than a flat fit does.
    const x = [0, 1, 2, 3, 4];
    const y = [85, 78, 70, 78, 88];
    const plainNext = project(ols(x, y), 5);
    const weightedNext = project(ols(x, y, recencyWeights(x.length, 2)), 5);
    expect(weightedNext).toBeGreaterThan(plainNext);
  });
});

describe('recencyWeights — exponential recency weighting for trend regressions', () => {
  it('gives the most recent point (last index) weight 1', () => {
    const w = recencyWeights(5, 5);
    expect(w[w.length - 1]).toBe(1);
  });

  it('halves every halfLife steps back from the most recent point', () => {
    const w = recencyWeights(11, 5); // indices 0..10, most recent is index 10
    expect(w[5]).toBeCloseTo(0.5, 5); // 5 steps back from index 10
    expect(w[0]).toBeCloseTo(0.25, 5); // 10 steps back = two half-lives
  });

  it('is monotonically non-decreasing toward the most recent point', () => {
    const w = recencyWeights(8, 4);
    for (let i = 1; i < w.length; i++) expect(w[i]).toBeGreaterThanOrEqual(w[i - 1]);
  });

  it('returns [] for n<=0', () => {
    expect(recencyWeights(0, 5)).toEqual([]);
  });

  it('defaults halfLife to 5 when omitted', () => {
    const withDefault = recencyWeights(11);
    const explicit = recencyWeights(11, 5);
    expect(withDefault).toEqual(explicit);
  });
});
