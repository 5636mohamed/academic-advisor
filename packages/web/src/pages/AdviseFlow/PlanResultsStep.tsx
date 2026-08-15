// Spec §10 step 4 — course "slips" list, mandatory vs optimizer-chosen
// styling, and a probation_repair mode banner when active. Also shows
// §15.2's best-case grade column. `hidePct` (§15.1) lets the student
// portal reuse this exact component with percentages hidden.
import { AdvisingActionDTO } from '../../api/client';
import { CourseSlip } from '../../components/CourseSlip';

export function PlanResultsStep({ result, cgpa, hidePct = false }: { result: AdvisingActionDTO; cgpa: number; hidePct?: boolean }) {
  const mandatoryCount = result.plan.filter(c => c.mandatory).length;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2>Recommended Plan</h2>
        <span className={`action-tag action-${result.action}`}>{result.action.replace(/_/g, ' ')}</span>
      </div>
      {cgpa < 2.0 && (
        <div className="note">
          <b>Probation-repair mode active.</b> Because your CGPA is below 2.00, this plan is weighted toward expected grade quality over speed-to-graduation (§4.3).
        </div>
      )}
      {mandatoryCount > 0 && (
        <p className="sub">
          {mandatoryCount} mandatory retake{mandatoryCount > 1 ? 's' : ''} (F on record) reserved first, unscored — the remaining credit capacity was optimized on top.
        </p>
      )}
      <table>
        <thead>
          <tr>
            <th>Course</th>
            <th>Expected</th>
            <th>Best case</th>
            <th>Δ pts</th>
            <th>Unlock value</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {result.plan.map(c => (
            <CourseSlip key={c.courseCode} course={c} hidePct={hidePct} />
          ))}
        </tbody>
      </table>
      {result.plan.length === 0 && <div className="muted">No eligible courses were found for this planning run.</div>}
      <p className="muted" style={{ marginTop: 10 }}>
        "Best case" (§15.2) is not a guess — it's this student's own best-ever result in a comparable course, shown so
        you can see how much better the outcome could realistically be at peak performance.
      </p>
    </div>
  );
}
