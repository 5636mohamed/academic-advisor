// Curriculum Analytics epic, Feature 3 — Course Bottleneck & Dependency
// Analyzer. See docs/CURRICULUM_ANALYTICS_BLUEPRINT.md. rankBottlenecks()
// reuses courseRiskScore.service.ts's computeCourseRisk() as-is (the same
// shared primitive Feature 2 is built on) — the only genuinely new logic
// in this file is affectedAdvisees(), the advisor-only cross-reference
// against their own real roster.
//
// Kept pure (no `db` import), same discipline every other module in this
// epic (and institutionalBottleneck.service.ts/frictionScore.service.ts
// before it) already follows: the route handler in server.ts does the real
// db.* queries and shapes them into the plain input types below, so this
// file stays independently unit-testable with synthetic fixtures.
import { Course, CourseOffering, BottleneckCourse, AffectedStudentRow } from '@advisor/shared';
import { computeCourseRisk } from './courseRiskScore.service';

export function rankBottlenecks(
  catalog: Course[],
  offeringsByCourse: Record<string, CourseOffering[]>,
  forecastedEnrolledByCode: Record<string, number>
): BottleneckCourse[] {
  const withRisk = catalog.map(course => {
    const risk = computeCourseRisk({
      course,
      offerings: offeringsByCourse[course.code] ?? [],
      catalog,
      forecastedNextTermEnrolled: forecastedEnrolledByCode[course.code] ?? 0,
    });
    const directlyBlocks = catalog.filter(c => c.prereq.includes(course.code)).map(c => c.code);
    return { ...risk, directlyBlocks };
  });
  return withRisk.sort((a, b) => b.cascadingDelaySemesters - a.cascadingDelaySemesters);
}

/** One roster student's real standing, shaped from db.getCurriculum(studentId)
 *  (CurriculumCourseView[]) by the route handler — status 'needs_retake' ->
 *  failedCourseCodes, 'passed' -> passedCourseCodes, everything else
 *  ('eligible'/'locked'/'registered', i.e. not yet passed) ->
 *  remainingCourseCodes. Using the curriculum view (not just
 *  getEligibleCourses) on purpose: it covers the student's FULL remaining
 *  catalog, including courses not reachable yet, not just what they could
 *  register for this instant — a bottleneck course gating something 3
 *  semesters out is still a real, worth-flagging risk. */
export interface StudentForBottleneckCheck {
  studentId: string;
  failedCourseCodes: string[];
  passedCourseCodes: string[];
  remainingCourseCodes: string[];
}

/** Only ever called with the requesting advisor's OWN roster — the caller
 *  (server.ts) is responsible for that scoping, same as every other
 *  advisor-facing route in this app (§12's real-ownership-check
 *  discipline, not just a UI filter). This function has no way to leak a
 *  student outside the `roster` it's given, by construction. */
export function affectedAdvisees(roster: StudentForBottleneckCheck[], bottlenecks: BottleneckCourse[]): AffectedStudentRow[] {
  const genuineBottlenecks = bottlenecks.filter(b => b.cascadingDelaySemesters > 0);
  const rows: AffectedStudentRow[] = [];

  for (const b of genuineBottlenecks) {
    for (const s of roster) {
      if (s.failedCourseCodes.includes(b.courseCode)) {
        rows.push({ studentId: s.studentId, bottleneckCourseCode: b.courseCode, reason: 'failed_needs_retake' });
        continue;
      }
      const alreadyCleared = s.passedCourseCodes.includes(b.courseCode);
      const genuinelyGatesSomethingRemaining = !alreadyCleared && b.directlyBlocks.some(code => s.remainingCourseCodes.includes(code));
      if (genuinelyGatesSomethingRemaining) {
        rows.push({ studentId: s.studentId, bottleneckCourseCode: b.courseCode, reason: 'prereq_not_yet_cleared' });
      }
    }
  }
  return rows;
}
