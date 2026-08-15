// Spec §10 step 3 / §5 — the blocking yes/no question, always shown FIRST,
// before any course "slip" is rendered. Now wired to
// POST /api/students/:id/retake-preference before running /advise.
import { useState } from 'react';

export function RetakeGateStep({ onAnswer }: { onAnswer: (considerRetakes: boolean) => void }) {
  const [submitting, setSubmitting] = useState(false);

  const answer = (value: boolean) => {
    setSubmitting(true);
    onAnswer(value);
  };

  return (
    <div className="card">
      <h2>Before we build your plan</h2>
      <p className="sub">
        Would you like the plan to consider retaking courses you could improve on,
        to help raise your CGPA?
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button disabled={submitting} onClick={() => answer(true)}>
          Yes, consider retakes
        </button>
        <button className="secondary" disabled={submitting} onClick={() => answer(false)}>
          No, only new courses
        </button>
      </div>
      <div className="note">
        <b>Note:</b> if you have any course graded F, it will still appear in your
        plan as a mandatory retake either way — it must be passed to graduate.
      </div>
    </div>
  );
}
