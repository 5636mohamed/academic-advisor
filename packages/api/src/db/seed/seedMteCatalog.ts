// Real EJUST MTE (Mechatronics Engineering) program catalog — transcribed
// from `FOE Handbook.pdf`, "Study Plan for MTE Program (Semester 4:
// Semester 9)" (p.31) plus "MTE Program Elective Courses" (p.39).
import { Course } from '@advisor/shared';
import {
  c, SHARED_SEM_1_3, LRA202, LRA103, LRA102, LRA201, LRAE1, LRAE2, LRAE3, LRAE4,
  BIO121, EPE221, EPE222, IME221, ECE221, ECE222, MTE211, ERE221, ERE222, MTE324, MTE325,
} from './seedFoeSharedCourses';

export const MTE_CATALOG: Course[] = [
  ...SHARED_SEM_1_3,

  // ---- Semester 4 (handbook: no CSE213/ECE221-222 here — MTE takes
  // MTE211/ERE221-222 instead; ECE221/222 are still required later in
  // MTE's own plan, so they're included below in semester 5 at their
  // canonical semester-4 placement — see seedFoeSharedCourses.ts) ----
  LRA202, LRA103, LRAE1, BIO121, EPE221, EPE222, MTE211, IME221, ERE221, ERE222,

  // ---- Semester 5 ----
  LRAE2,
  c('MTE311', 'Seminar on MTE', 2, 5, [], [], 'program'),
  c('MTE312', 'Applied Numerical Analysis', 3, 5, ['MTH121'], [], 'program'),
  c('MTE313', 'Strength of Materials', 3, 5, ['MSE221', 'MCE111'], [], 'program'),
  c('MTE314', 'Mechanical Vibrations', 2, 5, ['MTE211'], ['MTE315'], 'program'),
  c('MTE315', 'Mechanical Vibrations Lab', 1, 5, [], ['MTE314'], 'program'),
  ECE221, ECE222,

  // ---- Semester 6 ----
  LRA102, LRAE3,
  MTE324, MTE325,
  c('MTE321', 'Project Based Learning on MTE', 2, 6, ['MTE312', 'MTE313'], [], 'program'),
  c('MTE322', 'Mechanical Design (1)', 3, 6, ['MTE312', 'MTE313'], [], 'program'),
  c('MTE323', 'Embedded Systems', 3, 6, ['CSE211', 'ECE221'], [], 'program'),
  c('ECE322', 'Electronic Circuits', 2, 6, ['ECE211'], ['ECE323'], 'program'),
  c('ECE323', 'Electronic Circuits Lab', 1, 6, [], ['ECE322'], 'program'),

  // ---- Semester 7 ----
  LRAE4,
  c('MTE411', 'Introduction to Mechatronics', 2, 7, ['MTE211'], ['MTE412'], 'program'),
  c('MTE412', 'Mechatronics Lab', 1, 7, [], ['MTE411'], 'program'),
  c('MTE413', 'Mechanical Design (2)', 3, 7, ['MTE322'], [], 'program'),
  c('MTE414', 'Robotics', 2, 7, ['MTE324'], ['MTE415'], 'program'),
  c('MTE415', 'Robotics Lab', 1, 7, [], ['MTE414'], 'program'),
  c('MTEEL1', 'Program Elective 1', 3, 7, [], [], 'program_elective'),
  c('MTEEL2', 'Program Elective 2', 3, 7, [], [], 'program_elective'),
  c('MTEEL3', 'Program Elective 3', 3, 7, [], [], 'program_elective'),

  // ---- Semester 8 ----
  LRA201,
  c('MTE421', 'Mechatronics Systems Design', 3, 8, ['MTE411'], [], 'program'),
  c('MTE422', 'Pneumatic and Hydraulic Systems', 3, 8, ['ERE221'], [], 'program'),
  c('MTEEL4', 'Program Elective 4', 3, 8, [], [], 'program_elective'),
  c('MTEEL5', 'Program Elective 5', 3, 8, [], [], 'program_elective'),
  c('MTE420', 'Graduation Project (1)', 3, 8, [], [], 'special'),

  // ---- Semester 9 ----
  c('MTE500', 'Graduation Project (2)', 7, 9, ['MTE420'], [], 'special'),
  c('MTE599', 'Industrial Training (2 Modules)', 4, 9, [], [], 'special'),
];

// MTE Program Elective Courses (handbook p.39) — resolves MTEEL1..5.
export const MTE_ELECTIVE_POOL = [
  { code: 'MTE423', name: 'Automatic Control (2)', credits: 3, prereq: ['MTE324', 'MTE325'] },
  { code: 'MTE424', name: 'Digital Control', credits: 3, prereq: ['MTE324', 'MTE325'] },
  { code: 'MTE425', name: 'Industrial Process Control', credits: 3, prereq: ['MTE324', 'MTE325'] },
  { code: 'MTE426', name: 'Programmable Logic Controllers', credits: 3, prereq: ['MTE324', 'MTE325'] },
  { code: 'MTE427', name: 'Electro Hydraulic and Electro Pneumatic Servo Systems', credits: 3, prereq: ['MTE422'] },
  { code: 'MTE428', name: 'Distributed Control Systems', credits: 3, prereq: ['MTE324', 'MTE325'] },
  { code: 'MTE429', name: 'Intelligent Control', credits: 3, prereq: ['MTE324', 'MTE325'] },
  { code: 'MTE430', name: 'Micro Electromechanical Systems (MEMS)', credits: 3, prereq: [] },
  { code: 'MTE431', name: 'Mobile Robots', credits: 3, prereq: ['MTE414'] },
  { code: 'MTE432', name: 'Selected Topics in Robotics', credits: 3, prereq: ['MTE414'] },
  { code: 'MTE433', name: 'Machine Vision', credits: 3, prereq: ['MTE414'] },
  { code: 'MTE434', name: 'Sensors & Actuators', credits: 3, prereq: ['EPE221'] },
  { code: 'MTE435', name: 'Electric Drives', credits: 3, prereq: ['EPE221'] },
  { code: 'MTE436', name: 'Product Design of Mechatronic Systems', credits: 3, prereq: ['MTE421'] },
  { code: 'MTE437', name: 'Introduction to Bio-Mechatronics', credits: 3, prereq: ['MTE411'] },
  { code: 'MTE438', name: 'Artificial Intelligence in Mechatronics and Robotics', credits: 3, prereq: ['MTE414'] },
  { code: 'MTE439', name: 'Frontiers of Space Engineering', credits: 3, prereq: [] },
];
