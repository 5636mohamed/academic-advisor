// Synthetic 3-years-of-offering history for every course in CATALOG — the
// `CourseOffering` table the Prisma schema already declares (enrolled/
// passed/meanPct/stdDevPct) but that nothing populated before this file.
//
// Why this exists: without it, `cohortProjectedPct()` always received `[]`
// (see repositoryBackedPorts.ts's old comment), so §3.1(a)'s cohort signal
// silently fell back to one hardcoded neutral number (72%) for literally
// every course, every student — and course "difficulty tier" and
// "confidence/pass-rate" were likewise hardcoded flat ('moderate' / 85%).
// That's why grade predictions used to cluster tightly around C+/C
// regardless of how strong a student's real history was, and every
// confidence bar read the same number — there was no real per-course signal
// feeding the blend, not a bug in the blend formula itself.
//
// This generator is DETERMINISTIC (a stable hash of the course code, not
// Math.random()) rather than truly random, on purpose: re-running the seed
// produces the exact same numbers, so results are reproducible for grading/
// demo purposes, and the logic is auditable — every course's stats are
// explainable from its category + code, not arbitrary. It is still a
// synthetic approximation, not real institutional data.
import { Course, CourseCategory, CourseOffering } from '@advisor/shared';
import { CATALOG } from './seedCatalog';

/** Small stable string hash (FNV-1a-ish) — same course code always yields
 *  the same numbers, so the "3 years of history" is reproducible. */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function jitter(seed: number, spread: number): number {
  // Deterministic pseudo-uniform value in [-spread, +spread].
  return (seed % (spread * 2 + 1)) - spread;
}

/** Category-level baseline — reflects the ordinary shape of a program like
 *  this: general-university/UR courses run easier and bigger, core
 *  engineering "program" courses run harder and smaller, electives sit in
 *  between. Not a claim about any real course, just a believable prior.
 *  Exported: courseRiskScore.service.ts (Curriculum Analytics epic) reuses
 *  `classSize` as the "typical section size" reference for demand-pressure/
 *  forecasted-sections math — same category-shaped prior, not a second,
 *  independently-drifting copy of it. */
export const CATEGORY_BASELINE: Record<CourseCategory, { mean: number; std: number; classSize: number }> = {
  ur_core: { mean: 85, std: 6, classSize: 150 },
  ur_elective: { mean: 82, std: 7, classSize: 95 },
  faculty: { mean: 76, std: 8, classSize: 115 },
  school: { mean: 74, std: 8, classSize: 70 },
  program: { mean: 71, std: 9, classSize: 55 },
  program_elective: { mean: 78, std: 7, classSize: 35 },
  core: { mean: 74, std: 8, classSize: 60 },
  special: { mean: 80, std: 6, classSize: 18 },
};

const YEARS = [2023, 2024, 2025];
const TERMS = ['Fall', 'Spring'];

function offeringsForCourse(course: Course): CourseOffering[] {
  const base = CATEGORY_BASELINE[course.category];
  const codeHash = hash(course.code);
  const isLab = course.name.toLowerCase().includes('lab');
  // Labs are conventionally marked a little more generously than their
  // lecture counterpart.
  const courseMean = clamp(base.mean + jitter(codeHash, 9) + (isLab ? 4 : 0), 45, 95);
  const courseStd = clamp(base.std + jitter(Math.floor(codeHash / 7), 3), 4, 15);

  const offerings: CourseOffering[] = [];
  let termIndex = 0;
  for (const year of YEARS) {
    for (const term of TERMS) {
      const termSeed = hash(`${course.code}:${year}:${term}`);
      // Small term-to-term drift on top of the course's own baseline, so
      // the 3-year history has a real (if gentle) trend for the OLS
      // cohort-trend regression to project forward — not a flat line.
      const drift = jitter(termSeed, 6) + Math.round(termIndex * jitter(termSeed, 2) * 0.3);
      const meanPct = clamp(Math.round((courseMean + drift) * 10) / 10, 40, 98);
      const stdDevPct = clamp(Math.round((courseStd + jitter(Math.floor(termSeed / 3), 2)) * 10) / 10, 3, 16);
      const enrolled = Math.max(8, base.classSize + jitter(Math.floor(termSeed / 11), Math.round(base.classSize * 0.15)));
      // Pass rate correlates with the term's mean score (a genuinely tough
      // sitting fails more students) rather than being independent of it.
      const passRateFraction = clamp((meanPct - 35) / 65, 0.3, 0.98);
      const passed = Math.round(enrolled * passRateFraction);

      offerings.push({ courseCode: course.code, term, year, enrolled, passed, meanPct, stdDevPct });
      termIndex++;
    }
  }
  return offerings;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export const COURSE_OFFERINGS: CourseOffering[] = CATALOG.flatMap(offeringsForCourse);

export const OFFERINGS_BY_COURSE: Record<string, CourseOffering[]> = (() => {
  const map: Record<string, CourseOffering[]> = {};
  for (const o of COURSE_OFFERINGS) {
    (map[o.courseCode] ??= []).push(o);
  }
  return map;
})();
