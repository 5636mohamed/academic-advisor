// Curriculum Analytics epic — real live-reported gap: the VP's unscoped
// views (Demand Forecast, Curriculum Health Monitor, Bottleneck Analyzer)
// dumped every course into one flat table with no way to slice it. "I want
// him to have the option to know each department separately or Basic
// Science Requirements or LRA subjects and so on to be categorized not all
// shown like that." Purely a client-side filter — the VP already gets the
// full unscoped dataset in one call, so no new route is needed; every
// course-level row in all three features already carries category/isUR/
// isBasicScience/departments (see CourseCategoryTags in curriculumAnalytics.ts).
import { useMemo } from 'react';

export interface CategoryFilterable {
  category: string;
  isUR: boolean;
  isBasicScience: boolean;
  departments: string[];
}

export interface CourseFilterValue {
  department: string; // 'all' or a real department code
  category: string;   // 'all', 'basic_science' (a flag, not a real category), or a real CourseCategory value
}

export const ALL_COURSE_FILTER: CourseFilterValue = { department: 'all', category: 'all' };

// LRA-prefixed courses (Japanese/Arabic language, key-skills seminars,
// electives — seedCatalog.ts's LRAE*/LRA* series) are exactly this app's
// ur_core/ur_elective courses — same set, the user's own name for it, so
// the dropdown label says both rather than picking one and leaving the
// other unrecognizable.
const CATEGORY_LABEL: Record<string, string> = {
  ur_core: 'University Requirements / LRA (Core)',
  ur_elective: 'University Requirements / LRA (Elective)',
  faculty: 'Faculty',
  school: 'School',
  program: 'Program',
  program_elective: 'Program Elective',
  core: 'Core',
  special: 'Special',
};

export function filterCourses<T extends CategoryFilterable>(courses: T[], filter: CourseFilterValue): T[] {
  return courses.filter(c => {
    if (filter.department !== 'all' && !c.departments.includes(filter.department)) return false;
    if (filter.category === 'basic_science') return c.isBasicScience;
    if (filter.category !== 'all' && c.category !== filter.category) return false;
    return true;
  });
}

export function CourseFilterBar({
  courses,
  value,
  onChange,
  showDepartment = true,
}: {
  courses: CategoryFilterable[];
  value: CourseFilterValue;
  onChange: (v: CourseFilterValue) => void;
  /** false on an already department-scoped page (the Advisor console) —
   *  the department dropdown would only ever have one option there. */
  showDepartment?: boolean;
}) {
  const departments = useMemo(() => [...new Set(courses.flatMap(c => c.departments))].sort(), [courses]);
  const categories = useMemo(() => [...new Set(courses.map(c => c.category))].sort(), [courses]);
  const hasBasicScience = useMemo(() => courses.some(c => c.isBasicScience), [courses]);
  const isFiltered = value.department !== 'all' || value.category !== 'all';

  return (
    <div className="su-flex su-items-center su-gap-14" style={{ flexWrap: 'wrap', marginBottom: 14 }}>
      {showDepartment && (
        <div className="su-field">
          <label>Department</label>
          <select className="su-input" value={value.department} onChange={e => onChange({ ...value, department: e.target.value })}>
            <option value="all">All departments</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      )}
      <div className="su-field">
        <label>Category</label>
        <select className="su-input" value={value.category} onChange={e => onChange({ ...value, category: e.target.value })}>
          <option value="all">All categories</option>
          {hasBasicScience && <option value="basic_science">Basic Science Requirements</option>}
          {categories.map(c => (
            <option key={c} value={c}>{CATEGORY_LABEL[c] ?? c}</option>
          ))}
        </select>
      </div>
      {isFiltered && (
        <button
          type="button"
          className="su-btn su-btn-sm su-btn-outline"
          style={{ alignSelf: 'flex-end' }}
          onClick={() => onChange(ALL_COURSE_FILTER)}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
