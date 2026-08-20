// GET /students/:id/plan/fast and /plan/target (§9.2's two prototype-
// baseline planners) return a different shape than POST /advise's
// AdvisingActionDTO — bundles of members (coreqs grouped together), split
// into `mandatoryBundles` vs `optimizedBundles` rather than a single flat
// `plan` array with a per-course `mandatory` flag. api/client.ts types both
// endpoints' response as `unknown` (see TargetCgpaPlanContent.tsx's own
// local interfaces for the same shape) — these are the same fields, shared
// so the redesigned Fastest-Graduation/Target-CGPA tabs and the Probation
// Repair tab (which DOES get a flat PlanCourseDTO[] from /advise) can all
// feed the same `PlanRosterTable`/`computePlanProjection` via one common,
// minimal `RosterCourse` shape.
export interface PlanMember {
  courseCode: string;
  expectedLetter: string;
  expectedPct: number;
  expectedPoints: number;
  credits: number;
  isRetake: boolean;
  passRate: number;
  // §15.2 — now attached server-side to /plan/fast and /plan/target too
  // (see server.ts's attachBestCaseToPlanResult), not just /advise.
  bestCaseLetter: string;
  bestCasePct: number;
  bestCasePoints: number;
}
export interface PlanBundle {
  members: PlanMember[];
  credits: number;
  score: number;
  // Only set on a bundle inside `carriedToNextSemester` — see planPacker.ts's
  // own doc comment. 'credit_overflow': a real mandatory retake that simply
  // didn't fit under the credit cap. 'still_predicted_fail': a mandatory
  // retake whose OWN fresh prediction for this attempt is still an F — real
  // bug reported live (Peter Nour, IME-gen-19): these used to be packed
  // into the plan anyway just because they're compulsory to eventually
  // graduate, regardless of what the model itself predicted. Deferred here
  // instead, surfaced by DeferredCoursesNotice.tsx rather than silently
  // dropped (this field existed in the API response before this fix too —
  // `carriedToNextSemester` was never rendered anywhere on the frontend
  // until now).
  carriedReason?: 'credit_overflow' | 'still_predicted_fail';
}
export interface PlanBundleResponse {
  mode?: string;
  mandatoryBundles: PlanBundle[];
  optimizedBundles: PlanBundle[];
  carriedToNextSemester: PlanBundle[];
  totalCredits: number;
}

/** The subset of PlanCourseDTO / PlanMember every redesigned roster screen
 *  actually needs — deliberately excludes `credits` (always resolved via the
 *  shared catalog map instead, since AdvisingActionDTO's PlanCourseDTO
 *  doesn't carry it) and `bestCase*` (only /advise computes it — never
 *  fabricated for the two baseline planners). */
export interface RosterCourse {
  courseCode: string;
  isRetake: boolean;
  mandatory: boolean;
  expectedLetter: string;
  expectedPoints: number;
  passRate: number;
  bestCaseLetter: string;
}

export function flattenPlanBundles(r: PlanBundleResponse): RosterCourse[] {
  const conv = (bundles: PlanBundle[], mandatory: boolean): RosterCourse[] =>
    bundles.flatMap(b =>
      b.members.map(m => ({
        courseCode: m.courseCode,
        isRetake: m.isRetake,
        mandatory,
        expectedLetter: m.expectedLetter,
        expectedPoints: m.expectedPoints,
        passRate: m.passRate,
        bestCaseLetter: m.bestCaseLetter,
      }))
    );
  return [...conv(r.mandatoryBundles, true), ...conv(r.optimizedBundles, false)];
}
