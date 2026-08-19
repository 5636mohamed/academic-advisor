// Real EJUST ECE (Electronics & Communications Engineering) program
// catalog — transcribed from `FOE Handbook.pdf`, "Study Plan for ECE
// Program (Semester 4: Semester 9)" (p.25) plus "ECE Program Elective
// Courses" (p.37). Semesters 1-3 and every course ECE shares with 2+ other
// programs live in `seedFoeSharedCourses.ts` — this file only adds ECE's
// own courses, then this module also composes the full 10-program union
// (`CATALOG`) that the rest of the app imports.
import { Course } from '@advisor/shared';
import {
  c, SHARED_SEM_1_3, LRA202, LRA103, LRA102, LRA201, LRAE1, LRAE2, LRAE3, LRAE4,
  BIO121, EPE221, EPE222, CSE213, IME221, ECE221, ECE222, MTE324, MTE325,
} from './seedFoeSharedCourses';
import { CSE_CATALOG, CSE_ELECTIVE_POOL } from './seedCseCatalog';
import { MIE_CATALOG, MIE_ELECTIVE_POOL } from './seedMieCatalog';
import { EPE_CATALOG, EPE_ELECTIVE_POOL } from './seedEpeCatalog';

export const ECE_CATALOG: Course[] = [
  ...SHARED_SEM_1_3,

  // ---- Semester 4 ----
  LRA202, LRA103, LRAE1, BIO121, EPE221, EPE222, CSE213, IME221, ECE221, ECE222,

  // ---- Semester 5 ----
  LRAE2,
  c('ECE310', 'Microprocessors and Microcontrollers', 2, 5, ['ECE221'], ['ECE311'], 'program'),
  c('ECE311', 'Microprocessors and Microcontrollers Lab', 1, 5, [], ['ECE310'], 'program'),
  c('ECE312', 'Electric Circuits', 2, 5, ['EPE121'], ['ECE313'], 'program'),
  c('ECE313', 'Electric Circuits Lab', 1, 5, [], ['ECE312'], 'program'),
  c('ECE314', 'Signals and Systems', 2, 5, ['MTH121'], ['ECE315'], 'program'),
  c('ECE315', 'Signals and Systems Lab', 1, 5, [], ['ECE314'], 'program'),
  c('ECE316', 'Engineering Mathematics', 3, 5, ['MTH121'], [], 'program'),
  c('ECE317', 'Electronic Devices', 2, 5, ['PHY121', 'MTH121'], ['ECE318'], 'program'),
  c('ECE318', 'Electronic Devices Lab', 1, 5, [], ['ECE317'], 'program'),
  c('ECE319', 'Seminar on ECE', 2, 5, ['EPE221', 'ECE221'], [], 'program'),

  // ---- Semester 6 ----
  LRA102, LRAE3,
  c('ECE321', 'Project Based Learning on ECE', 2, 6, ['ECE310'], [], 'program'),
  c('ECE322', 'Electronic Circuits', 2, 6, ['ECE211'], ['ECE323'], 'program'),
  c('ECE323', 'Electronic Circuits Lab', 1, 6, [], ['ECE322'], 'program'),
  c('ECE324', 'Digital Signal Processing', 2, 6, ['ECE314'], ['ECE325'], 'program'),
  c('ECE325', 'Digital Signal Processing Lab', 1, 6, [], ['ECE324'], 'program'),
  c('ECE326', 'Communications Systems Fundamentals', 2, 6, ['ECE314', 'ECE316'], ['ECE327'], 'program'),
  c('ECE327', 'Communications Systems Fundamentals Lab', 1, 6, [], ['ECE326'], 'program'),
  c('ECE328', 'Engineering Electromagnetics', 2, 6, ['ECE316'], ['ECE329'], 'program'),
  c('ECE329', 'Engineering Electromagnetics Lab', 1, 6, [], ['ECE328'], 'program'),

  // ---- Semester 7 ----
  LRAE4,
  c('ECE411', 'Electromagnetic Fields and Waves', 2, 7, ['ECE328'], ['ECE412'], 'program'),
  c('ECE412', 'Electromagnetic Fields and Waves Lab', 1, 7, [], ['ECE411'], 'program'),
  c('ECE413', 'Digital Communications Systems', 2, 7, ['MTH211', 'ECE326'], ['ECE414'], 'program'),
  c('ECE414', 'Digital Communications Systems Lab', 1, 7, [], ['ECE413'], 'program'),
  c('ECEEL1', 'Program Elective 1', 3, 7, [], [], 'program_elective'),
  c('ECEEL2', 'Program Elective 2', 3, 7, [], [], 'program_elective'),
  c('ECEEL3', 'Program Elective 3', 3, 7, [], [], 'program_elective'),

  // ---- Semester 8 ----
  LRA201,
  MTE324, MTE325,
  c('ECE421', 'Principles of Information Theory and Coding', 2, 8, ['ECE413'], ['ECE422'], 'program'),
  c('ECE422', 'Principles of Information Theory and Coding Lab', 1, 8, [], ['ECE421'], 'program'),
  c('ECEEL4', 'Program Elective 4', 3, 8, [], [], 'program_elective'),
  c('ECEEL5', 'Program Elective 5', 3, 8, [], [], 'program_elective'),
  c('ECE420', 'Graduation Project (1)', 3, 8, [], [], 'special'),

  // ---- Semester 9 ----
  c('ECE500', 'Graduation Project (2)', 7, 9, ['ECE420'], [], 'special'),
  c('ECE499', 'Industrial Training (2 Modules)', 4, 9, [], [], 'special'),
];

// ECE Program Elective Courses (handbook p.37) — resolves ECEEL1..5.
export const ECE_ELECTIVE_POOL = [
  { code: 'ECE430', name: 'Radio Frequency Electronics', credits: 3, prereq: ['ECE317', 'ECE322'] },
  { code: 'ECE431', name: 'CMOS Analog Integrated Circuits', credits: 3, prereq: ['ECE317', 'ECE322'] },
  { code: 'ECE432', name: 'Digital VLSI Modeling and Design', credits: 3, prereq: ['ECE310'] },
  { code: 'ECE433', name: 'Digital Integrated Circuits', credits: 3, prereq: ['ECE221', 'ECE322'] },
  { code: 'ECE434', name: 'Embedded Systems', credits: 3, prereq: ['ECE310'] },
  { code: 'ECE435', name: 'Fundamentals of Wireless Communications', credits: 3, prereq: ['ECE413'] },
  { code: 'ECE436', name: 'Optical Communications Devices', credits: 3, prereq: ['ECE317'] },
  { code: 'ECE437', name: 'Satellite Communications', credits: 3, prereq: ['ECE413'] },
  { code: 'ECE438', name: 'Mobile Communication Systems', credits: 3, prereq: ['ECE413'] },
  { code: 'ECE439', name: 'Data Communication Networks', credits: 3, prereq: ['ECE326'] },
  { code: 'ECE441', name: 'Microwave Engineering', credits: 3, prereq: ['ECE328', 'ECE411'] },
  { code: 'ECE442', name: 'Antenna Engineering and Remote Sensing', credits: 3, prereq: ['ECE328', 'ECE411'] },
  { code: 'ECE443', name: 'Advanced Topics in Signal Processing', credits: 3, prereq: ['ECE324'] },
  { code: 'ECE444', name: 'Digital Image Processing', credits: 3, prereq: ['ECE324'] },
  { code: 'MTE434', name: 'Sensors & Actuators', credits: 3, prereq: ['EPE221'] },
];

export const UR_ELECTIVE_POOLS: Record<string, string[]> = {
  LRAE1: ['Music and Technology', 'Theater and Drama', 'Physical Education', 'Selected Topics in Japanese Arts', 'Art and Architecture of Ancient Egypt', 'Introduction to Cultural Anthropology', 'Modern Egyptian History'],
  LRAE2: ['Entrepreneurship and Innovation', 'Public Policy', 'Egyptian Business Regulations', 'Sociology of Work', 'African and Middle Eastern Studies'],
  LRAE3: ['Introduction to Life Sciences', 'Introduction to Environmental Biology', 'Water and Politics in Africa and Middle East', 'Astronomy and Space Science', 'Natural Resources and Sustainability'],
  LRAE4: ['Japanese Language (3)', 'Japanese Language (4)', 'English Language', 'Arabic Language', 'Research Methods', 'Fundamentals of Communication', 'Transformational Leadership'],
};

// ---- The full 10-real-program union every other module imports. ----

/** Per-department real course-code sets — the "does this code map to a
 *  requirement slot in department X" question the transfer engine (§7.1)
 *  and the seed pipeline's transcript gap-filler both need answered for
 *  real, now that 10 real catalogs exist instead of one. */
export const CATALOG_BY_DEPARTMENT: Record<string, Course[]> = {
  ECE: ECE_CATALOG,
  CSE: CSE_CATALOG,
  MIE: MIE_CATALOG,
  EPE: EPE_CATALOG,
};

function dedupeByCode(courses: Course[]): Course[] {
  const seen = new Map<string, Course>();
  for (const course of courses) {
    const existing = seen.get(course.code);
    if (existing && JSON.stringify(existing) !== JSON.stringify(course)) {
      // Every genuinely cross-program code is meant to be the SAME shared
      // object (see seedFoeSharedCourses.ts) — this only fires if a new
      // program catalog accidentally redefines a shared code independently
      // (with any different field, not just semesterOrdinal) instead of
      // importing the canonical one.
      throw new Error(`seedCatalog: course code ${course.code} defined twice with conflicting fields:\n  ${JSON.stringify(existing)}\n  ${JSON.stringify(course)}`);
    }
    if (!existing) seen.set(course.code, course);
  }
  return [...seen.values()];
}

export const CATALOG: Course[] = dedupeByCode(Object.values(CATALOG_BY_DEPARTMENT).flat());

export const CATALOG_BY_CODE: Record<string, Course> = Object.fromEntries(CATALOG.map(x => [x.code, x]));

// Per-department elective pools, keyed the same way CATALOG_BY_DEPARTMENT
// is — resolves each department's own XXXEL1..5 program-elective slots.
export const ELECTIVE_POOL_BY_DEPARTMENT: Record<string, typeof ECE_ELECTIVE_POOL> = {
  ECE: ECE_ELECTIVE_POOL,
  CSE: CSE_ELECTIVE_POOL,
  MIE: MIE_ELECTIVE_POOL,
  EPE: EPE_ELECTIVE_POOL,
};
