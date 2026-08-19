// AI Features Blueprint §1.3 — per-course syllabus milestone templates for
// the Cognitive Load Heatmap. Keyed by (courseCode, weekNumber, type) as a
// reusable template (a course's syllabus structure repeats every time it's
// offered), not tied to a specific semesterOrdinal instance — see
// friction.ts's header for why.
//
// Hand-authoring ~65 real syllabi is out of scope for a first cut, so this
// is a deterministic GENERATOR (same "no Math.random" discipline as
// inMemoryDb.ts's own fillerHash-based filler-student generator) rather
// than evenly-spaced placeholder dates: every course gets a midterm around
// week 6-8 and a final in the week 13-14 exam period (real academic-
// calendar convention), plus
// assignment/quiz/lab_report density derived from the course's own credits
// and category — a 1-credit lab gets lab_report entries, a 3-credit
// program_elective gets more assignments, a 'special' (Graduation Project)
// course gets project_deadline milestones instead of quizzes/exams. The
// exact WEEK each of those lands on is hash-jittered per course code so
// different courses don't all cluster on the same week by construction —
// deadline clustering across a student's real course load should be a
// genuine emergent property of which courses they happen to be taking
// together, not an artifact of every syllabus using the same template.
import { Course, MilestoneType, SyllabusMilestone } from '@advisor/shared';
import { CATALOG } from './seedCatalog';

const SEMESTER_WEEKS = 14;
const MIDTERM_WEEK_RANGE: [number, number] = [6, 8];
// Real exam schedules stagger different courses' finals across a ~2-week
// window, not one single simultaneous date — jittering this (like every
// other milestone type here) matters more than it looks: a fixed single
// FINAL_WEEK for every course would guarantee that week is the single
// worst week for literally every student by construction, which would
// drown out the more interesting mid-semester clustering signal (which
// courses' MIDTERMS happen to collide) that institutionalBottleneck.ts's
// whole point is to surface.
const FINAL_WEEK_RANGE: [number, number] = [13, 14];

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Deterministic pseudo-random week in [lo, hi], seeded by courseCode +
 *  a per-milestone salt so repeated calls for the same course don't all
 *  collide on one week. */
function jitteredWeek(courseCode: string, salt: string, lo: number, hi: number): number {
  const h = hash(`${courseCode}::${salt}`);
  return lo + (h % (hi - lo + 1));
}

function milestonesForCourse(course: Course): SyllabusMilestone[] {
  const out: SyllabusMilestone[] = [];
  const push = (weekNumber: number, type: MilestoneType, title: string) =>
    out.push({ id: `${course.code}::${weekNumber}::${type}`, courseCode: course.code, weekNumber, type, title });

  if (course.category === 'special') {
    // Graduation Project (1)/(2) — milestone-driven, not exam-driven.
    push(jitteredWeek(course.code, 'proposal', 3, 5), 'project_deadline', `${course.name} — proposal submission`);
    push(jitteredWeek(course.code, 'midreview', 8, 9), 'project_deadline', `${course.name} — mid-term progress review`);
    push(jitteredWeek(course.code, 'finalproj', FINAL_WEEK_RANGE[0], FINAL_WEEK_RANGE[1]), 'project_deadline', `${course.name} — final submission & defense`);
    return out;
  }

  // Lab courses (1-credit, name ends "Lab") — weekly lab_report cadence
  // instead of a written midterm/final, matching how this catalog already
  // pairs every lecture course with its own separate 1-credit lab code.
  const isLab = course.credits === 1 && /lab/i.test(course.name);
  if (isLab) {
    const reportCount = 3;
    for (let i = 0; i < reportCount; i++) {
      const week = 3 + i * 3 + jitteredWeek(course.code, `lab${i}`, 0, 2);
      push(Math.min(week, 13), 'lab_report', `${course.name} — lab report ${i + 1}`);
    }
    return out;
  }

  // Everything else: quizzes + assignments scaled by credit hours, one
  // midterm, one final. A 1-credit seminar/UR course gets a lighter load
  // than a 3-credit program core.
  const quizCount = course.credits >= 3 ? 2 : 1;
  const assignmentCount = course.credits >= 3 ? 2 : course.credits === 2 ? 1 : 0;

  for (let i = 0; i < quizCount; i++) {
    const [loBase, hiBase] = i === 0 ? [2, 5] : [9, 12];
    push(jitteredWeek(course.code, `quiz${i}`, loBase, hiBase), 'quiz', `${course.name} — quiz ${i + 1}`);
  }
  for (let i = 0; i < assignmentCount; i++) {
    const [loBase, hiBase] = i === 0 ? [3, 6] : [10, 13];
    push(jitteredWeek(course.code, `hw${i}`, loBase, hiBase), 'assignment', `${course.name} — assignment ${i + 1}`);
  }

  const [midLo, midHi] = MIDTERM_WEEK_RANGE;
  push(jitteredWeek(course.code, 'midterm', midLo, midHi), 'midterm', `${course.name} — midterm exam`);
  push(jitteredWeek(course.code, 'final', FINAL_WEEK_RANGE[0], FINAL_WEEK_RANGE[1]), 'final', `${course.name} — final exam`);

  return out;
}

export const SYLLABUS_MILESTONES: SyllabusMilestone[] = CATALOG.flatMap(milestonesForCourse);

// Verified, not assumed (see this file's header): a milestone's id needs
// to be genuinely unique for the "mark done" feature to toggle the right
// one. Fails loudly at import time — the moment a future edit to the
// generator above ever violates the non-overlapping-week-ranges
// assumption — rather than silently letting two different deadlines share
// a checkbox.
{
  const seen = new Set<string>();
  for (const m of SYLLABUS_MILESTONES) {
    if (seen.has(m.id)) throw new Error(`seedSyllabusMilestones: duplicate milestone id ${m.id} — generator invariant broken`);
    seen.add(m.id);
  }
}

export const MILESTONES_BY_COURSE: Record<string, SyllabusMilestone[]> = SYLLABUS_MILESTONES.reduce(
  (acc, m) => {
    (acc[m.courseCode] ??= []).push(m);
    return acc;
  },
  {} as Record<string, SyllabusMilestone[]>
);

export { SEMESTER_WEEKS };
