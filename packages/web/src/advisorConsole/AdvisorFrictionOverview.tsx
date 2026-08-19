// AI Features Blueprint §2/§3.2 — advisor-level Cognitive Load view. A
// full per-week FrictionTimeline chart per student would be too dense for
// a 25-row roster table, so this is deliberately a simpler triage table
// (worst peak-week first) rather than reusing FrictionTimeline.tsx
// directly — that component is for the single-student depth view
// (PortalWorkload.tsx), this is for "who needs a check-in this week"
// breadth across a whole roster.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, FrictionOverviewRowDTO } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Loading, Section, Empty } from '../portal/ui/Primitives';

const TREND_LABEL: Record<string, string> = { worsening: 'Rising', improving: 'Easing', flat: 'Steady', insufficient_history: '—' };

export function AdvisorFrictionOverview() {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const advisorId = auth?.role === 'advisor' ? auth.advisorId : undefined;
  const [rows, setRows] = useState<FrictionOverviewRowDTO[] | null>(null);

  useEffect(() => {
    if (advisorId) api.advisorFrictionOverview(advisorId).then(setRows);
  }, [advisorId]);

  if (!rows) return <Loading label="Projecting workload across your roster…" />;

  const atRisk = rows.filter(r => r.anyBurnoutRisk).length;

  return (
    <Section
      eyebrow="Cognitive Load"
      title="Roster workload overview"
      subtitle={`${atRisk} of ${rows.length} student${rows.length === 1 ? '' : 's'} have at least one week over the burnout-risk threshold in their recommended plan, sorted worst-first.`}
    >
      {rows.length === 0 ? (
        <Empty>No students on your roster yet.</Empty>
      ) : (
        <div className="su-table-wrap">
          <table className="su-table">
            <thead>
              <tr><th>Student</th><th>Peak week</th><th>Peak friction score</th><th>Trend</th><th>Status</th></tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.studentId} style={{ cursor: 'pointer' }} onClick={() => navigate(`/students/${r.studentId}`)}>
                  <td><b>{r.studentName}</b></td>
                  <td>Week {r.peakWeek}</td>
                  <td>{r.peakFrictionScore}</td>
                  <td>{TREND_LABEL[r.trend.reading]}</td>
                  <td>{r.anyBurnoutRisk ? <span className="su-badge danger">Burnout risk</span> : <span className="su-badge ok">Clear</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
