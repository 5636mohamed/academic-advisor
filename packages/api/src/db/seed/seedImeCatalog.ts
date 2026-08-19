// Real EJUST IME (Industrial & Manufacturing Engineering) program catalog —
// transcribed from `FOE Handbook.pdf`, "Study Plan for IME Program-IE Track
// (Semester 4: Semester 9)" (p.28) plus the "IME (Industrial Engineering
// Track) Program Elective Courses" (p.38). The handbook's IME program also
// has an ME (Manufacturing Engineering) track whose required courses
// diverge from semester 6 onward — not modeled here; only the IE track is
// seeded (see the department-expansion plan's documented simplification).
import { Course } from '@advisor/shared';
import {
  c, SHARED_SEM_1_3, LRA202, LRA103, LRA102, LRA201, LRAE1, LRAE2, LRAE3, LRAE4,
  BIO121, EPE221, EPE222, IME221, MTE211, ERE221, ERE222,
} from './seedFoeSharedCourses';

export const IME_CATALOG: Course[] = [
  ...SHARED_SEM_1_3,

  // ---- Semester 4 ----
  LRA202, LRA103, LRAE1, BIO121, EPE221, EPE222, MTE211, IME221, ERE221, ERE222,

  // ---- Semester 5 (IE Track) ----
  LRAE2,
  c('IME311', 'Seminar on IME', 2, 5, [], [], 'program'),
  c('IME312', 'Operations Research (1)', 3, 5, [], [], 'program'),
  c('IME313', 'Mechanical Design (1)', 3, 5, ['MCE111', 'IME121'], [], 'program'),
  c('IME314', 'Conventional Machining Processes', 3, 5, ['IME211'], ['IME315'], 'program'),
  c('IME315', 'Machining Workshop', 3, 5, ['IME212'], ['IME314'], 'program'),
  c('IME316', 'Production and Operations Management', 3, 5, [], [], 'program'),

  // ---- Semester 6 (IE Track) ----
  LRA102, LRAE3,
  c('IME412', 'Management Information Systems', 3, 6, ['IME316'], [], 'program'),
  c('IME321', 'Statistical Quality Control', 3, 6, ['MTH211'], [], 'program'),
  c('IME322', 'Metrology and Precision Engineering', 2, 6, [], ['IME323'], 'program'),
  c('IME323', 'Precision Engineering Lab', 1, 6, [], ['IME322'], 'program'),
  c('IME325', 'Ergonomics and Human Factors Engineering', 2, 6, [], ['IME326'], 'program'),
  c('IME326', 'Ergonomics and Human Factor Lab', 1, 6, [], ['IME325'], 'program'),
  c('IME421', 'Supply Chain and Logistics Management', 3, 6, ['IME316'], [], 'program'),

  // ---- Semester 7 (IE Track) ----
  LRAE4,
  c('IME320', 'Project Based Learning on IME', 2, 7, [], [], 'program'),
  c('IME411', 'Facility Layout and Material Handling', 3, 7, ['IME312'], [], 'program'),
  c('IMEEL1', 'Program Elective 1', 3, 7, [], [], 'program_elective'),
  c('IMEEL2', 'Program Elective 2', 3, 7, [], [], 'program_elective'),
  c('IMEEL3', 'Program Elective 3', 3, 7, [], [], 'program_elective'),

  // ---- Semester 8 (IE Track) ----
  LRA201,
  c('IME324', 'Mathematics (3)', 3, 8, ['MTH121'], [], 'program'),
  c('IME423', 'Computer-Integrated Manufacturing (CIM)', 3, 8, ['IME316'], [], 'program'),
  c('IMEEL4', 'Program Elective 4', 3, 8, [], [], 'program_elective'),
  c('IMEEL5', 'Program Elective 5', 3, 8, [], [], 'program_elective'),
  c('IME420', 'Graduation Project (1)', 3, 8, [], [], 'special'),

  // ---- Semester 9 ----
  c('IME500', 'Graduation Project (2)', 7, 9, ['IME420'], [], 'special'),
  c('IME499', 'Industrial Training (2 Modules)', 4, 9, [], [], 'special'),
];

// IME (Industrial Engineering Track) Program Elective Courses (handbook
// p.38) — resolves IMEEL1..5.
export const IME_ELECTIVE_POOL = [
  { code: 'IME431', name: 'Industrial Safety and Work Hygiene', credits: 3, prereq: ['IME111'] },
  { code: 'IME432', name: 'Statistical Design and Analysis of Experiments', credits: 3, prereq: ['MTH211'] },
  { code: 'IME433', name: 'Product Design and Development', credits: 3, prereq: [] },
  { code: 'IME441', name: 'Simulation Modeling and Analysis', credits: 3, prereq: ['MTH211', 'IME312'] },
  { code: 'IME442', name: 'Operations Research (2)', credits: 3, prereq: ['IME312'] },
  { code: 'IME443', name: 'Work Design and Analysis', credits: 3, prereq: ['IME325', 'IME326'] },
  { code: 'IME444', name: 'Mathematics (4)', credits: 3, prereq: ['IME324'] },
  { code: 'IME445', name: 'Advanced Project Management', credits: 3, prereq: ['IME221'] },
  { code: 'IME451', name: 'Advanced Statistical Methods', credits: 3, prereq: ['MTH211'] },
  { code: 'IME452', name: 'Inventory Management and Control', credits: 3, prereq: ['IME316'] },
  { code: 'IME453', name: 'Accounting and Finance for Engineers', credits: 3, prereq: [] },
  { code: 'IME454', name: 'Strategic Management', credits: 3, prereq: [] },
  { code: 'IME455', name: 'Total Quality Management', credits: 3, prereq: [] },
  { code: 'IME456', name: 'Engineering Economic Analysis', credits: 3, prereq: [] },
  { code: 'IME457', name: 'Macro and Microeconomics', credits: 3, prereq: [] },
  { code: 'IME458', name: 'Marketing for Engineers', credits: 3, prereq: [] },
  { code: 'IME459', name: 'Systems Engineering', credits: 3, prereq: [] },
];
