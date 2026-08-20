// The named advisors that replace the old single global "advisor" account.
// Pure data only (mirrors seedVentureProjects.ts's PROFESSORS export); the
// actual student-generation logic lives in inMemoryDb.ts alongside the
// private helpers (attempt(), fillerHash(), completeTranscript()) it
// depends on.
//
// Roster model: each of the 10 real departments (see seedCatalog.ts's
// CATALOG_BY_DEPARTMENT) has exactly 35 students; each of the 14 advisors
// has exactly 25. Those numbers don't divide evenly per-department-per-
// advisor (10*35 = 350 = 14*25, but 35 and 25 share no simple per-advisor
// split across 10 departments) — by design: an advisor's roster is a
// genuinely RANDOM (deterministic, not Math.random) cross-department mix,
// not "one advisor per department" like the very first version of this
// multi-advisor model. `Advisor.departmentId` below is kept as each
// advisor's own home-department affiliation (a real thing — an advisor is
// still formally based in one department) but no longer determines who
// they advise.
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

  // ---- EECE school ----
  { id: 'advisor-khaled', name: 'Prof. Khaled Ramzy', facultyId: 'ENG', departmentId: 'ERE' },
  { id: 'advisor-nagwa', name: 'Prof. Nagwa Fahmy', facultyId: 'ENG', departmentId: 'ENV' },
  { id: 'advisor-amr', name: 'Prof. Amr Shawky', facultyId: 'ENG', departmentId: 'CPE' },
];

/** Which of the hand-authored named personas belongs to which advisor —
 *  keeps every existing id/scenario exactly as-is. All 14 named personas
 *  are ECE (the only department with hand-authored worked examples), so
 *  only ECE advisors carry any named-persona load; every other advisor's
 *  entire 25-student roster is generated (and, per the random cross-
 *  department assignment below, is NOT limited to ECE students either). */
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

/** Every named persona today is ECE — see NAMED_STUDENT_ADVISOR's own
 *  comment. Kept as an explicit map (not derived from the literal list, to
 *  avoid a circular import with inMemoryDb.ts) so a future department
 *  gaining its own named personas is a one-line change here. */
const NAMED_STUDENTS_PER_DEPARTMENT: Record<string, number> = { ECE: 14 };

export const STUDENTS_PER_DEPARTMENT = 35;
export const STUDENTS_PER_ADVISOR = 25;

/** How many students a department needs GENERATED (on top of any named
 *  personas already seeded there) to reach its 35-student total. */
export function fillerCountForDepartment(departmentId: string): number {
  return STUDENTS_PER_DEPARTMENT - (NAMED_STUDENTS_PER_DEPARTMENT[departmentId] ?? 0);
}

/** How many GENERATED students an advisor still needs (on top of any named
 *  personas already assigned to them) to reach their 25-student total —
 *  this is their share of the random cross-department assignment below,
 *  not tied to their own home department. */
export function generatedCapacityForAdvisor(advisorId: string): number {
  const namedCount = Object.values(NAMED_STUDENT_ADVISOR).filter(id => id === advisorId).length;
  return STUDENTS_PER_ADVISOR - namedCount;
}

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

// A tiny, well-known deterministic PRNG (mulberry32) — used only to shuffle
// the advisor-assignment slots below. Still fully deterministic (seeded off
// a fixed string via advisorSeedHash, not the system clock), so re-seeding
// the server always reproduces byte-identical rosters — same discipline as
// every other "deterministic, not Math.random" generator in this codebase.
function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], seedStr: string): T[] {
  const rand = mulberry32(advisorSeedHash(seedStr));
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The real "random assignment" mechanism: a flat, shuffled list of advisor
 *  ids — advisor X appears exactly `generatedCapacityForAdvisor(X)` times —
 *  meant to be zipped 1:1 against a stably-ordered list of every generated
 *  student across all 10 departments (see inMemoryDb.ts's seedStudents
 *  construction). Because the list being zipped against is grouped by
 *  department but the slots here are shuffled, each advisor ends up with a
 *  genuine cross-department mix rather than "one advisor per department" —
 *  exactly the "more general test case" the roster was redesigned for.
 *  Deterministic: the shuffle is seeded off a fixed string, not the clock,
 *  so re-seeding the server reproduces the exact same assignment. */
export function buildGeneratedStudentAdvisorSlots(): string[] {
  const slots: string[] = [];
  for (const advisor of ADVISORS) {
    const capacity = generatedCapacityForAdvisor(advisor.id);
    for (let i = 0; i < capacity; i++) slots.push(advisor.id);
  }
  return seededShuffle(slots, 'generated-student-advisor-assignment-v1');
}

/** A generated student's standing bucket — deliberately not a uniform
 *  spread (a real advisor's roster is mostly fine, with a real minority at
 *  risk), same "logical, not flat" philosophy the rest of this file's
 *  filler-generation already follows. Expressed as a repeating weighted
 *  cycle so it's deterministic and readable rather than a probability
 *  table someone has to simulate in their head. */
export type StandingBucket = 'strong' | 'good' | 'average' | 'at_risk' | 'probation';

/** 12-long cycle: 3 strong, 4 good, 3 average, 1 at-risk, 1 probation-bound
 *  — roughly a 25/33/25/8/8% split, applied per-student so the whole
 *  system gets a realistic mix rather than one global shuffle that could
 *  unluckily cluster all the risk cases together. */
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
