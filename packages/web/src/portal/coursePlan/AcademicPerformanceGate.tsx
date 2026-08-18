// "Academic Performance Gate" — retake-gate.pdf, the same blocking
// yes/no question RetakeGateStep.tsx asks (always first, before any plan is
// built), reskinned as two selectable cards instead of two buttons. Wired to
// the same POST /students/:id/retake-preference the original step used.
import { useState } from 'react';

export function AcademicPerformanceGate({ onAnswer, onSkip }: { onAnswer: (considerRetakes: boolean) => void; onSkip: () => void }) {
  const [choice, setChoice] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const go = () => {
    if (choice === null) return;
    setSubmitting(true);
    onAnswer(choice);
  };

  return (
    <div className="su-fade" style={{ maxWidth: 720, margin: '10px auto 0' }}>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <div className="su-eyebrow" style={{ color: 'var(--su-accent)' }}>Step 1: CGPA Repair Setup</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: '6px 0 10px' }}>Academic Performance Gate</h1>
        <div className="su-subtitle" style={{ fontSize: 14 }}>
          To lift academic probation and raise your GPA quickly, academic policy highly encourages repeating
          courses with grades below C. Let us customize your course plan.
        </div>
      </div>

      <div className="su-card su-pop">
        <div className="su-title" style={{ textAlign: 'center', marginBottom: 16 }}>
          Would you like to consider retaking courses to raise your CGPA?
        </div>
        <div className="su-fit-grid">
          <button type="button" className={`su-choice-card${choice === true ? ' selected' : ''}`} onClick={() => setChoice(true)}>
            <div className="su-flex su-justify-between su-items-center">
              <span style={{ fontWeight: 800, color: choice === true ? 'var(--su-accent)' : undefined }}>Yes, include retakes</span>
              <span className="radio" />
            </div>
            <div className="su-subtitle" style={{ marginTop: 8 }}>
              Recommend replacing low grades (e.g. F, D, D+) with priority. This is the fastest path to repair your
              CGPA and exit probation.
            </div>
          </button>
          <button type="button" className={`su-choice-card${choice === false ? ' selected' : ''}`} onClick={() => setChoice(false)}>
            <div className="su-flex su-justify-between su-items-center">
              <span style={{ fontWeight: 800, color: choice === false ? 'var(--su-accent)' : undefined }}>No, fresh courses only</span>
              <span className="radio" />
            </div>
            <div className="su-subtitle" style={{ marginTop: 8 }}>
              Only plan newly required curriculum courses; keep previous grades as they are. Warning: recovering your
              CGPA may take much longer with this choice.
            </div>
          </button>
        </div>
        <div className="su-flex su-justify-between su-mt-20" style={{ flexWrap: 'wrap', gap: 10 }}>
          <button className="su-btn su-btn-secondary" onClick={onSkip}>Go to Dashboard</button>
          <button className="su-btn" disabled={choice === null || submitting} onClick={go}>Generate Optimal Course Plan</button>
        </div>
      </div>
    </div>
  );
}
