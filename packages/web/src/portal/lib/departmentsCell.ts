// Curriculum Analytics epic — every "Department" table column across the
// three VP-wide pages used to render `c.departmentId ?? 'Shared / UR'`,
// which showed "Shared / UR" for literally EVERY row: Course.departmentId
// is never actually populated, department-specific courses included (see
// its own doc comment in packages/shared/src/types/course.ts). The real
// membership list is `departments: string[]` (from
// seedCatalog.ts's DEPARTMENTS_BY_COURSE_CODE) — this formats it for
// display, one place, reused by every table that has this column.
const REAL_DEPARTMENT_COUNT = 10; // ECE/CSE/MIE/EPE/MTE/MSE/IME/ERE/ENV/CPE

// Real live production crash caught right after shipping: the frontend
// (GitHub Pages) and backend (Railway) deploy independently and NOT
// atomically — GH Pages redeploys within ~30s of a push, Railway can lag
// several minutes behind. In that window, a client already running the new
// frontend can still be talking to the OLD API, whose responses don't have
// `departments` at all yet — `undefined.length` threw exactly this
// TypeError in production. `departments` is defensively optional here
// (and in filterCourses/CourseFilterBar below) so a stale API response
// degrades to "no department info yet" instead of crashing the page.
export function departmentsCell(departments: string[] | undefined): string {
  if (!departments || departments.length === 0) return '—';
  if (departments.length >= REAL_DEPARTMENT_COUNT) return 'All departments (Shared / UR)';
  return departments.join(', ');
}
