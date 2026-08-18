// A first-class advisor entity — mirrors ProfessorProfile's shape
// (venture.ts) exactly. Previously "advisor" was a single global identity
// with no id at all (one shared login, unfiltered access to every
// student); this is the type that turns it into 5 real, separately-
// scoped advisors, each with their own roster.
export interface Advisor {
  id: string;
  name: string;
  facultyId: string;
  departmentId: string;
}
