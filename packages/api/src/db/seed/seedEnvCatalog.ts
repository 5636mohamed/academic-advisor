// Real EJUST ENV (Environmental Engineering) program catalog — transcribed
// from `FOE Handbook.pdf`, "Study Plan for ENV Program (Semester 4:
// Semester 9)" (p.35) plus "ENV Program Elective Courses" (p.41). The
// handbook names ENV's 8 elective slots individually inline (e.g. "Elective
// 1 (treatment of hazardous waste)") instead of using the generic
// "Elective N" placeholder pattern every other program's table uses, and
// separately re-lists the same topics (plus 4 more) with inconsistent
// "ENV41x"/"ENV42x" placeholder-style codes on its own elective-pool page —
// normalized here to the same ENVEL1..8-slot pattern used everywhere else
// in this catalog, with real topic names kept in ENV_ELECTIVE_POOL. Every
// topic name is real; only the numbering scheme for the ones the handbook
// itself left as "ENV41x"/"ENV42x" placeholders has been made consistent
// (ENV441-448), continuing ENV's own real numbering.
import { Course } from '@advisor/shared';
import {
  c, SHARED_SEM_1_3, LRA202, LRA103, LRA102, LRA201, LRAE1, LRAE2, LRAE3, LRAE4,
  BIO121, EPE221, EPE222, CPE213, CPE221, CPE223, ERE222,
} from './seedFoeSharedCourses';

export const ENV_CATALOG: Course[] = [
  ...SHARED_SEM_1_3,

  // ---- Semester 4 (identical to CPE's own semester 4) ----
  LRA202, LRA103, LRAE1, BIO121, EPE221, EPE222, CPE213, CPE221, ERE222, CPE223,

  // ---- Semester 5 ----
  LRAE2,
  c('ENV311', 'Seminar on ENV', 2, 5, [], [], 'program'),
  c('ENV312', 'Fundamentals of Environmental Engineering', 3, 5, [], [], 'program'),
  c('ENV313', 'Global Environmental Engineering', 3, 5, [], [], 'program'),
  c('ENV314', 'Water Quality and Analysis', 3, 5, [], [], 'program'),
  c('ENV315', 'Environmental Hydraulics', 3, 5, [], [], 'program'),
  c('ENV316', 'Municipal Solid Waste', 3, 5, [], [], 'program'),

  // ---- Semester 6 ----
  LRA102, LRAE3,
  c('ENV321', 'Project Based Learning on ENV', 2, 6, [], [], 'program'),
  c('ENV322', 'Air Quality and Pollution', 3, 6, [], [], 'program'),
  c('ENV323', 'Urban Development and Environmental Planning', 3, 6, [], [], 'program'),
  c('ENV324', 'Waste Water Treatment', 3, 6, ['CHM111'], [], 'program'),
  c('ENV325', 'Desalination Processes and Systems', 3, 6, [], [], 'program'),

  // ---- Semester 7 ----
  LRAE4,
  c('ENV411', 'Ground Water Engineering', 3, 7, [], [], 'program'),
  c('ENV412', 'Sustainable Design and Technologies in Buildings', 3, 7, ['ENV321'], [], 'program'),
  c('ENVEL1', 'Program Elective 1', 3, 7, [], [], 'program_elective'),
  c('ENVEL2', 'Program Elective 2', 3, 7, [], [], 'program_elective'),
  c('ENVEL3', 'Program Elective 3', 3, 7, [], [], 'program_elective'),
  c('ENVEL4', 'Program Elective 4', 3, 7, [], [], 'program_elective'),

  // ---- Semester 8 ----
  LRA201,
  c('ENV420', 'Graduation Project (1)', 3, 8, [], [], 'special'),
  c('ENV421', 'Clean Production Technologies', 3, 8, ['ENV324'], [], 'program'),
  c('ENV422', 'Environmental Impact Assessment and Sustainability', 3, 8, ['ENV314', 'ENV322'], [], 'program'),
  c('ENVEL5', 'Program Elective 5', 3, 8, [], [], 'program_elective'),
  c('ENVEL6', 'Program Elective 6', 3, 8, [], [], 'program_elective'),
  c('ENVEL7', 'Program Elective 7', 3, 8, [], [], 'program_elective'),
  c('ENVEL8', 'Program Elective 8', 3, 8, [], [], 'program_elective'),

  // ---- Semester 9 ----
  c('ENV500', 'Graduation Project (2)', 7, 9, ['ENV420'], [], 'special'),
  c('ENV499', 'Industrial Training (2 Modules)', 4, 9, [], [], 'special'),
];

// ENV Program Elective Courses (handbook p.41, normalized — see header
// comment) — resolves ENVEL1..8. The 4 with real handbook codes (ENV425-
// 428) come first; the remaining 8 (the handbook's own "ENV41x"/"ENV42x"
// placeholder-coded topics) are numbered ENV441-448, continuing ENV's real
// numbering scheme.
export const ENV_ELECTIVE_POOL = [
  { code: 'ENV425', name: 'Sustainable Materials in Buildings', credits: 3, prereq: [] },
  { code: 'ENV426', name: 'Cities and Climate Change', credits: 3, prereq: [] },
  { code: 'ENV427', name: 'Water and Energy Conservation (in Different Sectors; Environmental Impact)', credits: 3, prereq: [] },
  { code: 'ENV428', name: 'Ecological Design of Environmental Systems', credits: 3, prereq: [] },
  { code: 'ENV441', name: 'Treatment of Hazardous Waste', credits: 3, prereq: [] },
  { code: 'ENV442', name: 'Green Economy', credits: 3, prereq: [] },
  { code: 'ENV443', name: 'Air Pollution Monitoring and Control', credits: 3, prereq: ['MTH211'] },
  { code: 'ENV444', name: 'Health and Environmental Impact of (Water-Energy Food Nexus)', credits: 3, prereq: [] },
  { code: 'ENV445', name: 'Alternative and Future Energies Applications (Renewable and Nuclear Energies)', credits: 3, prereq: [] },
  { code: 'ENV446', name: 'Industrial Safety and Regulations', credits: 3, prereq: [] },
  { code: 'ENV447', name: 'Modelling of the Built Environment', credits: 3, prereq: [] },
  { code: 'ENV448', name: 'Environmental Statistics and Modelling', credits: 3, prereq: ['MTH211'] },
];
