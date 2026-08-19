// Real EJUST CPE (Chemical & Petrochemical Engineering) program catalog —
// transcribed from `FOE Handbook.pdf`, "Study Plan for CPE Program
// (Semester 4: Semester 9)" (p.33) plus "CPE Program Elective Courses"
// (p.40).
import { Course } from '@advisor/shared';
import {
  c, SHARED_SEM_1_3, LRA202, LRA103, LRA102, LRA201, LRAE1, LRAE2, LRAE3, LRAE4,
  BIO121, EPE221, EPE222, CPE213, CPE221, CPE223, ERE222,
} from './seedFoeSharedCourses';

export const CPE_CATALOG: Course[] = [
  ...SHARED_SEM_1_3,

  // ---- Semester 4 (no ERE221 lecture — CPE takes only ERE222's lab
  // portion alongside its own CPE213/221/223, exactly as the handbook's own
  // CPE and ENV tables show) ----
  LRA202, LRA103, LRAE1, BIO121, EPE221, EPE222, CPE213, CPE221, ERE222, CPE223,

  // ---- Semester 5 ----
  LRAE2,
  c('CPE311', 'Seminar on CPE', 2, 5, [], [], 'program'),
  c('CPE312', 'Fundamentals of Heat and Mass Transfer', 3, 5, ['CPE213'], [], 'program'),
  c('CPE313', 'Chemical Process Technologies I (Organic)', 3, 5, [], [], 'program'),
  c('CPE314', 'Chemical Process Technologies II (Inorganic)', 3, 5, [], [], 'program'),
  c('CPE315', 'Chemical Reaction Kinetics', 3, 5, [], [], 'program'),
  c('CPE316', 'Corrosion and Electrochemical Eng.', 3, 5, [], [], 'program'),

  // ---- Semester 6 ----
  LRA102, LRAE3,
  c('CPE321', 'Project Based Learning on CPE', 2, 6, [], [], 'program'),
  c('CPE322', 'Chemical Process Technologies III (Gas and Petrochemicals)', 3, 6, [], [], 'program'),
  c('CPE323', 'Separation Processes', 3, 6, ['CPE312'], [], 'program'),
  c('CPE324', 'Chemical Process Modeling', 3, 6, ['CPE213'], [], 'program'),
  c('CPE325', 'Mechanical Unit Operation', 3, 6, [], [], 'program'),

  // ---- Semester 7 ----
  LRAE4,
  c('CPE411', 'Unit Operations Laboratory', 3, 7, ['CPE312'], [], 'program'),
  c('CPE412', 'Chemical Process Control', 3, 7, ['CPE213'], [], 'program'),
  c('CPEEL1', 'Program Elective 1', 3, 7, [], [], 'program_elective'),
  c('CPEEL2', 'Program Elective 2', 3, 7, [], [], 'program_elective'),
  c('CPEEL3', 'Program Elective 3', 3, 7, [], [], 'program_elective'),

  // ---- Semester 8 ----
  LRA201,
  c('CPE421', 'Clean Production and Sustainable Development', 3, 8, ['CPE313', 'CPE314'], [], 'program'),
  c('CPE422', 'Plant Design and Economics', 3, 8, ['CPE323'], [], 'program'),
  c('CPEEL4', 'Program Elective 4', 3, 8, [], [], 'program_elective'),
  c('CPEEL5', 'Program Elective 5', 3, 8, [], [], 'program_elective'),
  c('CPE420', 'Graduation Project (1)', 3, 8, [], [], 'special'),

  // ---- Semester 9 ----
  c('CPE500', 'Graduation Project (2)', 7, 9, ['CPE420'], [], 'special'),
  c('CPE499', 'Industrial Training (2 Modules)', 4, 9, [], [], 'special'),
];

// CPE Program Elective Courses (handbook p.40) — resolves CPEEL1..5.
export const CPE_ELECTIVE_POOL = [
  { code: 'CPE423', name: 'Catalysis Engineering', credits: 3, prereq: ['CPE315'] },
  { code: 'CPE424', name: 'Desalination Technologies', credits: 3, prereq: ['CPE312'] },
  { code: 'CPE425', name: 'Design of Waste Treatment Units', credits: 3, prereq: ['CPE323'] },
  { code: 'CPE426', name: 'Biofuel Engineering', credits: 3, prereq: ['CPE313'] },
  { code: 'CPE427', name: 'Chemical Engineering Computer Skills', credits: 3, prereq: ['CSE211'] },
  { code: 'CPE428', name: 'Renewable Energy Resources and Engineering', credits: 3, prereq: [] },
  { code: 'CPE429', name: 'Fuel Cell Engineering', credits: 3, prereq: ['CPE315'] },
  { code: 'CPE430', name: 'Surface Analysis', credits: 3, prereq: ['CPE316'] },
  { code: 'CPE431', name: 'Biochemical Engineering and Biotechnology', credits: 3, prereq: ['CPE315'] },
  { code: 'CPE432', name: 'Process Optimization', credits: 3, prereq: ['CPE324'] },
  { code: 'CPE433', name: 'Air Pollution Control', credits: 3, prereq: [] },
  { code: 'CPE434', name: 'Chemical Process Safety', credits: 3, prereq: ['CPE412'] },
  { code: 'CPE435', name: 'Introduction to Nanotechnology', credits: 3, prereq: [] },
  { code: 'CPE436', name: 'Biochemicals and Food Industry', credits: 3, prereq: ['CPE313'] },
  { code: 'CPE437', name: 'Chemical Engineering Materials', credits: 3, prereq: [] },
  { code: 'CPE438', name: 'Unit Operations in Pharmaceutical Industry', credits: 3, prereq: ['CPE411'] },
  { code: 'CPE439', name: 'Seminar in Chemical Engineering (II)', credits: 3, prereq: ['CPE311'] },
  { code: 'CPE440', name: 'Petroleum Engineering', credits: 3, prereq: ['CPE314'] },
  { code: 'CPE441', name: 'Polymers Engineering', credits: 3, prereq: ['CPE313'] },
];
