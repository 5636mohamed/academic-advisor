// Spec §7.2.1/§9.3 `CourseEquivalencyMap` seed rows — registrar-maintained
// mappings from a source (ENG-faculty) course code to a requirement slot in
// each target faculty. Deliberately small (covers the basic-science/UR
// courses the seeded ECE catalog actually has), matching §11 Example K's
// Hassan-to-Business-Informatics scenario — extend as more target faculties
// are onboarded.
import { CourseEquivalencyEntry } from '../../modules/transfer/courseEquivalency';

export const EQUIVALENCY_MAP: CourseEquivalencyEntry[] = [
  // ---- Basic science, ENG -> BUS (Business Informatics) ----
  { sourceCourseCode: 'MTH111', targetFacultyId: 'BUS', targetCourseCode: 'BUS-MATH1' },
  { sourceCourseCode: 'MTH121', targetFacultyId: 'BUS', targetCourseCode: 'BUS-MATH2' },
  { sourceCourseCode: 'CSE211', targetFacultyId: 'BUS', targetCourseCode: 'BUS-CS-INTRO' },
  // PHY111/PHY121/CHM111/CHM121 have no Business Informatics equivalent —
  // deliberately absent, so they show up as "does not transfer" in the
  // Transfer Semester preview (§7.2.2/§12), same as Hassan's worked example.

  // ---- UR/LRA courses, ENG -> BUS: all LRAs waived as free-elective credit
  // (targetCourseCode: null) since they're university-wide, not faculty-specific ----
  { sourceCourseCode: 'LRA101', targetFacultyId: 'BUS', targetCourseCode: null },
  { sourceCourseCode: 'LRA401', targetFacultyId: 'BUS', targetCourseCode: null },
  { sourceCourseCode: 'LRA402', targetFacultyId: 'BUS', targetCourseCode: null },
  { sourceCourseCode: 'LRA405', targetFacultyId: 'BUS', targetCourseCode: null },
  { sourceCourseCode: 'LRA406', targetFacultyId: 'BUS', targetCourseCode: null },
  { sourceCourseCode: 'LRA301', targetFacultyId: 'BUS', targetCourseCode: null },
  { sourceCourseCode: 'LRA202', targetFacultyId: 'BUS', targetCourseCode: null },
  { sourceCourseCode: 'LRA103', targetFacultyId: 'BUS', targetCourseCode: null },
  { sourceCourseCode: 'LRAE1', targetFacultyId: 'BUS', targetCourseCode: null },
  { sourceCourseCode: 'LRAE2', targetFacultyId: 'BUS', targetCourseCode: null },
];
