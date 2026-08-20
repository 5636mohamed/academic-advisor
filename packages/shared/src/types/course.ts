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
  // Never actually populated — every Course in the system has this null,
  // department-specific courses included (confirmed live during the
  // Curriculum Analytics epic: a single nullable field can't represent
  // ownership anyway, since a course can legitimately belong to more than
  // one department — e.g. ECE316 is both ECE and EPE, every LRA/UR course
  // is all 10). Real per-department membership lives in
  // CATALOG_BY_DEPARTMENT (api/db/seed/seedCatalog.ts) — its derived
  // DEPARTMENTS_BY_COURSE_CODE reverse-lookup is the correct source for
  // "which department(s) is this course part of," not this field.
  departmentId: string | null;
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
