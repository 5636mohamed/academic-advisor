// Vice President's per-advisor drill-down — reached from the dashboard's
// "View roster" button. The VP never gets a flat "all 125 students"
// browser (confirmed access model); this is how an individual student is
// still reachable, one advisor at a time.
//
// NOTE: a later phase adds a "this advisor took responsibility for a
// below-system-grade proposal" highlight here (AdvisorReportRow gains a
// flag once that workflow exists) — deliberately not referenced yet so
// this phase doesn't forward-reference a field that doesn't exist.
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, AdvisorDTO, StudentSummary } from '../api/client';
import { Loading, Section } from '../portal/ui/Primitives';
import { RISK_TONE, riskLevelFor } from '../advisorConsole/lib/riskLevel';

export function VpAdvisorDetail() {
  const { advisorId } = useParams<{ advisorId: string }>();
  const navigate = useNavigate();
  const [advisor, setAdvisor] = useState<AdvisorDTO | null>(null);
  const [students, setStudents] = useState<StudentSummary[] | null>(null);

  useEffect(() => {
    if (!advisorId) return;
    api.advisor(advisorId).then(setAdvisor);
    api.listStudents(advisorId).then(setStudents);
  }, [advisorId]);

  if (!advisorId) return null;
  if (!advisor || !students) return <Loading label="Loading advisor roster…" />;

  return (
    <div className="su-fade">
      <button className="su-btn su-btn-ghost su-btn-sm" onClick={() => navigate('/vp')} style={{ marginBottom: 12 }}>
        ← All advisors
      </button>

      <Section title={advisor.name} eyebrow={`${advisor.facultyId}/${advisor.departmentId} · ${students.length} students`}>
        <div className="su-table-wrap su-mt-16">
          <table className="su-table">
            <thead><tr><th>Student</th><th>ID</th><th>CGPA</th><th>Risk</th><th>Probation</th></tr></thead>
            <tbody>
              {students.map(s => {
                const risk = riskLevelFor(s.cgpa, s.probationCounter.count);
                return (
                  <tr key={s.id}>
                    <td><b>{s.name}</b></td>
                    <td className="su-muted">{s.id}</td>
                    <td>{s.cgpa.toFixed(2)}</td>
                    <td><span className={`su-badge ${RISK_TONE[risk]}`}>{risk}</span></td>
                    <td className="su-muted">{s.probationCounter.count} / 6</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
