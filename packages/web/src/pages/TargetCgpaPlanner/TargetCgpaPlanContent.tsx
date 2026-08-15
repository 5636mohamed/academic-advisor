// Shared content for the Target-CGPA planner, reused by both the advisor's
// TargetCgpaPlanner page and the student portal's PortalTargetCgpa page.
// `hidePct` implements §15.1's letters-only rule for the portal.
import { useState } from 'react';
import { api } from '../../api/client';

interface Member {
  courseCode: string;
  expectedLetter: string;
  expectedPct: number;
  credits: number;
  isRetake: boolean;
}
interface Bundle { members: Member[]; credits: number; score: number }
interface PlanTargetResponse {
  mode: string;
  targetCgpa: number;
  mandatoryBundles: Bundle[];
  optimizedBundles: Bundle[];
  carriedToNextSemester: Bundle[];
  totalCredits: number;
}

export function TargetCgpaPlanContent({ studentId, hidePct = false }: { studentId: string; hidePct?: boolean }) {
  const [target, setTarget] = useState('3.00');
  const [result, setResult] = useState<PlanTargetResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult((await api.planTarget(studentId, Number(target))) as PlanTargetResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const bundles = result ? [...result.mandatoryBundles, ...result.optimizedBundles] : [];

  return (
    <div>
      <div className="card">
        <h2>Target CGPA Plan</h2>
        <p className="sub">Re-weighted toward safety when you're below the target, or speed when you're above it.</p>
        <div className="form-row">
          <label>Target CGPA:</label>
          <input type="number" step="0.01" min="0" max="4" value={target} onChange={e => setTarget(e.target.value)} style={{ width: 90 }} />
          <button disabled={busy} onClick={run}>Build plan</button>
        </div>
        {error && <div className="note" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>{error}</div>}
      </div>

      {result && (
        <div className="card">
          <h2>
            Mode: {result.mode === 'target_safe' ? 'Safety (below target)' : 'Speed (above target)'} · {result.totalCredits} credits
          </h2>
          <table>
            <thead>
              <tr>
                <th>Course</th>
                <th>Expected</th>
                {!hidePct && <th>%</th>}
                <th>Credits</th>
              </tr>
            </thead>
            <tbody>
              {bundles.flatMap(b => b.members).map(m => (
                <tr key={m.courseCode}>
                  <td>{m.courseCode}{m.isRetake ? <span className="badge neutral" style={{ marginLeft: 6 }}>retake</span> : null}</td>
                  <td className={`letter-${m.expectedLetter.replace('+', 'p')}`}>{m.expectedLetter}</td>
                  {!hidePct && <td>{m.expectedPct.toFixed(1)}%</td>}
                  <td>{m.credits}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.carriedToNextSemester.length > 0 && (
            <p className="muted">Carried to next semester (didn't fit the credit cap): {result.carriedToNextSemester.flatMap(b => b.members.map(m => m.courseCode)).join(', ')}</p>
          )}
        </div>
      )}
    </div>
  );
}
