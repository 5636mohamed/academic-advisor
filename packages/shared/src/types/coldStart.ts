// Cold-start recommendation trial — "Level 1, first semester, no records
// yet: what does the system recommend based on G12 + entrance exam
// results?" Every other prediction module in this app (cohortTrend,
// studentTrend, expectedPct) needs a real completed transcript to work
// from; a brand-new student has none, so this is a deliberately separate,
// simpler assessment — not a fallback path inside those modules, a
// distinct one for a distinct situation.
export type ColdStartTier = 'strong_start' | 'solid_start' | 'needs_early_support';

export interface ColdStartAssessment {
  g12Score: number;
  entranceExamScore: number;
  /** Weighted blend of the two inputs (see predictionWeights.json's
   *  coldStart block) — an assumption, not an empirically-fitted number
   *  (there's no real historical G12/entrance-exam-vs-first-semester-GPA
   *  dataset in this demo to calibrate against, unlike the friction
   *  burnoutThreshold or the OLS recency halfLife, both of which really
   *  were tuned against real seeded data — flagged here so this isn't
   *  mistaken for the same rigor). */
  projectedPct: number;
  projectedLetter: string;
  projectedPoints: number;
  tier: ColdStartTier;
}
