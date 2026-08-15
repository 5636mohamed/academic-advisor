// Spec §1.1 Course entity + §9.3 Prisma model
export type CourseCategory =
  | 'core' | 'program' | 'faculty' | 'school'
  | 'ur_core' | 'ur_elective' | 'program_elective' | 'special';

export interface Course {
  code: string;
  name: string;
  credits: number;
  level: number;                 // minimum student level this course may be taken at
  semesterOrdinal: number;       // catalog semester it's normally offered
  category: CourseCategory;
  isUR: boolean;
  isBasicScience: boolean;       // §7.2.1 — feeds Transfer Semester eligibility
  departmentId: string | null;   // null for shared/UR courses
  prereq: string[];              // course codes
  coreq: string[];               // course codes
  transferable: boolean;
}

export interface CourseOffering {
  courseCode: string;
  term: string;
  year: number;
  enrolled: number;
  passed: number;
  meanPct: number;
  stdDevPct: number;
}
