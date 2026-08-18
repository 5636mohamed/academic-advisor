// The "AI Advisory Warning & Structural recommendation" screen from
// transfer-recommendation.pdf — shown when the real advising cycle's action
// is RECOMMEND_INTERNAL_TRANSFER or RECOMMEND_FACULTY_TRANSFER (§4.2). Only
// ever renders real numbers: the fit-score breakdown for each candidate
// (§6's weighted-sum engine) and `projectedCGPA`, which the engine computes
// for the CURRENT major's own plan (i.e. "if you stay") — there is no
// equivalent server-side projection for the *recommended* department's own
// plan, so unlike the mockup this never invents a second CGPA number for
// it; the fit-score comparison carries that half of the argument instead.
import { AdvisingActionDTO, DeptFitResultDTO } from '../../api/client';
import { ScoreRow } from '../ui/Primitives';

function explainSentence(explain: string, current: number, projected: number): string {
  switch (explain) {
    case 'flat_or_declining_trend_but_better_fit_department_available_in_faculty':
      return `Your CGPA trend is flat or declining even under this semester's best plan (projected ${projected.toFixed(2)} vs. current ${current.toFixed(2)}). A better-fitting department in your own faculty may perform better for you.`;
    case 'cgpa_remains_below_2_after_projection':
      return `Your CGPA is projected to remain below 2.00 (${projected.toFixed(2)}) even under the best in-faculty alternative — a faculty transfer is recommended.`;
    case 'no_departmental_alternative_improves_trend':
      return 'No department within your current faculty is projected to turn your trend around — a faculty transfer is recommended.';
    case 'probation_warning_3_internal_transfer_recommended':
      return "You've reached warning 3 of 6. Per academic policy, an internal department transfer is recommended at this stage.";
    case 'probation_warning_3_internal_transfer_already_used_escalating_to_faculty':
      return "You've reached warning 3 of 6 and already used your one internal-department transfer — escalating to a faculty transfer recommendation.";
    case 'probation_warning_4_plus_faculty_transfer_recommended':
      return "You've reached warning 4 or more of 6. Per academic policy, a faculty transfer is recommended at this stage.";
    default:
      return `Projected CGPA if you stay on this path: ${projected.toFixed(2)} (currently ${current.toFixed(2)}).`;
  }
}

export function TransferRecommendation({
  result,
  currentCgpa,
  candidates,
  currentLabel,
  currentEntry,
  onDismiss,
  onRequestTransfer,
  requestBusy,
}: {
  result: AdvisingActionDTO;
  currentCgpa: number;
  candidates: DeptFitResultDTO[];
  currentLabel: string;
  currentEntry?: DeptFitResultDTO;
  onDismiss: () => void;
  onRequestTransfer: () => void;
  requestBusy: boolean;
}) {
  const top = candidates[0];
  const isInternal = result.action === 'RECOMMEND_INTERNAL_TRANSFER';

  return (
    <div className="su-fade">
      <div className="su-banner-dark">
        <div className="su-eyebrow">AI Advisory Warning &amp; Structural Recommendation</div>
        <div className="su-title">{isInternal ? 'Department Switch Suggested' : 'Faculty Transfer Suggested'}{top ? `: ${top.name}` : ''}</div>
        <div className="su-subtitle">{explainSentence(result.explain, currentCgpa, result.projectedCGPA)}</div>
      </div>

      <div className="su-fit-grid su-mt-16">
        <div className="su-fit-card highlight su-pop">
          <div className="su-fit-card-top">
            <div>
              <div className="su-eyebrow" style={{ color: 'var(--su-accent)' }}>Highest aptitude match</div>
              <div className="su-fit-name">{top ? top.name : '—'}</div>
            </div>
            <span className="su-badge solid">{top ? Math.round(top.total * 100) : 0}% Fit</span>
          </div>
          {top && (
            <ul className="su-fit-list">
              <li>Quiz alignment: {Math.round(top.quizScore * 100)}%</li>
              <li>Gateway-course grades: {Math.round(top.gwScore * 100)}%</li>
              <li>Alumni outcomes: {Math.round(top.alumScore * 100)}%</li>
            </ul>
          )}
        </div>
        <div className="su-fit-card su-pop" style={{ animationDelay: '60ms' }}>
          <div className="su-fit-card-top">
            <div>
              <div className="su-eyebrow">{currentLabel}</div>
              <div className="su-fit-name">{currentEntry?.name ?? '—'}</div>
            </div>
            {currentEntry && <span className="su-badge neutral">{Math.round(currentEntry.total * 100)}% Fit</span>}
          </div>
          <ul className="su-fit-list">
            <li>Current CGPA: {currentCgpa.toFixed(2)}</li>
            <li>Projected CGPA if you stay: {result.projectedCGPA.toFixed(2)}</li>
            <li>{result.projectedCGPA >= 2.0 ? 'Reaches good standing' : 'Probation continues'}</li>
          </ul>
        </div>
      </div>

      <div className="su-card su-mt-16">
        <div className="su-eyebrow" style={{ marginBottom: 10 }}>Current path outlook</div>
        <div className="su-pathway">
          <div className="su-pathway-label">
            <span>Current CGPA {currentCgpa.toFixed(2)}</span>
            <span>Projected {result.projectedCGPA.toFixed(2)}</span>
          </div>
          <div className="su-pathway-track">
            <div
              className="su-pathway-fill"
              style={{
                width: `${Math.min(100, (result.projectedCGPA / 4) * 100)}%`,
                background: result.projectedCGPA >= 2.0 ? 'var(--su-good)' : 'var(--su-danger)',
              }}
            />
          </div>
        </div>
        {candidates.length > 1 && (
          <div className="su-mt-20">
            {candidates.slice(0, 4).map(c => <ScoreRow key={c.id} name={c.name} pct={c.total} />)}
          </div>
        )}
      </div>

      <div className="su-flex su-justify-between su-items-center su-mt-16" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div className="su-subtitle" style={{ margin: 0 }}>
          Initiating a transfer request will alert the Dean of Engineering and schedule an official advisory interview
          session with your assigned counselor.
        </div>
        <div className="su-flex su-gap-10">
          <button className="su-btn su-btn-secondary" onClick={onDismiss}>Dismiss Recommendation</button>
          <button className="su-btn" disabled={!top || requestBusy} onClick={onRequestTransfer}>Request Program Transfer</button>
        </div>
      </div>
    </div>
  );
}
