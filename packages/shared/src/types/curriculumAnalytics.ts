// Academic Resource Demand Forecasting / Curriculum Health Monitor / Course
// Bottleneck & Dependency Analyzer — see docs/CURRICULUM_ANALYTICS_BLUEPRINT.md
// for the full design. All three features are built on real historical
// CourseOffering data (course.ts) and the existing prerequisite graph
// (Course.prereq) — nothing here invents a parallel data source.

/** Feature 1 — one course's demand projection, derived from its real
 *  CourseOffering history via the same OLS regression (linearRegression.ts)
 *  every other trend projection in this system already uses. `history` is
 *  included so the UI can plot "what actually happened" next to "what's
 *  projected," not just show the projected number in isolation. */
export interface DemandForecast {
  courseCode: string;
  courseName: string;
  departmentId: string | null;
  history: Array<{ term: string; year: number; enrolled: number }>;
  nextTermEnrolled: number;
  /** +/- seats, derived from the fit's residual spread — an honest
   *  uncertainty band, not a fabricated single number. */
  confidenceBand: number;
  /** Derived estimate (enrolled / typical class size for this course's
   *  category), NOT a real section-scheduling system — this app has no
   *  Section/Instructor entity. See the blueprint's §5 for why. */
  forecastedSections: number;
  forecastedSeatsNeeded: number;
  /** 1:1 with forecastedSections — explicitly assumes one instructor per
   *  section; there is no real instructor-assignment data behind this. */
  forecastedInstructorLoad: number;
  trendSlope: number;
}

/** One department's (or, for the VP, the whole faculty's) demand rollup —
 *  courses[] sums to the totals, so the UI never has to re-derive them. */
export interface DepartmentDemandForecast {
  departmentId: string;
  totalNextTermEnrolled: number;
  totalForecastedSections: number;
  totalForecastedInstructorLoad: number;
  courses: DemandForecast[];
}

/** Feature 2 & 3's shared primitive output — computeCourseRisk() in
 *  courseRiskScore.service.ts. Every field here is either a direct reuse of
 *  an existing signal (failureRate <- passRateFromOfferings, downstreamImpact
 *  <- chainUnlockValue) or the one genuinely new formula this epic adds
 *  (cascadingDelaySemesters / healthScore) — see the blueprint for the full
 *  derivation. */
export interface CourseRiskProfile {
  courseCode: string;
  courseName: string;
  departmentId: string | null;
  /** 0-100, pooled real historical failure rate (100 - passRateFromOfferings). */
  failureRate: number;
  /** chainUnlockValue(code, catalog) — how many courses, decayed by
   *  distance, are gated behind this one. 0 for a leaf course with no
   *  dependents. */
  downstreamImpact: number;
  /** Forecasted next-term enrollment ÷ this course's typical historical
   *  class size. >1 means demand is outrunning what this course has
   *  historically accommodated. */
  demandPressure: number;
  /** The one genuinely new number this epic adds: an expected-additional-
   *  semesters estimate for a student who fails this course, given its real
   *  failure rate, how saturated re-enrollment demand is, and how many
   *  other courses it gates. Not a demo/decorative score — this is the
   *  literal "graduation delay" the user asked to see. */
  cascadingDelaySemesters: number;
  /** 0-100, higher = healthier. Composite of the three signals above,
   *  weights read from predictionWeights.json's curriculumAnalytics.health
   *  block (retunable without a redeploy, same as every other formula in
   *  this system). */
  healthScore: number;
}

/** Feature 2 — one department's (or, for the VP, all departments') health
 *  report. `allCourses` is included (not just the summary) so the frontend
 *  can render a full sortable table, not just the top-5 "worst" list. */
export interface CurriculumHealthReport {
  /** null = every real department (the VP's unscoped view). */
  departmentId: string | null;
  averageHealthScore: number;
  /** Count of courses with healthScore below
   *  predictionWeights.json's curriculumAnalytics.health.atRiskThreshold. */
  coursesAtRisk: number;
  totalCourses: number;
  /** Lowest healthScore first — the courses that most need attention. */
  worstCourses: CourseRiskProfile[];
  allCourses: CourseRiskProfile[];
}

/** Feature 3 — a CourseRiskProfile enriched with the real downstream course
 *  list (not just downstreamImpact's decayed count), since "which specific
 *  courses does this block" is the actionable part an advisor or the VP
 *  needs, not an abstract number. */
export interface BottleneckCourse extends CourseRiskProfile {
  /** Course codes that list this course directly in their own prereq[]. */
  directlyBlocks: string[];
}

/** Feature 3's advisor-only cross-reference: which of THIS advisor's own
 *  advisees are actually affected by a given bottleneck course — either
 *  they've already failed it and need a retake, or it's still a real
 *  unfulfilled gate somewhere ahead in their remaining plan. No `studentName`
 *  here on purpose (see AffectedStudentRowDTO in client.ts) — this is the
 *  pure domain shape; the name gets attached at the API boundary, same
 *  pattern server.ts's withMemberNames/withProfessorName already use for
 *  every other id-only domain row. */
export interface AffectedStudentRow {
  studentId: string;
  bottleneckCourseCode: string;
  reason: 'failed_needs_retake' | 'prereq_not_yet_cleared';
}
