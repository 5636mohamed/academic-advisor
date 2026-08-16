// "Fastest Graduation" mode — GET /students/:id/plan/fast (§9.2's speed
// baseline planner), styled as course-plan.pdf's roster screen.
import { useEffect, useState } from 'react';
import { api, StudentDetail } from '../../api/client';
import { categoryTag, creditCapDisplay } from '../lib/studentUiHelpers';
import { flattenPlanBundles, PlanBundleResponse, RosterCourse } from '../lib/planBundle';
import { CatalogEntry } from '../lib/useCatalogMap';
import { Loading } from '../ui/Primitives';
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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);

  const load = () => {
    setError(null);
    api.planFast(studentId)
      .then(r => setPlan(flattenPlanBundles(r as PlanBundleResponse)))
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

  const cap = creditCapDisplay(student.cgpa);
  const { totalCredits, semesterGpa, postGpa } = computePlanProjection(plan, catalog, student.cgpa, completedCredits);

  return (
    <div className="su-fade">
      <PlanSummary totalCredits={totalCredits} semesterGpa={semesterGpa} postGpa={postGpa} currentCgpa={student.cgpa} cap={cap.cap} capReason={cap.reason} />
      <PlanRosterTable plan={plan} catalog={catalog} categoryTagFor={c => defaultCategoryTag(c, catalog, categoryTag)} />
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
