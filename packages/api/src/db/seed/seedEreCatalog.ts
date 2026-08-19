// Real EJUST ERE (Energy Resources Engineering) program catalog —
// transcribed from `FOE Handbook.pdf`, "Study Plan for ERE Program
// (Semester 4: Semester 9)" (p.34) plus "ERE Program Elective Courses"
// (p.40-41). Unlike every ECCE/IDE-school program, ERE's own semester 4
// doesn't include IME221 "Project Management" at all (it appears only as
// an elective, ERE418, later in the plan) — transcribed faithfully.
import { Course } from '@advisor/shared';
import {
  c, SHARED_SEM_1_3, LRA202, LRA103, LRA102, LRA201, LRAE1, LRAE2, LRAE3, LRAE4,
  BIO121, EPE221, EPE222, ERE221, ERE222, MTE324, MTE325,
} from './seedFoeSharedCourses';

export const ERE_CATALOG: Course[] = [
  ...SHARED_SEM_1_3,

  // ---- Semester 4 ----
  LRA202, LRA103, LRAE1, BIO121, EPE221, EPE222,
  c('ERE223', 'Engineering Mathematics', 2, 4, ['MTH111', 'MTH121'], [], 'program'),
  ERE221, ERE222,
  c('ERE213', 'Stress Analysis and Design', 3, 4, ['MCE111', 'IME121'], [], 'program'),

  // ---- Semester 5 ----
  LRAE2,
  c('ERE311', 'Project Based Learning on ERE', 2, 5, ['ERE221'], [], 'program'),
  c('ERE312', 'Fluid Mechanics', 3, 5, ['ERE221'], [], 'program'),
  c('ERE313', 'Thermodynamics', 3, 5, ['ERE221'], [], 'program'),
  c('ERE315', 'Computational Methods for Engineers', 1, 5, ['CSE211', 'MTH121'], [], 'program'),
  c('ERE316', 'Theory of Machines and Vibrations', 2, 5, ['ERE213', 'ERE223'], [], 'program'),
  c('ERE317', 'Energy Conversion and Management', 2, 5, [], [], 'program'),
  c('ERE318', 'Sustainable Energy', 3, 5, ['ERE221'], [], 'program'),

  // ---- Semester 6 ----
  MTE324, MTE325, LRA102, LRAE3,
  c('ERE321', 'Seminar on ERE', 2, 6, [], [], 'program'),
  c('ERE322', 'Combustion and Fuels', 3, 6, ['ERE313'], [], 'program'),
  c('ERE323', 'Power Stations', 3, 6, ['ERE313'], [], 'program'),
  c('ERE324', 'Heat and Mass Transfer', 3, 6, ['ERE312'], [], 'program'),

  // ---- Semester 7 ----
  LRAE4,
  c('ERE411', 'Refrigeration and Air Conditioning', 3, 7, ['ERE313', 'ERE324'], [], 'program'),
  c('ERE412', 'Solar Energy', 3, 7, ['ERE324'], [], 'program'),
  c('EREEL1', 'Program Elective 1', 3, 7, [], [], 'program_elective'),
  c('EREEL2', 'Program Elective 2', 3, 7, [], [], 'program_elective'),
  c('EREEL3', 'Program Elective 3', 3, 7, [], [], 'program_elective'),

  // ---- Semester 8 ----
  LRA201,
  c('ERE420', 'Graduation Project (1)', 3, 8, [], [], 'special'),
  c('ERE421', 'Energy Storage and Transmission', 3, 8, ['ERE313', 'ERE324'], [], 'program'),
  c('ERE422', 'Design of Thermal and Energy Systems', 3, 8, ['ERE313', 'ERE324', 'ERE412'], [], 'program'),
  c('EREEL4', 'Program Elective 4', 3, 8, [], [], 'program_elective'),
  c('EREEL5', 'Program Elective 5', 3, 8, [], [], 'program_elective'),

  // ---- Semester 9 ----
  c('ERE500', 'Graduation Project (2)', 7, 9, ['ERE420'], [], 'special'),
  c('ERE499', 'Industrial Training (2 Modules)', 4, 9, [], [], 'special'),
];

// ERE Program Elective Courses (handbook p.40-41) — resolves EREEL1..5.
export const ERE_ELECTIVE_POOL = [
  { code: 'ERE413', name: 'Hydraulic Machines and Hydraulic Stations', credits: 3, prereq: ['ERE312'] },
  { code: 'ERE414', name: 'Desalination Technology', credits: 3, prereq: ['ERE312'] },
  { code: 'ERE415', name: 'Energy Systems and Power Plants and Economics', credits: 3, prereq: ['ERE323'] },
  { code: 'ERE416', name: 'Computational Fluid Dynamics (CFD)', credits: 3, prereq: ['ERE312'] },
  { code: 'ERE417', name: 'Safety Codes and Environmental Laws', credits: 3, prereq: [] },
  { code: 'ERE418', name: 'Project Management', credits: 3, prereq: [] },
  { code: 'ERE419', name: 'Basics of Electrical Power and Smart Grid', credits: 3, prereq: ['EPE121'] },
  { code: 'ERE423', name: 'Energy Systems', credits: 3, prereq: ['ERE317'] },
  { code: 'ERE424', name: 'Energy Efficient Buildings', credits: 3, prereq: ['ERE318'] },
  { code: 'ERE425', name: 'Energy Economics', credits: 3, prereq: ['ERE317'] },
  { code: 'ERE426', name: 'Nuclear Power Plants', credits: 3, prereq: ['ERE323'] },
  { code: 'ERE427', name: 'Gas Turbines', credits: 3, prereq: ['ERE323'] },
  { code: 'ERE428', name: 'Diesel Engines', credits: 3, prereq: ['ERE322'] },
  { code: 'ERE429', name: 'Electric Power and Machines', credits: 3, prereq: ['EPE121'] },
  { code: 'ERE430', name: 'Turbines and Compressors', credits: 3, prereq: ['ERE323'] },
  { code: 'ERE431', name: 'Thermal Hydraulic Power Plants', credits: 3, prereq: ['ERE323'] },
  { code: 'ERE432', name: 'Heat Exchangers', credits: 3, prereq: ['ERE324'] },
  { code: 'ERE433', name: 'Statistical Analysis', credits: 3, prereq: ['MTH211'] },
  { code: 'ERE434', name: 'Energy Resources Engineering', credits: 3, prereq: ['ERE317'] },
  { code: 'ERE435', name: 'Basics of Renewable Energy', credits: 3, prereq: ['ERE317'] },
];
