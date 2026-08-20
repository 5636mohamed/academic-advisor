// Real backend prediction-engine fix, live-reported: "some students with
// high grades in their last performing classes... why is there low
// expected grades." Root cause confirmed with real data before this fix
// (562 real cases across the roster): the old formula
// (0.45*cohortProjected + 0.40*studentTrend + 0.15*difficultyNudge)
// weighted a course's historical cohort mean almost as heavily as the
// student's own trend, so a historically hard course (say a ~55% class
// mean) could still drag a student with a genuine ~90% personal average
// down to a D-range prediction — a real, live example: Ahmed Mostafa,
// 90.5% last-semester average, predicted a D (60.8%) in ECE312 purely
// because ECE312's own cohort history averages low.
//
// Rebuilt around exactly what was asked for: the student's own mean AND
// modal (most frequently earned) grade (studentStats.ts), the subject's
// own 3-year mean AND modal grade (cohortTrend.ts, "like you did with the
// student"), plus an explicit rising/declining/consistent/inconsistent
// trend adjustment for the subject — replacing the old flat difficulty-
// tier nudge, which only ever looked at a static average, never direction.
import { clamp } from './linearRegression';
import weights from '../../config/predictionWeights.json';

export interface ExpectedPctInputs {
  studentMean: number | null;
  studentModePct: number | null;
  cohortMean: number | null;
  cohortModePct: number | null;
  /** Additive nudge from cohortTrend.ts's own trendAdjustment — already
   *  scaled (±risingBonus/decliningPenalty/inconsistencyPenalty), applied
   *  once here, not re-derived. */
  trendAdjustment: number;
  /** Used only when studentMean/cohortMean are both unavailable (a course
   *  or student with literally zero history) — the same "there is
   *  genuinely nothing else to lean on" fallback the old formula had. */
  neutralFallback: number;
}

export function expectedPct(inputs: ExpectedPctInputs): number {
  const cfg = weights.expectedPct;
  // A student with no comparable history at all leans on the cohort mean
  // instead (matching the old formula's own "no personal history -> lean
  // on cohort signal" reasoning) — and vice versa, since either signal
  // being briefly unavailable (a brand-new course, a brand-new student)
  // shouldn't collapse the whole prediction to the flat neutral fallback
  // if the OTHER real signal is available.
  const studentMean = inputs.studentMean ?? inputs.cohortMean ?? inputs.neutralFallback;
  const studentModePct = inputs.studentModePct ?? studentMean;
  const cohortMean = inputs.cohortMean ?? inputs.studentMean ?? inputs.neutralFallback;
  const cohortModePct = inputs.cohortModePct ?? cohortMean;

  const blended =
    cfg.studentMeanWeight * studentMean +
    cfg.studentModeWeight * studentModePct +
    cfg.cohortMeanWeight * cohortMean +
    cfg.cohortModeWeight * cohortModePct +
    inputs.trendAdjustment;

  return clamp(Math.round(blended * 10) / 10, 0, 100);
}
