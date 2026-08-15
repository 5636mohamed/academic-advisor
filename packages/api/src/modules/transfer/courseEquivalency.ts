// Spec §7.2.1/§7.2.2 — the CourseEquivalencyMap: registrar-maintained rows
// mapping a source-faculty course code to a target faculty's requirement
// slot (or `null` = waived / free-elective credit only). A course with NO
// row for the target faculty does not transfer at all — excluded from the
// Transfer Semester "silently-but-visibly" (spec §12: shown in the preview
// as 'does not transfer', never a crash).
export interface CourseEquivalencyEntry {
  sourceCourseCode: string;
  targetFacultyId: string;
  targetCourseCode: string | null; // null = waived, counts as free-elective credit only
}

export function equivalencyExists(
  sourceCourseCode: string,
  targetFacultyId: string,
  map: CourseEquivalencyEntry[]
): boolean {
  return map.some(e => e.sourceCourseCode === sourceCourseCode && e.targetFacultyId === targetFacultyId);
}

export function lookupEquivalency(
  sourceCourseCode: string,
  targetFacultyId: string,
  map: CourseEquivalencyEntry[]
): CourseEquivalencyEntry | undefined {
  return map.find(e => e.sourceCourseCode === sourceCourseCode && e.targetFacultyId === targetFacultyId);
}
