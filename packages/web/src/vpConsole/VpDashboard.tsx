// Vice President dashboard — per-advisor summary (roster size, average
// CGPA) plus a flat, cross-advisor pending-approvals queue the VP can act
// on directly, without opening the advisor console at all (confirmed with
// the user as the access model: per-advisor drill-down AND a flat queue,
// not a flat "all 125 students" browser). Also shows per-advisor transfer
// counters (internal vs. external, still in flight) — full review happens
// on the Transfer requests tab.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, AdvisorResponsibilityDetailDTO, VpAdvisorSummaryDTO, VpPendingProposalDTO, VpTransferCounterDTO } from '../api/client';
import { Loading, Section, StatCard } from '../portal/ui/Primitives';
import { letterClass } from '../portal/lib/studentUiHelpers';
import { downloadVpAdvisorsReportPdf } from '../lib/pdfReport';

export function VpDashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<VpAdvisorSummaryDTO[] | null>(null);
  const [pending, setPending] = useState<VpPendingProposalDTO[] | null>(null);
  const [transferCounters, setTransferCounters] = useState<VpTransferCounterDTO[] | null>(null);
  const [responsibilityDetails, setResponsibilityDetails] = useState<AdvisorResponsibilityDetailDTO[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);

  const load = () => {
    api.vpAdvisorsSummary().then(setSummary);
    api.vpPendingProposals().then(setPending);
    api.vpTransferCounters().then(setTransferCounters);
    api.vpResponsibilityDetails().then(setResponsibilityDetails);
  };
  useEffect(load, []);

  if (!summary || !pending || !transferCounters) return <Loading label="Loading the Vice President dashboard…" />;

  const countersFor = (advisorId: string) => transferCounters.find(c => c.advisorId === advisorId);
  const pendingCountFor = (advisorId: string) => pending.filter(p => p.advisorId === advisorId).length;

  const totalStudents = summary.reduce((sum, s) => sum + s.studentCount, 0);
  const overallAvgCgpa = summary.length > 0
    ? summary.reduce((sum, s) => sum + s.averageCgpa * s.studentCount, 0) / (totalStudents || 1)
    : 0;
  const advisorNameFor = (advisorId: string) => summary.find(s => s.advisor.id === advisorId)?.advisor.name ?? advisorId;
  const bulkApprovableCount = pending.filter(p => !p.overriddenByAdvisor).length;

  const approve = async (proposalId: string) => {
    setBusyId(proposalId);
    try {
      await api.approveProposal(proposalId);
      load();
    } finally {
      setBusyId(null);
    }
  };

  // "Approve all" — every advisor's whole pending queue in one click, so
  // the VP doesn't have to approve each student's course individually.
  // Server-side, this skips any slot an advisor has already overridden
  // with their own alternate (see approveAllPendingProposalsAcrossAllAdvisors) —
  // bulkApprovableCount below mirrors that exact same rule so the button's
  // own count is never a lie.
  const approveAll = async () => {
    setApprovingAll(true);
    try {
      setPending(await api.vpApproveAllPendingProposals());
    } finally {
      setApprovingAll(false);
    }
  };

  const downloadReport = async () => {
    setDownloading(true);
    try {
      await downloadVpAdvisorsReportPdf(summary, responsibilityDetails);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="su-fade">
      {/* No inline gridTemplateColumns override here anymore — it was
          hardcoding exactly 3 columns at every viewport width, which
          defeated .su-stat-grid's own responsive auto-fit rule and caused
          a real horizontal-overflow bug on mobile (found via an actual
          375px-viewport screenshot). Same class every other dashboard's
          stat-card row already uses unmodified. */}
      <div className="su-stat-grid">
        <StatCard label="ADVISORS" value={String(summary.length)} sub="Each with a 25-student roster" />
        <StatCard label="TOTAL STUDENTS" value={String(totalStudents)} sub="Across every advisor" />
        <StatCard label="OVERALL AVG CGPA" value={overallAvgCgpa.toFixed(2)} unit="/ 4.00" accent sub="Weighted across all advisors" />
      </div>

      <Section
        title="Advisors"
        eyebrow="Roster overview"
        right={
          <button className="su-btn su-btn-secondary su-btn-sm" disabled={downloading} onClick={downloadReport}>
            {downloading ? 'Building PDF…' : 'Generate Report (PDF)'}
          </button>
        }
      >
        <div className="su-table-wrap su-mt-16">
          <table className="su-table">
            <thead><tr><th>Advisor</th><th>Department</th><th>Students</th><th>Average CGPA</th><th>Registration status</th><th>Transfers in flight</th><th></th></tr></thead>
            <tbody>
              {summary.map(s => {
                const c = countersFor(s.advisor.id);
                const pendingCount = pendingCountFor(s.advisor.id);
                return (
                  <tr key={s.advisor.id}>
                    <td><b>{s.advisor.name}</b></td>
                    <td className="su-muted">{s.advisor.facultyId}/{s.advisor.departmentId}</td>
                    <td>{s.studentCount}</td>
                    <td style={{ color: `var(--su-${s.averageCgpa >= 3.0 ? 'good' : s.averageCgpa < 2.0 ? 'danger' : 'warn'})`, fontWeight: 700 }}>{s.averageCgpa.toFixed(2)}</td>
                    <td>
                      {pendingCount === 0
                        ? <span className="su-badge ok">All registered</span>
                        : <span className="su-badge warn">{pendingCount} pending</span>}
                    </td>
                    <td className="su-muted">
                      {c && (c.internalInFlight + c.externalInFlight) > 0
                        ? `${c.internalInFlight} internal, ${c.externalInFlight} external`
                        : '—'}
                    </td>
                    <td>
                      <button className="su-btn su-btn-sm su-btn-secondary" onClick={() => navigate(`/vp/advisors/${s.advisor.id}`)}>
                        View roster
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="Pending approvals"
        eyebrow={`${pending.length} across every advisor`}
        right={
          bulkApprovableCount > 0 ? (
            <button className="su-btn su-btn-sm su-btn-secondary" disabled={approvingAll} onClick={approveAll}>
              {approvingAll ? 'Approving…' : `Approve all (${bulkApprovableCount})`}
            </button>
          ) : undefined
        }
      >
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
                      {p.overriddenByAdvisor ? (
                        <span className="su-badge neutral" title="This slot's advisor already proposed their own alternate — approve or decline it from the advisor console instead.">
                          Advisor proposed alternate
                        </span>
                      ) : (
                        <button className="su-btn su-btn-sm" disabled={busyId === p.proposalId} onClick={() => approve(p.proposalId)}>
                          Approve
                        </button>
                      )}
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
