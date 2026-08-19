// Cold-start recommendation — "Level 1, first semester, no records yet:
// what does the system recommend based on G12 + entrance exam results?"
// See coldStart.ts (shared types) for why this is a separate module
// rather than a fallback branch inside the transcript-driven prediction
// modules.
import { ColdStartAssessment, ColdStartTier } from '@advisor/shared';
import { gradeFromPct } from '@advisor/shared';
import { clamp } from './linearRegression';
import weights from '../../config/predictionWeights.json';

/** A student is a cold-start case exactly when there's no completed
 *  transcript to project from — level 1 alone isn't enough (a transfer-in
 *  could arrive at level 1 with real credits already), zero completed
 *  attempts is the real signal. */
export function isColdStartStudent(completedAttemptCount: number): boolean {
  return completedAttemptCount === 0;
}

export function assessColdStart(g12Score: number, entranceExamScore: number): ColdStartAssessment {
  const w = weights.coldStart;
  const projectedPct = clamp(Math.round(w.g12Weight * g12Score + w.entranceExamWeight * entranceExamScore), 0, 100);
  const band = gradeFromPct(projectedPct, false); // semester-1 courses are a mix, but the ENG scale is this app's default everywhere else a single band is needed without a specific course's isUR flag in hand

  let tier: ColdStartTier;
  if (projectedPct >= w.strongTierMinPct) tier = 'strong_start';
  else if (projectedPct >= w.solidTierMinPct) tier = 'solid_start';
  else tier = 'needs_early_support';

  return {
    g12Score, entranceExamScore, projectedPct,
    projectedLetter: band.letter, projectedPoints: band.pts,
    tier,
  };
}

export const COLD_START_TIER_COPY: Record<ColdStartTier, { headline: string; detail: string }> = {
  strong_start: {
    headline: 'Strong projected start',
    detail: 'Your G12 and entrance exam results put you well above the typical first-semester range — no early-support flag needed, just keep the same study habits going.',
  },
  solid_start: {
    headline: 'Solid projected start',
    detail: 'Your G12 and entrance exam results project a solid, on-track first semester. A quick check-in with your advisor after your first quiz/midterm results is still a good idea.',
  },
  needs_early_support: {
    headline: 'Early support recommended',
    detail: 'Your G12 and entrance exam results are on the lower end of the range that tends to need extra support in a demanding first semester — your advisor has been flagged to reach out early, before any real grades are in yet.',
  },
};
