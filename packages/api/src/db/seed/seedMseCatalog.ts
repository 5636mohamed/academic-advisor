// Real EJUST MSE (Materials Science & Engineering) program catalog —
// transcribed from `FOE Handbook.pdf`, "Study Plan for MSE Program
// (Semester 4: Semester 9)" (p.32) plus "MSE Program Elective Courses"
// (p.39-40).
import { Course } from '@advisor/shared';
import {
  c, SHARED_SEM_1_3, LRA202, LRA103, LRA102, LRA201, LRAE1, LRAE2, LRAE3, LRAE4,
  BIO121, EPE221, EPE222, IME221, MTE211, ERE221, ERE222,
} from './seedFoeSharedCourses';

export const MSE_CATALOG: Course[] = [
  ...SHARED_SEM_1_3,

  // ---- Semester 4 ----
  LRA202, LRA103, LRAE1, BIO121, EPE221, EPE222, MTE211, IME221, ERE221, ERE222,

  // ---- Semester 5 ----
  LRAE2,
  c('MSE311', 'Structures and Properties of Materials', 3, 5, ['MSE221'], [], 'program'),
  c('MSE312', 'Physics of Solid Materials', 3, 5, ['PHY121', 'PHY111'], [], 'program'),
  c('MSE313', 'Chemistry of Materials', 3, 5, ['CHM111'], [], 'program'),
  c('MSE314', 'Thermodynamics and Phase Transformations in Solids', 3, 5, ['MSE221'], [], 'program'),
  c('MSE315', 'Fundamental of Materials Processing', 3, 5, ['MSE221'], [], 'program'),
  c('MSE316', 'Project Based Learning on MSE', 2, 5, [], [], 'program'),

  // ---- Semester 6 ----
  LRA102, LRAE3,
  c('MSE321', 'Seminar on MSE', 2, 6, ['MSE221'], [], 'program'),
  c('MSE322', 'Mechanical Behavior for Materials', 3, 6, ['MCE111', 'MSE315'], [], 'program'),
  c('MSE323', 'Mathematical Methods for Materials Computation', 3, 6, ['MTH211', 'MTH121'], [], 'program'),
  c('MSE324', 'Ceramic and Glasses', 3, 6, ['MSE311'], [], 'program'),
  c('MSE325', 'Polymeric Engineering Materials', 3, 6, ['MSE315', 'MSE313'], [], 'program'),

  // ---- Semester 7 ----
  LRAE4,
  c('MSE411', 'Electrochemistry and Corrosion', 3, 7, ['MSE313'], [], 'program'),
  c('MSE412', 'Structural Metallic Materials', 3, 7, ['MSE311'], [], 'program'),
  c('MSEEL1', 'Program Elective 1', 3, 7, [], [], 'program_elective'),
  c('MSEEL2', 'Program Elective 2', 3, 7, [], [], 'program_elective'),
  c('MSEEL3', 'Program Elective 3', 3, 7, [], [], 'program_elective'),

  // ---- Semester 8 ----
  LRA201,
  c('MSE421', 'Nanomaterials for Engineers', 3, 8, ['MSE221', 'MSE313'], [], 'program'),
  c('MSE422', 'Materials Selection in Engineering Design and Failure Analysis', 3, 8, ['MSE322', 'MSE412'], [], 'program'),
  c('MSEEL4', 'Program Elective 4', 3, 8, [], [], 'program_elective'),
  c('MSEEL5', 'Program Elective 5', 3, 8, [], [], 'program_elective'),
  c('MSE420', 'Graduation Project (1)', 3, 8, [], [], 'special'),

  // ---- Semester 9 ----
  c('MSE500', 'Graduation Project (2)', 7, 9, ['MSE420'], [], 'special'),
  c('MSE499', 'Industrial Training (2 Modules)', 4, 9, [], [], 'special'),
];

// MSE Program Elective Courses (handbook p.39-40) — resolves MSEEL1..5.
export const MSE_ELECTIVE_POOL = [
  { code: 'MSE414', name: 'Organic Chemistry', credits: 3, prereq: ['CHM111'] },
  { code: 'MSE415', name: 'Materials Characterization', credits: 3, prereq: ['MSE311'] },
  { code: 'MSE416', name: 'Kinetics and Diffusion Processes of Materials', credits: 3, prereq: ['MSE314'] },
  { code: 'MSE417', name: 'Introduction to Composite Materials', credits: 3, prereq: ['MSE311'] },
  { code: 'MSE418', name: 'Functionally Graded Materials', credits: 3, prereq: ['MSE311'] },
  { code: 'MSE419', name: 'Science and Engineering of Nonferrous Materials', credits: 3, prereq: ['MSE412'] },
  { code: 'MSE423', name: 'Electronic Properties of Materials', credits: 3, prereq: ['MSE312'] },
  { code: 'MSE424', name: 'Biomaterials', credits: 3, prereq: ['MSE311'] },
  { code: 'MSE425', name: 'Electron Microscopy and Diffraction Theory', credits: 3, prereq: ['MSE311'] },
  { code: 'MSE426', name: 'Thin Film Technology', credits: 3, prereq: ['MSE312'] },
  { code: 'MSE427', name: 'Smart Materials', credits: 3, prereq: ['MSE311'] },
  { code: 'MSE428', name: 'Materials for Energy Applications', credits: 3, prereq: ['MSE311'] },
  { code: 'MSE429', name: 'Magnetic Materials', credits: 3, prereq: ['MSE312'] },
  { code: 'MSE430', name: 'Semiconductor Materials', credits: 3, prereq: ['MSE312'] },
  { code: 'MSE431', name: 'Introduction of Advanced Materials', credits: 3, prereq: ['MSE311'] },
  { code: 'MSE432', name: 'Optical Properties of Materials', credits: 3, prereq: ['MSE312'] },
  { code: 'MSE433', name: 'Deformation and Fracture of Engineering Materials', credits: 3, prereq: ['MSE322'] },
  { code: 'MSE434', name: 'Fundamentals of Stress and Strain, and Deformation of Metals', credits: 3, prereq: ['MSE322'] },
  { code: 'MSE435', name: 'Intermolecular Force and Aggregation', credits: 3, prereq: ['MSE313'] },
  { code: 'MSE436', name: 'Continuum Mechanics', credits: 3, prereq: ['MCE111'] },
  { code: 'MSE437', name: 'Dielectric Materials Science', credits: 3, prereq: ['MSE312'] },
  { code: 'MSE438', name: 'Lattice Defects and Dislocation', credits: 3, prereq: ['MSE311'] },
  { code: 'MSE439', name: 'Advanced Physical Metallurgy', credits: 3, prereq: ['MSE412'] },
  { code: 'MSE440', name: 'Extractive Metallurgy', credits: 3, prereq: ['MSE313'] },
];
