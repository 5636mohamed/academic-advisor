// Real EJUST EPE (Electrical Power Engineering) program catalog —
// transcribed from `FOE Handbook.pdf`, "Study Plan for EPE Program
// (Semester 4: Semester 9)" (p.27) plus "EPE Program Elective Courses"
// (p.38).
import { Course } from '@advisor/shared';
import {
  c, SHARED_SEM_1_3, LRA202, LRA103, LRA102, LRA201, LRAE1, LRAE2, LRAE3, LRAE4,
  BIO121, EPE221, EPE222, CSE213, IME221, ECE221, ECE222, MTE324, MTE325,
} from './seedFoeSharedCourses';

export const EPE_CATALOG: Course[] = [
  ...SHARED_SEM_1_3,

  // ---- Semester 4 (identical to ECE's own semester 4) ----
  LRA202, LRA103, LRAE1, BIO121, EPE221, EPE222, CSE213, IME221, ECE221, ECE222,

  // ---- Semester 5 ----
  LRAE2,
  c('EPE310', 'Seminar on EPE', 2, 5, [], [], 'program'),
  c('ECE312', 'Electric Circuits', 2, 5, ['EPE121'], ['ECE313'], 'program'),
  c('ECE313', 'Electric Circuits Lab', 1, 5, [], ['ECE312'], 'program'),
  c('ECE314', 'Signals and Systems', 2, 5, ['MTH121'], ['ECE315'], 'program'),
  c('ECE315', 'Signals and Systems Lab', 1, 5, [], ['ECE314'], 'program'),
  c('ECE316', 'Engineering Mathematics', 3, 5, ['MTH121'], [], 'program'),

  // ---- Semester 6 (handbook places ECE328/329 in EPE's own semester 5,
  // and MTE324/325 in EPE's own semester 5 too — both kept at semester 6
  // instead, per seedFoeSharedCourses.ts's earliest-adopter-wins rule) ----
  LRA102, LRAE3,
  MTE324, MTE325,
  c('ECE328', 'Engineering Electromagnetics', 2, 6, ['ECE316'], ['ECE329'], 'program'),
  c('ECE329', 'Engineering Electromagnetics Lab', 1, 6, [], ['ECE328'], 'program'),
  c('EPE320', 'Project Based Learning on EPE', 2, 6, ['EPE121'], [], 'program'),
  c('EPE321', 'Power System Analysis (1)', 2, 6, ['ECE312'], ['EPE322'], 'program'),
  c('EPE322', 'Power System Analysis (1) Lab', 1, 6, [], ['EPE321'], 'program'),
  c('EPE323', 'Power Electronics (1)', 2, 6, ['ECE312'], ['EPE324'], 'program'),
  c('EPE324', 'Power Electronics (1) Lab', 1, 6, [], ['EPE323'], 'program'),
  c('EPE325', 'Electrical Machines (1)', 2, 6, ['ECE328'], ['EPE326'], 'program'),
  c('EPE326', 'Electrical Machines (1) Lab', 1, 6, [], ['EPE325'], 'program'),
  c('ECE324', 'Digital Signal Processing', 2, 6, ['ECE314'], ['ECE325'], 'program'),
  c('ECE325', 'Digital Signal Processing Lab', 1, 6, [], ['ECE324'], 'program'),

  // ---- Semester 7 ----
  LRAE4,
  c('EPE411', 'Electrical Machines (2)', 2, 7, ['EPE325'], ['EPE412'], 'program'),
  c('EPE412', 'Electrical Machines (2) Lab', 1, 7, [], ['EPE411'], 'program'),
  c('EPE413', 'Power System Analysis (2)', 2, 7, ['EPE321'], ['EPE414'], 'program'),
  c('EPE414', 'Power System Analysis (2) Lab', 1, 7, [], ['EPE413'], 'program'),
  c('EPEEL1', 'Program Elective 1', 3, 7, [], [], 'program_elective'),
  c('EPEEL2', 'Program Elective 2', 3, 7, [], [], 'program_elective'),
  c('EPEEL3', 'Program Elective 3', 3, 7, [], [], 'program_elective'),

  // ---- Semester 8 ----
  LRA201,
  c('EPE421', 'Energy Conversion and Utilization', 3, 8, ['EPE321'], [], 'program'),
  c('EPE422', 'Switch Gear and Protection Systems', 2, 8, ['EPE421'], ['EPE423'], 'program'),
  c('EPE423', 'Switch Gear and Protection Systems Lab', 1, 8, [], ['EPE422'], 'program'),
  c('EPEEL4', 'Program Elective 4', 3, 8, [], [], 'program_elective'),
  c('EPEEL5', 'Program Elective 5', 3, 8, [], [], 'program_elective'),
  c('EPE420', 'Graduation Project (1)', 3, 8, [], [], 'special'),

  // ---- Semester 9 ----
  c('EPE500', 'Graduation Project (2)', 7, 9, ['EPE420'], [], 'special'),
  c('EPE499', 'Industrial Training (2 Modules)', 4, 9, [], [], 'special'),
];

// EPE Program Elective Courses (handbook p.38) — resolves EPEEL1..5.
export const EPE_ELECTIVE_POOL = [
  { code: 'EPE424', name: 'High Voltage Engineering', credits: 3, prereq: ['EPE321', 'EPE322'] },
  { code: 'EPE425', name: 'Power Electronics (2)', credits: 3, prereq: ['EPE323', 'EPE324'] },
  { code: 'EPE426', name: 'Economic Operation of Power Systems', credits: 3, prereq: ['EPE321', 'EPE322'] },
  { code: 'EPE427', name: 'Renewable Energy Systems', credits: 3, prereq: ['EPE321', 'EPE322'] },
  { code: 'EPE428', name: 'Power Quality', credits: 3, prereq: ['EPE321', 'EPE322'] },
  { code: 'EPE429', name: 'Distributed Control of Power Systems', credits: 3, prereq: ['MTE324', 'MTE325'] },
  { code: 'EPE430', name: 'Power Transmission and Distribution', credits: 3, prereq: ['EPE321', 'EPE322'] },
  { code: 'EPE431', name: 'Simulation and Design Power Electronics Systems', credits: 3, prereq: ['EPE323', 'EPE324'] },
];
