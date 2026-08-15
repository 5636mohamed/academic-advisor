// Spec §10 step 5 — "the numeric basis: current CGPA, projected CGPA under
// the normal plan, trend slope, in plain language," plus ranked dept/faculty
// fit bars matching the prototype's dept-card styling. Never a black box
// (spec §12).
import { DeptFitResultDTO } from '../api/client';

export function TransferExplanationCard({
  currentCgpa,
  projectedCGPA,
  trendSlope,
  explain,
  candidates,
  candidateLabel,
}: {
  currentCgpa: number;
  projectedCGPA: number;
  trendSlope: number | null;
  explain: string;
  candidates: DeptFitResultDTO[];
  candidateLabel: string;
}) {
  const trendWords =
    trendSlope === null ? 'not enough history yet to tell' : trendSlope > 0.01 ? 'improving' : trendSlope < -0.01 ? 'declining' : 'flat';

  return (
    <div className="card">
      <h2>Why this recommendation</h2>
      <div className="stat-row">
        <div className="stat">
          <div className="label">Current CGPA</div>
          <div className="value">{currentCgpa.toFixed(2)}</div>
        </div>
        <div className="stat">
          <div className="label">Projected (this plan)</div>
          <div className="value">{projectedCGPA.toFixed(2)}</div>
        </div>
        <div className="stat">
          <div className="label">Real trend</div>
          <div className="value" style={{ fontSize: 16 }}>
            {trendWords}
          </div>
        </div>
      </div>
      <p className="sub" style={{ marginBottom: 8 }}>
        {explainToSentence(explain, currentCgpa, projectedCGPA)}
      </p>
      <h3>{candidateLabel}</h3>
      {candidates.map(c => (
        <div className="dept-card" key={c.id}>
          <div className="dept-name">{c.name}</div>
          <div className="dept-bars">
            <div className="fit-bar-track">
              <div className="fit-bar-fill" style={{ width: `${Math.round(c.total * 100)}%` }} />
            </div>
            <div className="muted">
              quiz {Math.round(c.quizScore * 100)}% · grades {Math.round(c.gwScore * 100)}% · alumni {Math.round(c.alumScore * 100)}%
            </div>
          </div>
          <div className="dept-score">{Math.round(c.total * 100)}%</div>
        </div>
      ))}
      {candidates.length === 0 && <div className="muted">No candidates available.</div>}
    </div>
  );
}

function explainToSentence(explain: string, current: number, projected: number): string {
  switch (explain) {
    case 'flat_or_declining_trend_but_better_fit_department_available_in_faculty':
      return `Your CGPA trend is flat or declining even under this semester's best plan (projected ${projected.toFixed(2)} vs. current ${current.toFixed(2)}). A better-fitting department in your own faculty may perform better for you.`;
    case 'cgpa_remains_below_2_after_projection':
      return `Your CGPA is projected to remain below 2.00 (${projected.toFixed(2)}) even under the best in-faculty alternative — a faculty transfer is recommended.`;
    case 'no_departmental_alternative_improves_trend':
      return 'No department within your current faculty is projected to turn your trend around — a faculty transfer is recommended.';
    case 'probation_warning_3_internal_transfer_recommended':
      return "You've reached warning 3 of 6. Per policy, an internal department transfer is recommended at this stage.";
    case 'probation_warning_3_internal_transfer_already_used_escalating_to_faculty':
      return "You've reached warning 3 of 6 and already used your one internal-department transfer — escalating to a faculty transfer recommendation.";
    case 'probation_warning_4_plus_faculty_transfer_recommended':
      return "You've reached warning 4 or more of 6. Per policy, a faculty transfer is recommended at this stage.";
    default:
      return `Projected CGPA under this plan: ${projected.toFixed(2)} (currently ${current.toFixed(2)}).`;
  }
}
