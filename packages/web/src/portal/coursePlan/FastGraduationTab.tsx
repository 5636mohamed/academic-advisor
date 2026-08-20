// "Fastest Graduation" mode — GET /students/:id/plan/fast (§9.2's speed
// baseline planner), styled as course-plan.pdf's roster screen.
import { useEffect, useState } from 'react';
import { api, StudentDetail } from '../../api/client';
import { categoryTag, creditCapDisplay } from '../lib/studentUiHelpers';
import { flattenPlanBundles, PlanBundle, PlanBundleResponse, RosterCourse } from '../lib/planBundle';
import { CatalogEntry } from '../lib/useCatalogMap';
import { Loading } from '../ui/Primitives';
import { DeferredCoursesNotice } from './DeferredCoursesNotice';
import { defaultCategoryTag, PlanRosterTable } from './PlanRosterTable';
import { computePlanProjection, PlanSummary } from './PlanSummary';

export function FastGraduationTab({
  studentId,
  student,
  catalog,
  completedCredits,
  onGoToRecommendations,
  submitLabel = 'Submit to Advisor',
  submitMessage = 'Submitted — see the "My Recommendations" tab once your advisor reviews it.',
  recommendationsLinkLabel = 'View',
}: {
  studentId: string;
  student: StudentDetail;
  catalog: Map<string, CatalogEntry>;
  completedCredits: number | null;
  onGoToRecommendations: () => void;
  submitLabel?: string;
  submitMessage?: string;
  recommendationsLinkLabel?: string;
}) {
  const [plan, setPlan] = useState<RosterCourse[] | null>(null);
  const [deferred, setDeferred] = useState<PlanBundle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);

  const load = () => {
    setError(null);
    api.planFast(studentId)
      .then(r => {
        const response = r as PlanBundleResponse;
        setPlan(flattenPlanBundles(response));
        setDeferred(response.carriedToNextSemester ?? []);
      })
      .catch(e => setError(e instanceof Error ? e.message : String(e)));
  };

  useEffect(load, [studentId]);

  const submit = async () => {
    setBusy(true);
    setSubmitMsg(null);
    try {
      await api.generateProposals(studentId);
      setSubmitMsg(submitMessage);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="su-note danger">{error}</div>;
  if (!plan) return <Loading label="Building the fastest path to graduation…" />;

  // Real live report: this call was missing the 2nd arg entirely, so a
  // brand-new cold-start student (cgpa 0 — no grade yet, not a real 0.0)
  // silently defaulted to hasCompletedAnyCourse=true and got mislabeled
  // "14-credit limit — Reduced due to probation" even though their real
  // packed plan (server-side, which already has this fix) is a normal
  // 20-credit one. `completedCredits` (already a prop here) is the same
  // "has any real coursework yet" signal PortalHome.tsx/Overview.tsx
  // already derive from `curriculum` — just via a field this tab already
  // has in hand, so no new prop had to be threaded through.
  const cap = creditCapDisplay(student.cgpa, (completedCredits ?? 0) > 0);
  const { totalCredits, semesterGpa, postGpa } = computePlanProjection(plan, catalog, student.cgpa, completedCredits);

  return (
    <div className="su-fade">
      <PlanSummary totalCredits={totalCredits} semesterGpa={semesterGpa} postGpa={postGpa} currentCgpa={student.cgpa} cap={cap.cap} capReason={cap.reason} />
      <PlanRosterTable plan={plan} catalog={catalog} categoryTagFor={c => defaultCategoryTag(c, catalog, categoryTag)} />
      <DeferredCoursesNotice bundles={deferred} />
      <div className="su-flex su-justify-between su-items-center su-mt-16" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div className="su-subtitle" style={{ margin: 0 }}>
          Auto-balanced to graduate as fast as possible within your {cap.cap}-credit limit.
        </div>
        <div className="su-flex su-gap-10">
          <button className="su-btn su-btn-secondary" onClick={load}>Recalculate Path</button>
          <button className="su-btn" disabled={busy} onClick={submit}>{submitLabel}</button>
        </div>
      </div>
      {submitMsg && (
        <div className="su-note good su-mt-16 su-pop">
          {submitMsg}{' '}
          <button className="su-btn su-btn-sm su-btn-outline" style={{ marginLeft: 8 }} onClick={onGoToRecommendations}>{recommendationsLinkLabel}</button>
        </div>
      )}
    </div>
  );
}
