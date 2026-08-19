// Real EJUST CSE (Computer Science & Engineering) program catalog —
// transcribed from `FOE Handbook.pdf`, "Study Plan for CSE Program
// (Semester 4: Semester 9)" (p.26) plus "CSE Program Elective Courses"
// (p.37-38). Semesters 1-3 and the shared semester-4 courses live in
// `seedFoeSharedCourses.ts` — this file only adds CSE's own courses.
import { Course } from '@advisor/shared';
import {
  c, SHARED_SEM_1_3, LRA202, LRA103, LRA102, LRA201, LRAE1, LRAE2, LRAE3, LRAE4,
  BIO121, EPE221, EPE222, CSE213, IME221, ECE221, ECE222,
} from './seedFoeSharedCourses';

export const CSE_CATALOG: Course[] = [
  ...SHARED_SEM_1_3,

  // ---- Semester 4 (identical to ECE's own semester 4) ----
  LRA202, LRA103, LRAE1, BIO121, EPE221, EPE222, CSE213, IME221, ECE221, ECE222,

  // ---- Semester 5 ----
  LRAE2,
  c('CSE311', 'Computer Organization', 3, 5, ['ECE221'], [], 'program'),
  c('CSE312', 'Discrete Mathematics', 3, 5, ['MTH111'], [], 'program'),
  c('CSE313', 'Advanced Programming', 2, 5, ['CSE211'], ['CSE314'], 'program'),
  c('CSE314', 'Advanced Programming Lab', 1, 5, [], ['CSE313'], 'program'),
  c('ECE314', 'Signals and Systems', 2, 5, ['MTH121'], ['ECE315'], 'program'),
  c('ECE315', 'Signals and Systems Lab', 1, 5, [], ['ECE314'], 'program'),
  c('CSE315', 'Seminar on CSE', 2, 5, ['CSE312'], [], 'program'),
  c('CSE317', 'Data Structures', 3, 5, ['CSE312'], [], 'program'),

  // ---- Semester 6 ----
  LRA102, LRAE3,
  c('CSE321', 'Project Based Learning on CSE', 2, 6, ['CSE313'], [], 'program'),
  c('CSE322', 'Software Engineering', 2, 6, ['CSE312', 'CSE313'], [], 'program'),
  c('CSE323', 'Software Engineering Lab', 1, 6, [], ['CSE322'], 'program'),
  c('CSE324', 'Embedded Systems', 2, 6, ['CSE311'], ['CSE325'], 'program'),
  c('CSE325', 'Embedded Systems Lab', 1, 6, [], ['CSE324'], 'program'),
  c('CSE326', 'Analysis and Design of Algorithms', 3, 6, ['CSE312', 'CSE317'], [], 'program'),
  c('CSE328', 'Computer Networks', 2, 6, ['CSE311'], ['CSE329'], 'program'),
  c('CSE329', 'Computer Networks Lab', 1, 6, [], ['CSE328'], 'program'),

  // ---- Semester 7 ----
  LRAE4,
  c('CSE411', 'Cryptography', 3, 7, ['MTH211', 'CSE312'], [], 'program'),
  c('CSE412', 'Operating Systems', 2, 7, ['CSE311'], ['CSE413'], 'program'),
  c('CSE413', 'Operating Systems Lab', 1, 7, [], ['CSE412'], 'program'),
  c('CSEEL1', 'Program Elective 1', 3, 7, [], [], 'program_elective'),
  c('CSEEL2', 'Program Elective 2', 3, 7, [], [], 'program_elective'),
  c('CSEEL3', 'Program Elective 3', 3, 7, [], [], 'program_elective'),

  // ---- Semester 8 ----
  LRA201,
  c('CSE424', 'Parallel and Distributed Computing', 2, 8, ['CSE311', 'CSE326'], ['CSE425'], 'program'),
  c('CSE425', 'Parallel and Distributed Computing Lab', 1, 8, [], ['CSE424'], 'program'),
  c('CSE426', 'Theory of Computation', 3, 8, ['CSE326', 'CSE312'], [], 'program'),
  c('CSEEL4', 'Program Elective 4', 3, 8, [], [], 'program_elective'),
  c('CSEEL5', 'Program Elective 5', 3, 8, [], [], 'program_elective'),
  c('CSE420', 'Graduation Project (1)', 3, 8, [], [], 'special'),

  // ---- Semester 9 ----
  c('CSE500', 'Graduation Project (2)', 7, 9, ['CSE420'], [], 'special'),
  c('CSE499', 'Industrial Training (2 Modules)', 4, 9, [], [], 'special'),
];

// CSE Program Elective Courses (handbook p.37-38) — resolves the CSEEL1..5
// placeholder slots, same pattern as ECE_ELECTIVE_POOL.
export const CSE_ELECTIVE_POOL = [
  { code: 'CSE421', name: 'Advanced Computer Networks', credits: 3, prereq: ['CSE328'] },
  { code: 'CSE422', name: 'Programming Languages and Compilers', credits: 3, prereq: ['CSE313'] },
  { code: 'CSE423', name: 'Computer Graphics and Visualization', credits: 3, prereq: ['CSE317'] },
  { code: 'ECE432', name: 'Digital VLSI Modeling and Design', credits: 3, prereq: ['CSE311'] },
  { code: 'ECE324', name: 'Digital Signal Processing', credits: 2, prereq: ['ECE314'] },
  { code: 'ECE325', name: 'Digital Signal Processing Lab', credits: 1, prereq: ['ECE324'] },
  { code: 'CSE436', name: 'Advanced Embedded Systems', credits: 3, prereq: ['CSE324'] },
  { code: 'CSE437', name: 'Intelligent Systems', credits: 3, prereq: ['CSE326'] },
  { code: 'CSE438', name: 'Human Computer Interaction', credits: 3, prereq: ['CSE322'] },
  { code: 'CSE427', name: 'Computer and Network Security', credits: 3, prereq: ['CSE328'] },
  { code: 'CSE428', name: 'Data Engineering', credits: 3, prereq: ['CSE317'] },
  { code: 'CSE429', name: 'Image Processing and Computer Vision', credits: 3, prereq: ['CSE326'] },
  { code: 'CSE431', name: 'Advanced Computer Architecture', credits: 3, prereq: ['CSE311'] },
  { code: 'CSE432', name: 'Robotics', credits: 3, prereq: ['CSE326'] },
  { code: 'CSE433', name: 'Emerging Topics in Computer Engineering', credits: 3, prereq: ['CSE326'] },
  { code: 'CSE434', name: 'Machine Learning', credits: 3, prereq: ['CSE326'] },
  { code: 'CSE435', name: 'Performance Evaluation', credits: 3, prereq: ['CSE326'] },
];
