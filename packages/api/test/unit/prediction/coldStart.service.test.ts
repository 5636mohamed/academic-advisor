import { describe, it, expect } from 'vitest';
import { isColdStartStudent, assessColdStart } from '../../../src/modules/prediction/coldStart.service';

describe('isColdStartStudent', () => {
  it('is true only for exactly zero completed attempts', () => {
    expect(isColdStartStudent(0)).toBe(true);
    expect(isColdStartStudent(1)).toBe(false);
    expect(isColdStartStudent(40)).toBe(false);
  });
});

describe('assessColdStart', () => {
  it('blends G12 and entrance exam per the configured weights (currently equal, 0.5/0.5)', () => {
    const a = assessColdStart(90, 70);
    expect(a.projectedPct).toBe(80); // (90+70)/2
  });

  it('maps the blended percentage through the real ENG grade scale, not a separate one', () => {
    const a = assessColdStart(95, 95);
    expect(a.projectedLetter).toBe('A+');
    expect(a.projectedPoints).toBe(4.0);
  });

  it('tiers strong_start at/above the configured threshold (85)', () => {
    expect(assessColdStart(90, 88).tier).toBe('strong_start');
    expect(assessColdStart(85, 85).tier).toBe('strong_start');
  });

  it('tiers solid_start in the middle band [70, 85)', () => {
    expect(assessColdStart(75, 73).tier).toBe('solid_start');
    expect(assessColdStart(70, 70).tier).toBe('solid_start');
  });

  it('tiers needs_early_support below the configured floor (70)', () => {
    expect(assessColdStart(65, 60).tier).toBe('needs_early_support');
    expect(assessColdStart(0, 0).tier).toBe('needs_early_support');
  });

  it('clamps an out-of-range input rather than producing a nonsense percentage', () => {
    const a = assessColdStart(120, 100); // defensive — real inputs should never be >100, but shouldn't corrupt the output if they are
    expect(a.projectedPct).toBeLessThanOrEqual(100);
  });
});
