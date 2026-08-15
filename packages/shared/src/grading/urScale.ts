// Spec §2.1 — LRA / University-Requirement course grading scale (lower pass floor)
import { GradeBand, ENG_SCALE, ENG_PASS_MARK } from './engScale';

export const UR_SCALE: GradeBand[] = [
  { min: 95, letter: 'A+', pts: 4.00 },
  { min: 90, letter: 'A',  pts: 3.70 },
  { min: 85, letter: 'B+', pts: 3.30 },
  { min: 80, letter: 'B',  pts: 3.00 },
  { min: 75, letter: 'C+', pts: 2.70 },
  { min: 70, letter: 'C',  pts: 2.30 },
  { min: 65, letter: 'D+', pts: 2.00 },
  { min: 50, letter: 'D',  pts: 1.70 },
  { min: 0,  letter: 'F',  pts: 1.00 },
];

export const UR_PASS_MARK = 50;

export function gradeFromPct(pct: number, isUR: boolean): GradeBand {
  const scale = isUR ? UR_SCALE : ENG_SCALE;
  for (const band of scale) {
    if (pct >= band.min) return band;
  }
  return scale[scale.length - 1];
}

export function passMark(isUR: boolean): number {
  return isUR ? UR_PASS_MARK : ENG_PASS_MARK;
}
