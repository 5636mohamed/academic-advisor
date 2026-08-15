// Spec §2.1 — engineering / program / faculty / school course grading scale
export interface GradeBand { min: number; letter: string; pts: number; }

export const ENG_SCALE: GradeBand[] = [
  { min: 95, letter: 'A+', pts: 4.00 },
  { min: 90, letter: 'A',  pts: 3.70 },
  { min: 85, letter: 'B+', pts: 3.30 },
  { min: 80, letter: 'B',  pts: 3.00 },
  { min: 75, letter: 'C+', pts: 2.70 },
  { min: 70, letter: 'C',  pts: 2.30 },
  { min: 65, letter: 'D+', pts: 2.00 },
  { min: 60, letter: 'D',  pts: 1.70 },
  { min: 0,  letter: 'F',  pts: 1.00 },
];

export const ENG_PASS_MARK = 60;
