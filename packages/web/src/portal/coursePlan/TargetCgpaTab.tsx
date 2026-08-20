// "Target CGPA Focus" mode — GET /students/:id/plan/target?cgpa=… (§9.2's
// re-weighted-toward-target planner: "safety" below target, "speed" above
// it), with the target defaulting to 3.00 — the same "honors" target the
// Dashboard's CGPA card references.
import { useEffect, useState } from 'react';
import { api, StudentDetail } from '../../api/client';
import { categoryTag, creditCapDisplay } from '../lib/studentUiHelpers';
import { flattenPlanBundles, PlanBundle, PlanBundleResponse, RosterCourse } from '../lib/planBundle';
import { CatalogEntry } from '../lib/useCatalogMap';
import { Loading } from '../ui/Primitives';
import { DeferredCoursesNotice } from './DeferredCoursesNotice';
import { defaultCategoryTag, PlanRosterTable } from './PlanRosterTable';
import { computePlanProjection, PlanSummary } from './PlanSummary';
import { TargetChainCalculator } from './TargetChainCalculator';

export function TargetCgpaTab({
  studentId,
  student,
  catalog,
  completedCredits,
}: {
  studentId: string;
  student: StudentDetail;
  catalog: Map<string, CatalogEntry>;
  completedCredits: number | null;
}) {
  const [target, setTarget] = useState('3.00');
  const [plan, setPlan] = useState<RosterCourse[] | null>(null);
  const [deferred, setDeferred] = useState<PlanBundle[]>([]);
  const [mode, setMode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = (await api.planTarget(studentId, Number(target))) as PlanBundleResponse;
      setPlan(flattenPlanBundles(r));
      setDeferred(r.carriedToNextSemester ?? []);
      setMode(r.mode ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { run(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [studentId]);

  const cap = creditCapDisplay(student.cgpa);

  return (
    <div className="su-fade">
      <div className="su-flex su-items-center su-gap-14 su-mt-16" style={{ marginTop: 0, marginBottom: 18, flexWrap: 'wrap' }}>
        <div className="su-field">
          <label>Target CGPA</label>
          <input className="su-input" type="number" step="0.01" min="0" max="4" value={target} onChange={e => setTarget(e.target.value)} style={{ width: 100 }} />
        </div>
        <button className="su-btn" disabled={busy} onClick={run} style={{ alignSelf: 'flex-end' }}>Build plan</button>
        {mode && (
          <span className="su-badge info" style={{ alignSelf: 'flex-end', marginBottom: 10 }}>
            {mode === 'target_safe' ? 'Safety mode — you\'re below target' : 'Speed mode — you\'re above target'}
          </span>
        )}
      </div>

      {error && <div className="su-note danger su-mt-16">{error}</div>}
      {busy && !plan && <Loading label="Re-weighting your plan toward the target…" />}

      {plan && (
        <>
          <PlanSummary
            {...computePlanProjection(plan, catalog, student.cgpa, completedCredits)}
            currentCgpa={student.cgpa}
            cap={cap.cap}
            capReason={cap.reason}
          />
          <PlanRosterTable plan={plan} catalog={catalog} categoryTagFor={c => defaultCategoryTag(c, catalog, categoryTag)} />
          <DeferredCoursesNotice bundles={deferred} />
        </>
      )}

      <TargetChainCalculator currentCgpa={student.cgpa} completedCredits={completedCredits} />
    </div>
  );
}
