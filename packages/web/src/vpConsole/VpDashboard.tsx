// Vice President dashboard — per-advisor summary (roster size, average
// CGPA) plus a flat, cross-advisor pending-approvals queue the VP can act
// on directly, without opening the advisor console at all (confirmed with
// the user as the access model: per-advisor drill-down AND a flat queue,
// not a flat "all 125 students" browser). Transfer-request counters are
// wired in a later phase once that pending-chain exists.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, VpAdvisorSummaryDTO, VpPendingProposalDTO } from '../api/client';
import { Loading, Section, StatCard } from '../portal/ui/Primitives';
import { letterClass } from '../portal/lib/studentUiHelpers';

export function VpDashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<VpAdvisorSummaryDTO[] | null>(null);
  const [pending, setPending] = useState<VpPendingProposalDTO[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    api.vpAdvisorsSummary().then(setSummary);
    api.vpPendingProposals().then(setPending);
  };
  useEffect(load, []);

  if (!summary || !pending) return <Loading label="Loading the Vice President dashboard…" />;

  const totalStudents = summary.reduce((sum, s) => sum + s.studentCount, 0);
  const overallAvgCgpa = summary.length > 0
    ? summary.reduce((sum, s) => sum + s.averageCgpa * s.studentCount, 0) / (totalStudents || 1)
    : 0;
  const advisorNameFor = (advisorId: string) => summary.find(s => s.advisor.id === advisorId)?.advisor.name ?? advisorId;

  const approve = async (proposalId: string) => {
    setBusyId(proposalId);
    try {
      await api.approveProposal(proposalId);
      load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="su-fade">
      <div className="su-stat-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(160px,1fr))' }}>
        <StatCard label="ADVISORS" value={String(summary.length)} sub="Each with a 25-student roster" />
        <StatCard label="TOTAL STUDENTS" value={String(totalStudents)} sub="Across every advisor" />
        <StatCard label="OVERALL AVG CGPA" value={overallAvgCgpa.toFixed(2)} unit="/ 4.00" accent sub="Weighted across all advisors" />
      </div>

      <Section title="Advisors" eyebrow="Roster overview">
        <div className="su-table-wrap su-mt-16">
          <table className="su-table">
            <thead><tr><th>Advisor</th><th>Department</th><th>Students</th><th>Average CGPA</th><th></th></tr></thead>
            <tbody>
              {summary.map(s => (
                <tr key={s.advisor.id}>
                  <td><b>{s.advisor.name}</b></td>
                  <td className="su-muted">{s.advisor.facultyId}/{s.advisor.departmentId}</td>
                  <td>{s.studentCount}</td>
                  <td style={{ color: `var(--su-${s.averageCgpa >= 3.0 ? 'good' : s.averageCgpa < 2.0 ? 'danger' : 'warn'})`, fontWeight: 700 }}>{s.averageCgpa.toFixed(2)}</td>
                  <td>
                    <button className="su-btn su-btn-sm su-btn-secondary" onClick={() => navigate(`/vp/advisors/${s.advisor.id}`)}>
                      View roster
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Pending approvals" eyebrow={`${pending.length} across every advisor`}>
        <div className="su-subtitle" style={{ marginBottom: 12 }}>
          Every student's still-pending system recommendation, across all 5 advisors — approve directly here even if
          the student's own advisor hasn't reviewed it yet.
        </div>
        {pending.length === 0 ? (
          <div className="su-empty">Nothing pending — every student's plan has an advisor-reviewed decision.</div>
        ) : (
          <div className="su-table-wrap">
            <table className="su-table">
              <thead><tr><th>Student</th><th>Advisor</th><th>Slot</th><th>Recommended</th><th>Expected</th><th></th></tr></thead>
              <tbody>
                {pending.map(p => (
                  <tr key={p.proposalId}>
                    <td><b>{p.studentName}</b></td>
                    <td className="su-muted">{advisorNameFor(p.advisorId)}</td>
                    <td className="su-muted">{p.slotKey}</td>
                    <td><b>{p.courseCode}</b></td>
                    <td className={letterClass(p.expectedLetter)}>{p.expectedLetter} ({p.expectedPct.toFixed(1)}%)</td>
                    <td>
                      <button className="su-btn su-btn-sm" disabled={busyId === p.proposalId} onClick={() => approve(p.proposalId)}>
                        Approve
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
