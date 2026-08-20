// Spec §3.1(c) — weighted-sum blend of cohort trend, student trend, and a
// difficulty nudge, into a single expected-score prediction for a course.
// Weights are read from config so they can be retuned without a redeploy
// (spec §12 edge-case checklist).
import { clamp } from './linearRegression';
import weights from '../../config/predictionWeights.json';

export interface DifficultyTier { tier: 'low-risk' | 'moderate' | 'historically tough'; }

export function courseDifficultyAdjustment(tier: DifficultyTier['tier']): number {
  if (tier === 'low-risk') return weights.difficultyAdjustment.lowRiskBonus;
  if (tier === 'historically tough') return -weights.difficultyAdjustment.toughPenalty;
  return 0;
}

export interface ExpectedPctInputs {
  cohortProjectedPct: number | null;
  studentTrendPct: number | null;
  cohortMeanFallback: number; // used when either regression input is unavailable
  tier: DifficultyTier['tier'];
}

export function expectedPct(inputs: ExpectedPctInputs): number {
  const cohort = inputs.cohortProjectedPct ?? inputs.cohortMeanFallback;
  const student = inputs.studentTrendPct ?? cohort; // no personal history -> lean on cohort signal
  const difficulty = courseDifficultyAdjustment(inputs.tier);

  // Spec §3.1(c): expectedPct = 0.45*cohort + 0.40*student + 0.15*difficulty
  // — difficulty is a small standalone ±5-point nudge, not (cohort +
  // difficulty). The previous version multiplied difficultyWeight by
  // (cohort + difficulty), which silently re-added the cohort term a
  // second time (effective cohort weight 0.60, not 0.45) — a real bug
  // caught by code review, not a hypothetical: it fed straight into
  // runAdvisingCycle via repositoryBackedPorts.ts's scoreEligibleCourse,
  // systematically overstating projectedCGPA for any student whose
  // personal trend lagged their cohort's.
  const blended =
    weights.expectedPct.cohortWeight * cohort +
    weights.expectedPct.studentWeight * student +
    weights.expectedPct.difficultyWeight * difficulty;

  return clamp(Math.round(blended * 10) / 10, 0, 100);
}
