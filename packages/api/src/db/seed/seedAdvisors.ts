// The named advisors that replace the old single global "advisor" account —
// one per real seeded department (see seedCatalog.ts's CATALOG_BY_DEPARTMENT
// for which departments have a real catalog), each owning a real 25-35
// student roster. Pure data only (mirrors seedVentureProjects.ts's
// PROFESSORS export); the actual student-generation logic lives in
// inMemoryDb.ts alongside the private helpers (attempt(), fillerHash(),
// completeTranscript()) it depends on.
import { Advisor } from '@advisor/shared';

export const ADVISORS: Advisor[] = [
  // ---- ECE (original 5) ----
  { id: 'advisor-nabil', name: 'Prof. Nabil Fathy', facultyId: 'ENG', departmentId: 'ECE' },
  { id: 'advisor-mervat', name: 'Prof. Mervat Aziz', facultyId: 'ENG', departmentId: 'ECE' },
  { id: 'advisor-tarek', name: 'Prof. Tarek Younis', facultyId: 'ENG', departmentId: 'ECE' },
  { id: 'advisor-hoda', name: 'Prof. Hoda Sami', facultyId: 'ENG', departmentId: 'ECE' },
  { id: 'advisor-waleed', name: 'Prof. Waleed Kassem', facultyId: 'ENG', departmentId: 'ECE' },

  // ---- ECCE school siblings (real FoE Handbook departments) ----
  { id: 'advisor-heba', name: 'Prof. Heba Zaki', facultyId: 'ENG', departmentId: 'CSE' },
  { id: 'advisor-sherif', name: 'Prof. Sherif Adly', facultyId: 'ENG', departmentId: 'MIE' },
  { id: 'advisor-rania', name: 'Prof. Rania Gaber', facultyId: 'ENG', departmentId: 'EPE' },

  // ---- IDE school ----
  { id: 'advisor-mostafa', name: 'Prof. Mostafa Hegazy', facultyId: 'ENG', departmentId: 'MTE' },
  { id: 'advisor-dina', name: 'Prof. Dina Farouk', facultyId: 'ENG', departmentId: 'MSE' },
  { id: 'advisor-ayman', name: 'Prof. Ayman Nabil', facultyId: 'ENG', departmentId: 'IME' },
];

/** Which of the hand-authored named personas belongs to which advisor —
 *  keeps every existing id/scenario exactly as-is, just gives each a real
 *  roster owner. Distributed so no advisor's "story" cluster (e.g. the
 *  warning-ladder examples) is entirely on one advisor's desk. The new
 *  non-ECE advisors start with no named personas — every one of their
 *  students is generated. */
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
  'youssef-adel-1': 'advisor-waleed',
};

// FNV-1a-style 32-bit hash — same shape/purpose as inMemoryDb.ts's private
// fillerHash(), duplicated here (rather than imported) to avoid a circular
// dependency (inMemoryDb.ts already imports this file). Deterministic: same
// input string always produces the same output, no Math.random anywhere.
function advisorSeedHash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const MIN_STUDENTS_PER_ADVISOR = 25;
const MAX_STUDENTS_PER_ADVISOR = 35;

/** Each advisor's total roster size — a deterministic 25-35 spread (not a
 *  fixed 25) per the user's ask, seeded off the advisor's own id so re-
 *  seeding the server always reproduces the same roster sizes. */
export function rosterSizeFor(advisorId: string): number {
  const span = MAX_STUDENTS_PER_ADVISOR - MIN_STUDENTS_PER_ADVISOR + 1;
  return MIN_STUDENTS_PER_ADVISOR + (advisorSeedHash(`${advisorId}:roster-size`) % span);
}

/** How many generated filler students each advisor needs, given how many
 *  named personas they already have and their own (possibly-varied) roster
 *  size target. */
export function fillerCountFor(advisorId: string): number {
  const namedCount = Object.values(NAMED_STUDENT_ADVISOR).filter(id => id === advisorId).length;
  return rosterSizeFor(advisorId) - namedCount;
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
 *  roster gets its own realistic mix rather than one global shuffle that
 *  could unluckily cluster all the risk cases together. */
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
