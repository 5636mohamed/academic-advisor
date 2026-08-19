// AI Features Blueprint (docs/AI_FEATURES_BLUEPRINT.md) — Cognitive Load
// Heatmap & Friction Simulator.
//
// One deviation from the blueprint's original schema, made during actual
// implementation: SyllabusMilestone is NOT tied to a specific
// semesterOrdinal instance. A course's syllabus structure (when its
// midterm/labs/reports fall, week-by-week) repeats every time it's
// offered — keying milestones by (courseCode, weekNumber, type) as a
// reusable template, looked up against whichever courses a student is
// CURRENTLY registered in, avoids duplicating near-identical data per
// semester instance for no real benefit. Likewise, FrictionLog isn't a
// persisted table in this cut — friction scores are computed live from
// the template + the student's real registered courses, the same
// "pure function, computed on demand" philosophy the rest of
// packages/api/src/modules/prediction already follows (cohortProjectedPct,
// studentTrendPct, etc. are never cached either).

export type MilestoneType = 'assignment' | 'lab_report' | 'quiz' | 'midterm' | 'final' | 'project_deadline';

export interface SyllabusMilestone {
  courseCode: string;
  weekNumber: number; // 1-based, within a generic 14-week semester template
  type: MilestoneType;
  title: string;
}

/** One computed week's reading for one student — the live-computed
 *  analogue of the blueprint's original FrictionLog row. */
export interface FrictionReading {
  weekNumber: number;
  frictionScore: number;
  burnoutRisk: boolean;
  /** Which courses contributed a milestone this week, and what — lets the
   *  UI explain WHY a week is red, not just that it is. */
  contributingMilestones: { courseCode: string; type: MilestoneType; title: string }[];
}

export type FrictionTrendReading = 'worsening' | 'flat' | 'improving' | 'insufficient_history';

export interface FrictionTimeline {
  readings: FrictionReading[];
  trend: { slope: number | null; reading: FrictionTrendReading };
}

/** One (department x week) cell in the VP macro-dashboard — mean friction
 *  score across every student registered in that department this
 *  semester, plus how often it crossed the burnout threshold. */
export interface InstitutionalFrictionCell {
  departmentId: string;
  weekNumber: number;
  meanFrictionScore: number;
  burnoutRiskFraction: number; // 0-1, fraction of students over threshold that week
  /** True only when this (dept, week) cell sits in the top decile AND that
   *  held across >=2 of the last 3 semesters — see
   *  institutionalBottleneck.service.ts for the exact repeated-measures
   *  check. A single bad semester is a data point, not a "consistently
   *  overloads" claim. */
  isConsistentBottleneck: boolean;
}
