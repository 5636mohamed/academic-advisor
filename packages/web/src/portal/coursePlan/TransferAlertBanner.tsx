// The real §4.2 advising-cycle transfer recommendation used to only ever
// surface if the student happened to click into the "Probation Repair" mode
// tab specifically — easy to miss entirely if they only looked at "Fastest
// Graduation" (the default tab). This runs the same real, read-only
// api.advise() check proactively on page load (safe — it computes and
// returns a recommendation, it never persists or executes a transfer) and
// shows a persistent banner ABOVE the mode tabs, visible no matter which
// one is selected, whenever the result isn't a plain SHOW_PLAN. Clicking
// through still lands on the real Probation Repair flow for full detail
// and the actual Dismiss/Request Transfer actions — this banner is only
// the "don't miss it" surface, not a second copy of that logic.
import { useEffect, useState } from 'react';
import { api, AdvisingActionDTO } from '../../api/client';

export function TransferAlertBanner({ studentId, onViewRecommendation }: { studentId: string; onViewRecommendation: () => void }) {
  const [result, setResult] = useState<AdvisingActionDTO | 'loading' | 'error' | null>(null);

  useEffect(() => {
    setResult('loading');
    api.advise(studentId).then(setResult).catch(() => setResult('error'));
  }, [studentId]);

  if (result === null || result === 'loading' || result === 'error') return null;
  if (result.action === 'SHOW_PLAN') return null;

  const isInternal = result.action === 'RECOMMEND_INTERNAL_TRANSFER';

  return (
    <div className="su-banner-dark su-pop su-mt-16" style={{ marginTop: 0, marginBottom: 18 }}>
      <div className="su-flex su-justify-between su-items-center" style={{ flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div className="su-eyebrow">AI Advisory Warning</div>
          <div className="su-title" style={{ color: 'var(--su-banner-text)', fontSize: 17, marginTop: 4 }}>
            {isInternal ? 'A department transfer is recommended for you' : 'A faculty transfer is recommended for you'}
          </div>
          <div className="su-subtitle" style={{ marginTop: 4 }}>
            Based on your current CGPA trajectory and probation status — see the full breakdown and your options
            under Probation Repair.
          </div>
        </div>
        <button className="su-btn" onClick={onViewRecommendation} style={{ flexShrink: 0 }}>View Recommendation</button>
      </div>
    </div>
  );
}
