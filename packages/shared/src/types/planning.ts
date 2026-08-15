// Spec §3 & §8 — planning/prediction types
export interface CandidateCourseScore {
  courseCode: string;
  isRetake: boolean;
  oldPoints: number | null;
  expectedPct: number;
  expectedLetter: string;
  expectedPoints: number;
  deltaPts: number | null;
  chainUnlockValue: number;
  passRate: number;
  score: number;
  mandatory: boolean; // §5.2 — F-grade retake required to graduate, unscored
}

export type PlanMode = 'fast' | 'target_safe' | 'target_fast' | 'probation_repair';

export interface AdvisingAction {
  action: 'SHOW_PLAN' | 'RECOMMEND_INTERNAL_TRANSFER' | 'RECOMMEND_FACULTY_TRANSFER';
  plan: CandidateCourseScore[];
  projectedCGPA: number;
  trendSlope: number | null;
  explain: string;
}
