// Spec §14 phase 1 — ports the prototype's real ECE course catalog
// (prereqs/coreqs/levels/categories) as seed data. `isBasicScience` (§7.2.1,
// used by the external-transfer engine) is added on top of the original
// prototype fields, flagged for the shared Math/Physics/Chemistry/Intro-CS
// courses common to every FoE program's first three semesters.
import { Course, CourseCategory } from '@advisor/shared';

function c(
  code: string, name: string, credits: number, sem: number,
  prereq: string[], coreq: string[], category: CourseCategory, isUR = false
): Course {
  return {
    code, name, credits, level: Math.ceil(sem / 2), semesterOrdinal: sem,
    category, isUR, isBasicScience: BASIC_SCIENCE_CODES.has(code),
    departmentId: null, prereq, coreq, transferable: isUR || BASIC_SCIENCE_CODES.has(code),
  };
}

// Semesters 1-3 Math/Physics/Chemistry/Intro-programming courses — shared
// across every FoE program, and what typically maps across a faculty
// transfer's equivalency table (spec §7.2.1).
const BASIC_SCIENCE_CODES = new Set([
  'MTH111', 'MTH121', 'PHY111', 'PHY121', 'CHM111', 'CHM121', 'CSE211',
]);

export const CATALOG: Course[] = [
  // ---- Semesters 1-3: common to all FoE programs ----
  c('LRA101','Japanese Culture',2,1,[],[],'ur_core',true),
  c('LRA405','Key Skills Seminar (1)',2,1,[],[],'ur_core',true),
  c('LRA401','Japanese Language (1)',1,1,[],[],'ur_core',true),
  c('MTH111','Mathematics (1)',3,1,[],[],'faculty'),
  c('PHY111','Physics (1)',3,1,[],['PHY112'],'faculty'),
  c('CHM111','Chemistry (1)',2,1,[],['CHM112'],'faculty'),
  c('PHY112','Basic Sciences Lab-1 (Physics 1)',1,1,[],['PHY111'],'faculty'),
  c('CHM112','Basic Sciences Lab-2 (Chemistry 1)',1,1,[],['CHM111'],'faculty'),
  c('MCE111','Mechanics (Statics + Dynamics)',3,1,[],[],'faculty'),
  c('IME111','Safety and Risk Management',2,1,[],[],'faculty'),

  c('LRA402','Japanese Language (2)',1,2,['LRA401'],[],'ur_core',true),
  c('LRA406','Key Skills Seminar (2)',2,2,['LRA405'],[],'ur_core',true),
  c('MTH121','Mathematics (2)',3,2,['MTH111'],[],'faculty'),
  c('PHY121','Physics (2)',3,2,['PHY111'],['PHY122'],'faculty'),
  c('CHM121','Chemistry (2)',2,2,['CHM111'],['CHM122'],'faculty'),
  c('PHY122','Basic Science Lab-3 (Physics 2)',1,2,[],['PHY121'],'faculty'),
  c('CHM122','Basic Science Lab-4 (Chemistry 2)',1,2,[],['CHM121'],'faculty'),
  c('EPE121','Electrical Engineering (Circuits+Machines)',3,2,['PHY111'],['EPE122'],'faculty'),
  c('EPE122','Electrical Engineering Lab',1,2,[],['EPE121'],'faculty'),
  c('IME121','Engineering Drawing',3,2,[],[],'faculty'),

  c('LRA301','Environment and Earth Science',2,3,[],[],'ur_core',true),
  c('MTH211','Probability and Statistics',2,3,['MTH111'],[],'faculty'),
  c('CSE211','Computer Programming',2,3,[],['CSE212'],'faculty'),
  c('CSE212','Computer Programming Lab',1,3,[],['CSE211'],'faculty'),
  c('ECE211','Introduction to Electronics Engineering',2,3,['EPE121'],['ECE212'],'school'),
  c('ECE212','Electronics Engineering Lab',1,3,[],['ECE211'],'school'),
  c('CPE211','Intro to Energy, Environmental and Chem. Eng.',2,3,[],['CPE212'],'faculty'),
  c('CPE212','Intro to Energy/Env/Chem Eng Lab',1,3,[],['CPE211'],'faculty'),
  c('MSE221','Fundamentals of Materials Science',2,3,[],['MSE222'],'faculty'),
  c('MSE222','Materials Science Lab',1,3,[],['MSE221'],'faculty'),
  c('IME211','Introduction to Manufacturing Processes',2,3,['IME121'],['IME212'],'faculty'),
  c('IME212','Manufacturing Processes Laboratory',1,3,['IME111'],['IME211'],'faculty'),

  // ---- ECE Program: Semesters 4-9 ----
  c('LRA202','Peace Studies',2,4,[],[],'ur_core',true),
  c('LRA103','Fine Arts Appreciation, Drawing, and Painting',2,4,[],[],'ur_core',true),
  c('LRAE1','UR Elective 1 (Arts & Humanities)',2,4,[],[],'ur_elective',true),
  c('BIO121','Fundamentals of Life Science',2,4,[],[],'program'),
  c('EPE221','Measurements and Instrumentation',2,4,['ECE211'],['EPE222'],'program'),
  c('EPE222','Measurements and Instrumentation Lab',1,4,[],['EPE221'],'program'),
  c('CSE213','Numerical Analysis',3,4,['MTH121','CSE211'],[],'program'),
  c('IME221','Project Management',2,4,[],[],'program'),
  c('ECE221','Digital Logic Design',2,4,['CSE211','ECE211'],['ECE222'],'program'),
  c('ECE222','Digital Logic Design Lab',1,4,[],['ECE221'],'program'),

  c('LRAE2','UR Elective 2 (Social Sciences)',2,5,[],[],'ur_elective',true),
  c('ECE310','Microprocessors and Microcontrollers',2,5,['ECE221'],['ECE311'],'program'),
  c('ECE311','Microprocessors and Microcontrollers Lab',1,5,[],['ECE310'],'program'),
  c('ECE312','Electric Circuits',2,5,['EPE121'],['ECE313'],'program'),
  c('ECE313','Electric Circuits Lab',1,5,[],['ECE312'],'program'),
  c('ECE314','Signals and Systems',2,5,['MTH121'],['ECE315'],'program'),
  c('ECE315','Signals and Systems Lab',1,5,[],['ECE314'],'program'),
  c('ECE316','Engineering Mathematics',3,5,['MTH121'],[],'program'),
  c('ECE317','Electronic Devices',2,5,['PHY121','MTH121'],['ECE318'],'program'),
  c('ECE318','Electronic Devices Lab',1,5,[],['ECE317'],'program'),
  c('ECE319','Seminar on ECE',2,5,['EPE221','ECE221'],[],'program'),

  c('LRA102','Introduction to Philosophy',2,6,[],[],'ur_core',true),
  c('LRAE3','UR Elective 3 (Natural Sciences)',2,6,[],[],'ur_elective',true),
  c('ECE321','Project Based Learning on ECE',2,6,['ECE310'],[],'program'),
  c('ECE322','Electronic Circuits',2,6,['ECE211'],['ECE323'],'program'),
  c('ECE323','Electronic Circuits Lab',1,6,[],['ECE322'],'program'),
  c('ECE324','Digital Signal Processing',2,6,['ECE314'],['ECE325'],'program'),
  c('ECE325','Digital Signal Processing Lab',1,6,[],['ECE324'],'program'),
  c('ECE326','Communications Systems Fundamentals',2,6,['ECE314','ECE316'],['ECE327'],'program'),
  c('ECE327','Communications Systems Fundamentals Lab',1,6,[],['ECE326'],'program'),
  c('ECE328','Engineering Electromagnetics',2,6,['ECE316'],['ECE329'],'program'),
  c('ECE329','Engineering Electromagnetics Lab',1,6,[],['ECE328'],'program'),

  c('LRAE4','UR Elective 4 (Key Skills)',2,7,[],[],'ur_elective',true),
  c('ECE411','Electromagnetic Fields and Waves',2,7,['ECE328'],['ECE412'],'program'),
  c('ECE412','Electromagnetic Fields and Waves Lab',1,7,[],['ECE411'],'program'),
  c('ECE413','Digital Communications Systems',2,7,['MTH211','ECE326'],['ECE414'],'program'),
  c('ECE414','Digital Communications Systems Lab',1,7,[],['ECE413'],'program'),
  c('ECEEL1','Program Elective 1',3,7,[],[],'program_elective'),
  c('ECEEL2','Program Elective 2',3,7,[],[],'program_elective'),
  c('ECEEL3','Program Elective 3',3,7,[],[],'program_elective'),

  c('LRA201','Introduction to Economics and Sustainable Development',2,8,[],[],'ur_core',true),
  c('MTE324','Automatic Control',2,8,['MTH121'],['MTE325'],'program'),
  c('MTE325','Automatic Control Lab',1,8,[],['MTE324'],'program'),
  c('ECE421','Principles of Information Theory and Coding',2,8,['ECE413'],['ECE422'],'program'),
  c('ECE422','Principles of Information Theory and Coding Lab',1,8,[],['ECE421'],'program'),
  c('ECEEL4','Program Elective 4',3,8,[],[],'program_elective'),
  c('ECEEL5','Program Elective 5',3,8,[],[],'program_elective'),
  c('ECE420','Graduation Project (1)',3,8,[],[],'special'),

  c('ECE500','Graduation Project (2)',7,9,['ECE420'],[],'special'),
  c('ECE499','Industrial Training (2 Modules)',4,9,[],[],'special'),
];

export const CATALOG_BY_CODE: Record<string, Course> = Object.fromEntries(CATALOG.map(x => [x.code, x]));

// Program elective pool (ECEEL1..5) and UR elective category pools — ported
// verbatim from the prototype; TODO(next session): move to their own tables
// once the department/program model is fleshed out beyond ECE.
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
  LRAE1: ['Music and Technology', 'Theater and Drama', 'Physical Education', 'Art and Architecture of Ancient Egypt'],
  LRAE2: ['Entrepreneurship and Innovation', 'Public Policy', 'Egyptian Business Regulations', 'Sociology of Work'],
  LRAE3: ['Introduction to Life Sciences', 'Astronomy and Space Science', 'Natural Resources and Sustainability'],
  LRAE4: ['English Language', 'Research Methods', 'Fundamentals of Communication', 'Transformational Leadership'],
};
