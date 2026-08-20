// Spec §3.2/§5.2 — knapsack packing + mandatory-F reservation, incl. the
// §11 Example M overflow rule ("keep the three with the highest
// chainUnlockValue and flag the remainder 'carried to next semester'").
import { describe, it, expect } from 'vitest';
import { packPlan } from '../../../src/modules/prediction/planPacker';
import { CandidateForScoring } from '../../../src/modules/prediction/candidateScore';

type Cand = CandidateForScoring & { courseCode: string; coreq: string[]; expectedLetter: string };

function cand(overrides: Partial<Cand> & Pick<Cand, 'courseCode' | 'credits'>): Cand {
  return {
    expectedPoints: 3.0,
    expectedLetter: 'B', // safely non-F by default — see the dedicated F-exclusion tests below
    isRetake: false,
    deltaPts: null,
    passRate: 90,
    chainUnlockValue: 0,
    retakeGateYes: false,
    coreq: [],
    ...overrides,
  };
}

describe('packPlan (§3.2 knapsack + §5.2 mandatory reservation)', () => {
  it('fills the cap with the highest-scoring combination when everything fits', () => {
    const pool: Cand[] = [
      cand({ courseCode: 'A', credits: 3, expectedPoints: 4.0, chainUnlockValue: 2 }),
      cand({ courseCode: 'B', credits: 3, expectedPoints: 3.0, chainUnlockValue: 1 }),
    ];
    const result = packPlan({ mandatory: [], pool, cap: 6, mode: 'fast' });
    expect(result.optimizedBundles.map(b => b.members[0].courseCode).sort()).toEqual(['A', 'B']);
    expect(result.totalCredits).toBe(6);
    expect(result.mandatoryBundles).toEqual([]);
    expect(result.carriedToNextSemester).toEqual([]);
  });

  it('excludes the lower-scoring course when both do not fit the cap (0/1 knapsack, not greedy-by-credits)', () => {
    const pool: Cand[] = [
      cand({ courseCode: 'HIGH', credits: 4, expectedPoints: 4.0, chainUnlockValue: 3 }),
      cand({ courseCode: 'LOW', credits: 4, expectedPoints: 1.0, chainUnlockValue: 0, passRate: 50 }),
    ];
    const result = packPlan({ mandatory: [], pool, cap: 4, mode: 'fast' });
    expect(result.optimizedBundles).toHaveLength(1);
    expect(result.optimizedBundles[0].members[0].courseCode).toBe('HIGH');
  });

  it('bundles a course with its coreq as one inseparable unit', () => {
    const pool: Cand[] = [
      cand({ courseCode: 'LEC', credits: 3, coreq: ['LAB'], expectedPoints: 3.5 }),
      cand({ courseCode: 'LAB', credits: 1, expectedPoints: 3.5 }),
      cand({ courseCode: 'ALT', credits: 3, expectedPoints: 3.9 }), // higher score alone, but LEC+LAB bundle should still be considered as one 4-credit unit
    ];
    // cap=4: either the LEC+LAB bundle (4cr) or ALT (3cr) + 1cr slack (nothing else fits at 1cr)
    const result = packPlan({ mandatory: [], pool, cap: 4, mode: 'fast' });
    const chosenCodes = result.optimizedBundles.flatMap(b => b.members.map(m => m.courseCode)).sort();
    // Whichever the optimizer picks, LEC and LAB must travel together (never LEC without LAB or vice versa).
    const hasLec = chosenCodes.includes('LEC');
    const hasLab = chosenCodes.includes('LAB');
    expect(hasLec).toBe(hasLab);
  });

  it('reserves mandatory (F-retake) bundles first, before the optimizer runs on the remaining cap', () => {
    const mandatory: Cand[] = [cand({ courseCode: 'PHY121', credits: 4, expectedPoints: 2.0, chainUnlockValue: 1 })];
    const pool: Cand[] = [
      cand({ courseCode: 'ELEC1', credits: 3, expectedPoints: 4.0, chainUnlockValue: 2 }),
      cand({ courseCode: 'ELEC2', credits: 3, expectedPoints: 4.0, chainUnlockValue: 2 }),
    ];
    // cap=14 (probation): 4 reserved for PHY121, 10 remain -> both electives fit (6cr) with room to spare.
    const result = packPlan({ mandatory, pool, cap: 14, mode: 'probation_repair' });
    expect(result.mandatoryBundles).toHaveLength(1);
    expect(result.mandatoryBundles[0].members[0].courseCode).toBe('PHY121');
    expect(result.optimizedBundles.flatMap(b => b.members.map(m => m.courseCode)).sort()).toEqual(['ELEC1', 'ELEC2']);
    expect(result.totalCredits).toBe(10);
    expect(result.carriedToNextSemester).toEqual([]);
  });

  it('§11 Example M — mandatory credits exceeding the cap: keeps the highest chainUnlockValue bundles, carries the rest', () => {
    // Four mandatory F-retakes whose combined credits (13) exceed the
    // 14-credit... make it exceed clearly: use a 10-credit cap so overflow
    // is forced, and distinct chainUnlockValues so the priority order is
    // unambiguous.
    const mandatory: Cand[] = [
      cand({ courseCode: 'F1', credits: 3, chainUnlockValue: 4 }), // highest priority
      cand({ courseCode: 'F2', credits: 3, chainUnlockValue: 3 }),
      cand({ courseCode: 'F3', credits: 3, chainUnlockValue: 2 }),
      cand({ courseCode: 'F4', credits: 3, chainUnlockValue: 1 }), // lowest priority — should overflow
    ];
    const result = packPlan({ mandatory, pool: [], cap: 10, mode: 'probation_repair' });

    const fittedCodes = result.mandatoryBundles.flatMap(b => b.members.map(m => m.courseCode));
    const carriedCodes = result.carriedToNextSemester.flatMap(b => b.members.map(m => m.courseCode));

    // 10-credit cap / 3-credit mandatory courses -> 3 fit (9cr), 1 carries.
    expect(fittedCodes).toEqual(['F1', 'F2', 'F3']); // highest chainUnlockValue first, per §5.2 overflow rule
    expect(carriedCodes).toEqual(['F4']);
    expect(result.totalCredits).toBe(9);
    // No cap left over for the optional pool once mandatory reservation eats it.
    expect(result.optimizedBundles).toEqual([]);
  });

  it('when mandatory reservation consumes the entire cap, optimizedBundles is empty (no crash on remainingCap<=0)', () => {
    const mandatory: Cand[] = [cand({ courseCode: 'F1', credits: 14, chainUnlockValue: 1 })];
    const pool: Cand[] = [cand({ courseCode: 'ELEC', credits: 3, expectedPoints: 4.0 })];
    const result = packPlan({ mandatory, pool, cap: 14, mode: 'probation_repair' });
    expect(result.mandatoryBundles).toHaveLength(1);
    expect(result.optimizedBundles).toEqual([]);
    expect(result.totalCredits).toBe(14);
  });

  // Real bug reported live TWICE against the same underlying gap — first
  // fixed one level too high (only in the full advising-cycle planner),
  // which left the Fastest-Graduation/Target-CGPA planners (server.ts's
  // buildScoredPlan) still recommending F-predicted courses. Now enforced
  // here, the one function both planners share, so it can't be missed by
  // either (or a future third caller) again.
  describe('never recommends a course predicted to result in an outright F', () => {
    it('an F-predicted optional candidate is excluded even when it would otherwise win on every other factor', () => {
      const pool: Cand[] = [
        // Huge chain-unlock value and full credit weight — pre-fix, this
        // could out-score everything else in the pool despite the F.
        cand({ courseCode: 'DOOMED', credits: 3, expectedLetter: 'F', expectedPoints: 1.0, chainUnlockValue: 4, passRate: 15 }),
        cand({ courseCode: 'SAFE', credits: 3, expectedLetter: 'C', expectedPoints: 2.3, chainUnlockValue: 1, passRate: 85 }),
      ];
      const result = packPlan({ mandatory: [], pool, cap: 6, mode: 'fast' });
      const codes = result.optimizedBundles.flatMap(b => b.members.map(m => m.courseCode));
      expect(codes).not.toContain('DOOMED');
      expect(codes).toContain('SAFE');
    });

    it('fills remaining capacity from other (non-F) optional retakes when that\'s the only thing left, rather than leaving the plan short', () => {
      const pool: Cand[] = [
        cand({ courseCode: 'F_RETAKE', credits: 3, expectedLetter: 'F', isRetake: true, expectedPoints: 1.0 }),
        cand({ courseCode: 'D_RETAKE', credits: 3, expectedLetter: 'D', isRetake: true, expectedPoints: 1.7 }),
      ];
      const result = packPlan({ mandatory: [], pool, cap: 6, mode: 'fast' });
      const codes = result.optimizedBundles.flatMap(b => b.members.map(m => m.courseCode));
      expect(codes).not.toContain('F_RETAKE');
      expect(codes).toContain('D_RETAKE'); // the only passing option left still gets recommended
    });

    it('a mandatory F-grade retake (already-failed, compulsory course) is NOT excluded even if it predicts F again — there is no "recommend or not" choice for it', () => {
      const mandatory: Cand[] = [cand({ courseCode: 'MUST_RETAKE', credits: 3, expectedLetter: 'F', isRetake: true })];
      const result = packPlan({ mandatory, pool: [], cap: 14, mode: 'probation_repair' });
      expect(result.mandatoryBundles.flatMap(b => b.members.map(m => m.courseCode))).toEqual(['MUST_RETAKE']);
    });
  });
});
