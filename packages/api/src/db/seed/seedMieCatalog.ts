// Real EJUST MIE (Biomedical & Bioinformatics Engineering) program catalog
// — transcribed from `FOE Handbook.pdf`, "Study Plan for MIE Program
// (Semester 4:Semester 9)" (p.30) plus the Biomedical/Bioinformatics
// Engineering Track Elective Courses (p.41-42), combined into one elective
// pool since this catalog doesn't model the two elective tracks separately
// (only their shared core requirements).
import { Course } from '@advisor/shared';
import {
  c, SHARED_SEM_1_3, LRA202, LRA103, LRA102, LRA201, LRAE1, LRAE2, LRAE3, LRAE4,
  BIO121, EPE221, EPE222, CSE213, IME221, ECE221, ECE222, MTE324, MTE325,
} from './seedFoeSharedCourses';

export const MIE_CATALOG: Course[] = [
  ...SHARED_SEM_1_3,

  // ---- Semester 4 (identical to ECE's own semester 4) ----
  LRA202, LRA103, LRAE1, BIO121, EPE221, EPE222, CSE213, IME221, ECE221, ECE222,

  // ---- Semester 5 ----
  LRAE2,
  c('ECE310', 'Microprocessors and Microcontrollers', 2, 5, ['ECE221'], ['ECE311'], 'program'),
  c('ECE311', 'Microprocessors and Microcontrollers Lab', 1, 5, [], ['ECE310'], 'program'),
  c('MIE211', 'Human Biology', 3, 5, ['BIO121'], [], 'program'),
  c('MIE312', 'Pathophysiology', 2, 5, ['BIO121'], ['MIE313'], 'program'),
  c('MIE313', 'Pathophysiology Lab', 1, 5, [], ['MIE312'], 'program'),
  c('ECE314', 'Signals and Systems', 2, 5, ['MTH121'], ['ECE315'], 'program'),
  c('ECE315', 'Signals and Systems Lab', 1, 5, [], ['ECE314'], 'program'),
  c('MIE314', 'Biomedical Electronics', 3, 5, ['ECE211'], ['MIE315'], 'program'),
  c('MIE315', 'Biomedical Electronics Lab', 1, 5, [], ['MIE314'], 'program'),

  // ---- Semester 6 ----
  LRA102, LRAE3,
  c('MIE426', 'Project Based Learning on Biomedical and Bioinformatics Engineering', 3, 6, ['MIE314'], [], 'program'),
  c('MIE320', 'Medical Instruments and Instrumentation', 3, 6, ['EPE221'], [], 'program'),
  c('MIE322', 'Biomedical Signal Processing', 3, 6, ['ECE314'], [], 'program'),
  c('MIE325', 'Bioinformatics (1)', 2, 6, ['MIE312'], ['MIE326'], 'program'),
  c('MIE326', 'Bioinformatics (1) Lab', 1, 6, [], ['MIE325'], 'program'),
  c('MIE414', 'Data Structures & Algorithms', 3, 6, ['CSE212'], [], 'program'),

  // ---- Semester 7 ----
  LRAE4,
  c('MIE410', 'Medical Image Processing', 3, 7, ['MIE322'], [], 'program'),
  c('MIE412', 'Computational Biology', 3, 7, ['MIE322'], [], 'program'),
  c('MIEEL1', 'Program Elective 1', 3, 7, [], [], 'program_elective'),
  c('MIEEL2', 'Program Elective 2', 3, 7, [], [], 'program_elective'),
  c('MIEEL3', 'Program Elective 3', 3, 7, [], [], 'program_elective'),

  // ---- Semester 8 ----
  LRA201,
  c('MIE422', 'HealthCare Information Systems', 3, 8, ['MIE414'], [], 'program'),
  MTE324, MTE325,
  c('MIEEL4', 'Program Elective 4', 3, 8, [], [], 'program_elective'),
  c('MIEEL5', 'Program Elective 5', 3, 8, [], [], 'program_elective'),
  c('MIE424', 'Graduation Project (1)', 3, 8, ['MIE410'], [], 'special'),

  // ---- Semester 9 ----
  c('MIE428', 'Graduation Project (2)', 7, 9, ['MIE424'], [], 'special'),
  c('MIE499', 'Industrial Training (2 Modules)', 4, 9, [], [], 'special'),
];

// Combined Biomedical + Bioinformatics Engineering track electives
// (handbook p.41-42) — resolves MIEEL1..5.
export const MIE_ELECTIVE_POOL = [
  { code: 'MIE316', name: 'Biomedical Sensors and Actuators', credits: 3, prereq: ['MIE314'] },
  { code: 'MIE430', name: 'Seminar on Biomedical Engineering', credits: 3, prereq: ['MIE314'] },
  { code: 'MIE328', name: 'Fundamentals of Electromagnetics', credits: 3, prereq: ['ECE314'] },
  { code: 'MIE421', name: 'Digital Communications', credits: 3, prereq: ['MIE322'] },
  { code: 'MIE420', name: 'Medical Imaging', credits: 3, prereq: ['MIE410'] },
  { code: 'ECE433', name: 'Digital Integrated Circuits', credits: 3, prereq: ['ECE221'] },
  { code: 'ECE434', name: 'Embedded Systems', credits: 3, prereq: ['ECE310'] },
  { code: 'ECE438', name: 'Mobile Communication Systems', credits: 3, prereq: ['ECE314'] },
  { code: 'ECE439', name: 'Data Communication Networks', credits: 3, prereq: ['MIE414'] },
  { code: 'MIE423', name: 'Computer Graphics and Visualization', credits: 3, prereq: ['MIE414'] },
  { code: 'MIE437', name: 'Artificial Intelligence', credits: 3, prereq: ['MIE414'] },
  { code: 'MIE310', name: 'Safety & Security of Health Information System', credits: 2, prereq: [] },
  { code: 'MIE450', name: 'Seminar on Bioinformatics Engineering', credits: 3, prereq: ['MIE325'] },
  { code: 'MIE452', name: 'Pattern Recognition & Decision Making', credits: 3, prereq: ['MIE325'] },
  { code: 'MIE454', name: 'Big Data Management', credits: 3, prereq: ['MIE422'] },
  { code: 'MIE456', name: 'Management and Design of Health Care Systems', credits: 3, prereq: ['MIE422'] },
  { code: 'MIE458', name: 'Algorithms in Bioinformatics', credits: 3, prereq: ['MIE325'] },
  { code: 'MIE460', name: 'Telemedicine', credits: 3, prereq: ['MIE422'] },
  { code: 'MIE462', name: 'Genomic Bioinformatics', credits: 3, prereq: ['MIE325'] },
  { code: 'MIE464', name: 'Computational Biology Techniques', credits: 3, prereq: ['MIE412'] },
  { code: 'MIE466', name: 'Database Systems', credits: 3, prereq: ['MIE414'] },
  { code: 'MIE468', name: 'Scripting Languages in Bioinformatics', credits: 3, prereq: ['CSE211', 'MIE325'] },
];
