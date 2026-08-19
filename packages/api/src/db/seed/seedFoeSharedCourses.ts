// Real EJUST FoE course data shared across 2+ of the 10 real programs
// (source: `FOE Handbook.pdf`, repo root — "Appendix A: Study Plans and
// Elective Courses of FoE Programs", pages 24-42). Every program catalog
// file (`seedEceCatalog.ts`/`seedCseCatalog.ts`/etc.) imports these instead
// of redefining them, so a shared course's fields can never drift between
// two programs that both take it.
import { Course, CourseCategory } from '@advisor/shared';

// A handful of course codes recur across programs at a *different* semester
// than this file fixes them at (e.g. the handbook schedules ECE221/222 in
// MTE's and MSE's own semester 5, one semester later than ECE/CSE/EPE/MIE's
// semester 4) — a real consequence of every program sharing one flat,
// code-keyed `CATALOG_BY_CODE`, which can only hold one semesterOrdinal per
// code. Every such shared course below keeps the semester its first (and,
// for ECE, already-tested) adopter uses; later programs that take the same
// course at a different point in their own real plan inherit this file's
// placement rather than getting a second, conflicting Course record for the
// same code. Documented simplification, not a data error.

// Basic-science courses (§7.2.1) — the ones a faculty transfer's
// `CourseEquivalencyMap` reasons about. Shared identically across every FoE
// program's first three semesters.
export const BASIC_SCIENCE_CODES = new Set([
  'MTH111', 'MTH121', 'PHY111', 'PHY121', 'CHM111', 'CHM121', 'CSE211',
]);

export function c(
  code: string, name: string, credits: number, sem: number,
  prereq: string[], coreq: string[], category: CourseCategory, isUR = false
): Course {
  return {
    code, name, credits, level: Math.ceil(sem / 2), semesterOrdinal: sem,
    category, isUR, isBasicScience: BASIC_SCIENCE_CODES.has(code),
    departmentId: null, prereq, coreq, transferable: isUR || BASIC_SCIENCE_CODES.has(code),
  };
}

// ---- Semesters 1-3: identical for all 10 FoE programs (handbook p.24,
// "Study Plan for Semester 1: Semester 3 (FoE-All Programs)"). ----
export const SHARED_SEM_1_3: Course[] = [
  c('LRA101', 'Japanese Culture', 2, 1, [], [], 'ur_core', true),
  c('LRA405', 'Key Skills Seminar (1)', 2, 1, [], [], 'ur_core', true),
  c('LRA401', 'Japanese Language (1)', 1, 1, [], [], 'ur_core', true),
  c('MTH111', 'Mathematics (1) (Calculus + Linear Algebra)', 3, 1, [], [], 'faculty'),
  c('PHY111', 'Physics (1)', 3, 1, [], ['PHY112'], 'faculty'),
  c('CHM111', 'Chemistry (1)', 2, 1, [], ['CHM112'], 'faculty'),
  c('PHY112', 'Basic Sciences Lab-1 (Physics 1)', 1, 1, [], ['PHY111'], 'faculty'),
  c('CHM112', 'Basic Sciences Lab-2 (Chemistry 1)', 1, 1, [], ['CHM111'], 'faculty'),
  c('MCE111', 'Mechanics (Statics + Dynamics)', 3, 1, [], [], 'faculty'),
  c('IME111', 'Safety and Risk Management', 2, 1, [], [], 'faculty'),

  c('LRA402', 'Japanese Language (2)', 1, 2, ['LRA401'], [], 'ur_core', true),
  c('LRA406', 'Key Skills Seminar (2)', 2, 2, ['LRA405'], [], 'ur_core', true),
  c('MTH121', 'Mathematics (2) (Calculus + Linear Algebra)', 3, 2, ['MTH111'], [], 'faculty'),
  c('PHY121', 'Physics (2)', 3, 2, ['PHY111'], ['PHY122'], 'faculty'),
  c('CHM121', 'Chemistry (2)', 2, 2, ['CHM111'], ['CHM122'], 'faculty'),
  c('PHY122', 'Basic Science Lab-3 (Physics 2)', 1, 2, [], ['PHY121'], 'faculty'),
  c('CHM122', 'Basic Science Lab-4 (Chemistry 2)', 1, 2, [], ['CHM121'], 'faculty'),
  c('EPE121', 'Electrical Engineering (Circuits + Machines)', 3, 2, ['PHY111'], ['EPE122'], 'faculty'),
  c('EPE122', 'Electrical Engineering Lab (Circuits + Machines)', 1, 2, [], ['EPE121'], 'faculty'),
  c('IME121', 'Engineering Drawing', 3, 2, [], [], 'faculty'),

  c('LRA301', 'Environment and Earth Science', 2, 3, [], [], 'ur_core', true),
  c('MTH211', 'Probability and Statistics', 2, 3, ['MTH111'], [], 'faculty'),
  c('CSE211', 'Computer Programming', 2, 3, [], ['CSE212'], 'faculty'),
  c('CSE212', 'Computer Programming Lab', 1, 3, [], ['CSE211'], 'faculty'),
  c('ECE211', 'Introduction to Electronics Engineering', 2, 3, ['EPE121'], ['ECE212'], 'school'),
  c('ECE212', 'Electronics Engineering Lab', 1, 3, [], ['ECE211'], 'school'),
  c('CPE211', 'Introduction to Energy, Environmental and Chem. Eng.', 2, 3, [], ['CPE212'], 'faculty'),
  c('CPE212', 'Introduction to Energy, Environmental and Chem. Eng. Lab', 1, 3, [], ['CPE211'], 'faculty'),
  c('MSE221', 'Fundamentals of Materials Science', 2, 3, [], ['MSE222'], 'faculty'),
  c('MSE222', 'Materials Science Lab', 1, 3, [], ['MSE221'], 'faculty'),
  c('IME211', 'Introduction to Manufacturing Processes', 2, 3, ['IME121'], ['IME212'], 'faculty'),
  c('IME212', 'Manufacturing Processes Laboratory', 1, 3, ['IME111'], ['IME211'], 'faculty'),
];

// ---- LRA core rotations reused verbatim by every program (same code, same
// semester, wherever it recurs in a program's own semester-4-9 table). ----
export const LRA202 = c('LRA202', 'Peace Studies', 2, 4, [], [], 'ur_core', true);
export const LRA103 = c('LRA103', 'Fine Arts Appreciation, Drawing, and Painting', 2, 4, [], [], 'ur_core', true);
export const LRA102 = c('LRA102', 'Introduction to Philosophy', 2, 6, [], [], 'ur_core', true);
export const LRA201 = c('LRA201', 'Introduction to Economics and Sustainable Development', 2, 8, [], [], 'ur_core', true);

// UR elective slots — genuinely university-wide, so (unlike program
// electives) every program shares the exact same 4 placeholder codes.
export const LRAE1 = c('LRAE1', 'UR Elective 1 (Arts & Humanities)', 2, 4, [], [], 'ur_elective', true);
export const LRAE2 = c('LRAE2', 'UR Elective 2 (Social Sciences)', 2, 5, [], [], 'ur_elective', true);
export const LRAE3 = c('LRAE3', 'UR Elective 3 (Natural Sciences)', 2, 6, [], [], 'ur_elective', true);
export const LRAE4 = c('LRAE4', 'UR Elective 4 (Key Skills)', 2, 7, [], [], 'ur_elective', true);

// ---- Semester-4 courses reused by 2+ programs. ----
export const BIO121 = c('BIO121', 'Fundamentals of Life Science', 2, 4, [], [], 'program');
export const EPE221 = c('EPE221', 'Measurements and Instrumentations', 2, 4, ['ECE211'], ['EPE222'], 'program');
export const EPE222 = c('EPE222', 'Measurements and Instrumentations Lab', 1, 4, [], ['EPE221'], 'program');
export const CSE213 = c('CSE213', 'Numerical Analysis', 3, 4, ['MTH121', 'CSE211'], [], 'program');
export const IME221 = c('IME221', 'Project Management', 2, 4, [], [], 'program');
export const ECE221 = c('ECE221', 'Digital Logic Design', 2, 4, ['CSE211', 'ECE211'], ['ECE222'], 'program');
export const ECE222 = c('ECE222', 'Digital Logic Design Lab', 1, 4, [], ['ECE221'], 'program');
export const MTE211 = c('MTE211', 'Theory of Machines', 3, 4, ['MCE111'], [], 'program');
export const ERE221 = c('ERE221', 'Thermo-Fluids', 2, 4, ['PHY121'], ['ERE222'], 'program');
export const ERE222 = c('ERE222', 'Thermo-Fluids Lab', 1, 4, [], ['ERE221'], 'program');
export const CPE213 = c('CPE213', 'Material and Energy Balance', 3, 4, [], [], 'program');
export const CPE221 = c('CPE221', 'Fundamentals of Fluid Mechanics', 2, 4, [], [], 'program');
export const CPE223 = c('CPE223', 'Thermodynamics', 2, 4, ['CPE213'], [], 'program');

// ---- MTE324/325 "Automatic Control" — MTE-owned course code, cross-listed
// into several other programs' plans at a LATER point in their own real
// plan (ECE/EPE/MIE/MSE take it at their own semester 8; MTE/IME/ENV, where
// it's a home requirement, take it at semester 6). Canonicalized here at
// semester 6 — the EARLIEST semester any adopter uses — rather than the
// latest, because a shared course must never end up scheduled AFTER
// something that lists it as a prereq (MTE's own MTE414 "Robotics", sem 7,
// requires it) — taking a prereq-satisfying course earlier than a
// particular program's own plan strictly needs is harmless; the reverse
// isn't. ECE/EPE/MIE/MSE's own advising cycles will therefore show it
// available a semester earlier (Level 3 instead of Level 4) than their real
// handbook plan does — a documented simplification of the same kind as
// every other cross-listed-course placement in this file.
export const MTE324 = c('MTE324', 'Automatic Control', 2, 6, ['MTH121'], ['MTE325'], 'program');
export const MTE325 = c('MTE325', 'Automatic Control Lab', 1, 6, [], ['MTE324'], 'program');
