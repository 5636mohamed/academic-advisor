// Spec §3.2 — weighted-sum candidate scoring, all four planning modes,
// plus the §5.1 retake chain-unlock boost when the retake gate is YES.
import { PlanMode } from '@advisor/shared';
import weights from '../../config/predictionWeights.json';

export interface CandidateForScoring {
  expectedPoints: number;   // 0..4
  credits: number;
  isRetake: boolean;
  deltaPts: number | null;  // expectedPoints - oldPoints, only when isRetake
  passRate: number;         // 0..100
  chainUnlockValue: number;
  retakeGateYes: boolean;   // §5 — whether the student opted in to weighted retakes
}

export function scoreCandidate(c: CandidateForScoring, mode: PlanMode): number {
  const w = weights.candidateScore;
  let score = 0;

  score += w.gradeQuality * (c.expectedPoints / 4);
  score += w.chainUnlock * Math.min(c.chainUnlockValue, 4) / 4;
  score += w.creditProgress * (c.credits / 3);

  if (c.isRetake && c.retakeGateYes && c.deltaPts !== null && c.deltaPts > 0) {
    score += w.retakeReplacement * (c.deltaPts / 3);
    // §5.1 — extra boost for retakes that unblock the most future courses,
    // implementing "recommend them in the best case that he can't get
    // struggles for future subjects."
    score += weights.retakeGate.chainUnlockBoost * Math.min(c.chainUnlockValue, 4) / 4;
  }

  score -= w.riskPenalty * (1 - c.passRate / 100);

  if (mode === 'target_safe') {
    score += w.targetSafe.gradeQualityBonus * (c.expectedPoints / 4);
    score -= w.targetSafe.creditPenalty * (c.credits / 3);
  }
  if (mode === 'target_fast') {
    score += w.targetFast.creditBonus * (c.credits / 3);
  }
  if (mode === 'probation_repair') {
    score += w.probationRepair.gradeQualityBonus * (c.expectedPoints / 4);
    score -= w.riskPenalty * w.probationRepair.riskPenaltyMultiplier * (1 - c.passRate / 100);
    score += w.creditProgress * w.probationRepair.creditWeightScale * (c.credits / 3) - w.creditProgress * (c.credits / 3);
  }

  return Math.round(score * 10) / 10;
}
