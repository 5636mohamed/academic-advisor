// Curriculum Analytics epic — every "Department" table column across the
// three VP-wide pages used to render `c.departmentId ?? 'Shared / UR'`,
// which showed "Shared / UR" for literally EVERY row: Course.departmentId
// is never actually populated, department-specific courses included (see
// its own doc comment in packages/shared/src/types/course.ts). The real
// membership list is `departments: string[]` (from
// seedCatalog.ts's DEPARTMENTS_BY_COURSE_CODE) — this formats it for
// display, one place, reused by every table that has this column.
const REAL_DEPARTMENT_COUNT = 10; // ECE/CSE/MIE/EPE/MTE/MSE/IME/ERE/ENV/CPE

export function departmentsCell(departments: string[]): string {
  if (departments.length === 0) return '—';
  if (departments.length >= REAL_DEPARTMENT_COUNT) return 'All departments (Shared / UR)';
  return departments.join(', ');
}
