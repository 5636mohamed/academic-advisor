import { describe, it, expect } from 'vitest';
import { ols, project } from '../../../src/modules/prediction/linearRegression';

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
});
