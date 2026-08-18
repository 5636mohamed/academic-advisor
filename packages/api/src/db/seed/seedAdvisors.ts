// The 5 named advisors that replace the old single global "advisor"
// account — each owns a real 25-student roster. Pure data only (mirrors
// seedVentureProjects.ts's PROFESSORS export); the actual student-
// generation logic lives in inMemoryDb.ts alongside the private helpers
// (attempt(), fillerHash(), completeTranscript()) it depends on.
import { Advisor } from '@advisor/shared';

export const ADVISORS: Advisor[] = [
  { id: 'advisor-nabil', name: 'Prof. Nabil Fathy', facultyId: 'ENG', departmentId: 'ECE' },
  { id: 'advisor-mervat', name: 'Prof. Mervat Aziz', facultyId: 'ENG', departmentId: 'ECE' },
  { id: 'advisor-tarek', name: 'Prof. Tarek Younis', facultyId: 'ENG', departmentId: 'ECE' },
  { id: 'advisor-hoda', name: 'Prof. Hoda Sami', facultyId: 'ENG', departmentId: 'ECE' },
  { id: 'advisor-waleed', name: 'Prof. Waleed Kassem', facultyId: 'ENG', departmentId: 'ECE' },
];

/** Which of the 13 hand-authored named personas belongs to which advisor —
 *  keeps every existing id/scenario exactly as-is, just gives each a real
 *  roster owner. Distributed so no advisor's "story" cluster (e.g. the
 *  warning-ladder examples) is entirely on one advisor's desk. */
export const NAMED_STUDENT_ADVISOR: Record<string, string> = {
  'ahmed-1': 'advisor-nabil',
  'sara-1': 'advisor-nabil',
  'karim-1': 'advisor-nabil',
  'omar-1': 'advisor-mervat',
  'mona-2': 'advisor-mervat',
  'youssef-3': 'advisor-mervat',
  'laila-4': 'advisor-tarek',
  'salma-1': 'advisor-tarek',
  'yara-1': 'advisor-tarek',
  'nourhan-1': 'advisor-hoda',
  'hassan-1': 'advisor-hoda',
  'fatma-1': 'advisor-waleed',
  'mohamed-1': 'advisor-waleed',
};

/** Every advisor's roster is exactly this size (§ the VP epic's "25 students
 *  per advisor" spec) — named personas count toward it, the rest are
 *  generated filler students. */
export const STUDENTS_PER_ADVISOR = 25;

/** How many generated filler students each advisor needs, given how many
 *  named personas they already have. */
export function fillerCountFor(advisorId: string): number {
  const namedCount = Object.values(NAMED_STUDENT_ADVISOR).filter(id => id === advisorId).length;
  return STUDENTS_PER_ADVISOR - namedCount;
}

/** A generated student's standing bucket — deliberately not a uniform
 *  spread (a real advisor's roster is mostly fine, with a real minority at
 *  risk), same "logical, not flat" philosophy the rest of this file's
 *  filler-generation already follows. Expressed as a repeating weighted
 *  cycle so it's deterministic and readable rather than a probability
 *  table someone has to simulate in their head. */
export type StandingBucket = 'strong' | 'good' | 'average' | 'at_risk' | 'probation';

/** 12-long cycle: 3 strong, 4 good, 3 average, 1 at-risk, 1 probation-bound
 *  — roughly a 25/33/25/8/8% split, applied per-advisor so every advisor's
 *  25-person roster gets its own realistic mix rather than one global
 *  shuffle that could unluckily cluster all the risk cases together. */
export const STANDING_CYCLE: StandingBucket[] = [
  'strong', 'good', 'good', 'average', 'strong', 'good',
  'average', 'good', 'strong', 'average', 'at_risk', 'probation',
];

export const STANDING_TARGET_PCT: Record<StandingBucket, number> = {
  strong: 90,
  good: 80,
  average: 70,
  at_risk: 60,
  probation: 50,
};
