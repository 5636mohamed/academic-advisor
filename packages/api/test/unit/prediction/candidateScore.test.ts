// Spec §3.2 — scoreCandidate's weighted sum, all 4 planning modes. No test
// previously existed for this function at all. Written alongside a real
// bug fix caught by code review: probation_repair mode's risk penalty was
// tripling (not doubling) the base risk aversion.
import { describe, it, expect } from 'vitest';
import { scoreCandidate, CandidateForScoring } from '../../../src/modules/prediction/candidateScore';

function candidate(overrides: Partial<CandidateForScoring> = {}): CandidateForScoring {
  return {
    expectedPoints: 3.0, credits: 3, isRetake: false, deltaPts: null,
    passRate: 100, chainUnlockValue: 0, retakeGateYes: false,
    ...overrides,
  };
}

describe('scoreCandidate — §3.2 base formula (mode: fast)', () => {
  it('matches the documented weighted sum exactly for a risk-free, non-retake candidate', () => {
    const c = candidate({ expectedPoints: 4, credits: 3, chainUnlockValue: 4, passRate: 100 });
    // 46*(4/4) + 18*(4/4) + 12*(3/3) + 0 - 20*(1-1) = 46+18+12 = 76
    expect(scoreCandidate(c, 'fast')).toBeCloseTo(76, 1);
  });

  it('a risky (low pass-rate) course is penalized by exactly -20*(1-passRate/100)', () => {
    const safe = candidate({ passRate: 100 });
    const risky = candidate({ passRate: 50 });
    // -20*(1-1.0) - (-20*(1-0.5)) = 0 - (-10) = penalty of 10
    expect(scoreCandidate(safe, 'fast') - scoreCandidate(risky, 'fast')).toBeCloseTo(10, 1);
  });

  it('a retake only gets the replacement-rule bonus when the retake gate is YES and deltaPts > 0', () => {
    const gateYesImproving = candidate({ isRetake: true, retakeGateYes: true, deltaPts: 1.5 });
    const gateNo = candidate({ isRetake: true, retakeGateYes: false, deltaPts: 1.5 });
    const notImproving = candidate({ isRetake: true, retakeGateYes: true, deltaPts: -0.5 });
    const base = candidate();
    expect(scoreCandidate(gateYesImproving, 'fast')).toBeGreaterThan(scoreCandidate(base, 'fast'));
    expect(scoreCandidate(gateNo, 'fast')).toBeCloseTo(scoreCandidate(base, 'fast'), 1);
    expect(scoreCandidate(notImproving, 'fast')).toBeCloseTo(scoreCandidate(base, 'fast'), 1);
  });
});

describe('scoreCandidate — probation_repair mode\'s risk penalty must DOUBLE, not triple, the base risk aversion (§3.2: "−10*(1-passRate/100)*2")', () => {
  it('the total risk-penalty gap between a safe and a risky candidate is exactly riskPenalty*multiplier (40), not riskPenalty*(1+multiplier) (60)', () => {
    const safe = candidate({ passRate: 100, expectedPoints: 3, credits: 3, chainUnlockValue: 0 });
    const risky = candidate({ passRate: 100 - 100, expectedPoints: 3, credits: 3, chainUnlockValue: 0 }); // passRate: 0 -> (1-0)=1
    const gap = scoreCandidate(safe, 'probation_repair') - scoreCandidate(risky, 'probation_repair');
    // total risk penalty per unit of (1-passRate/100) should be riskPenalty(20)*multiplier(2) = 40.
    // The pre-fix bug produced 60 (20 base + 40 mode-specific = triple, not double).
    expect(gap).toBeCloseTo(40, 1);
    expect(gap).not.toBeCloseTo(60, 1);
  });

  it('credit weight is genuinely halved in probation_repair mode (credits contribute at half the fast-mode rate)', () => {
    const highCredits = candidate({ credits: 3 });
    const lowCredits = candidate({ credits: 0 });
    const fastGap = scoreCandidate(highCredits, 'fast') - scoreCandidate(lowCredits, 'fast');
    const repairGap = scoreCandidate(highCredits, 'probation_repair') - scoreCandidate(lowCredits, 'probation_repair');
    expect(repairGap).toBeCloseTo(fastGap * 0.5, 1);
  });
});

describe('scoreCandidate — target_safe and target_fast modes', () => {
  it('target_safe adds a grade-quality bonus and subtracts a credit penalty relative to fast mode', () => {
    const c = candidate({ expectedPoints: 4, credits: 3 });
    const fast = scoreCandidate(c, 'fast');
    const safe = scoreCandidate(c, 'target_safe');
    // +20*(4/4) - 6*(3/3) = +20 - 6 = +14 relative to fast
    expect(safe - fast).toBeCloseTo(14, 1);
  });

  it('target_fast adds a credit-throughput bonus relative to fast mode', () => {
    const c = candidate({ credits: 3 });
    const fast = scoreCandidate(c, 'fast');
    const targetFast = scoreCandidate(c, 'target_fast');
    // +10*(3/3) = +10
    expect(targetFast - fast).toBeCloseTo(10, 1);
  });
});
