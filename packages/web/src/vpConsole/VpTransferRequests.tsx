// VP epic — the final stage of the transfer pending chain. Shows every
// request that's reached VP review (pending_vp queue up top, full
// cross-advisor history below); approving here is the only action that
// actually executes the transfer (db.vpDecideTransferRequest calls the
// existing execute*ForStudent functions).
import { useEffect, useState } from 'react';
import { api, TransferRequestDTO, VpAdvisorSummaryDTO } from '../api/client';
import { Empty, Loading, Section } from '../portal/ui/Primitives';

const STATUS_BADGE: Record<TransferRequestDTO['status'], { label: string; tone: 'ok' | 'warn' | 'danger' | 'neutral' }> = {
  pending_advisor: { label: 'Awaiting advisor', tone: 'neutral' },
  pending_vp: { label: 'Awaiting your review', tone: 'warn' },
  advisor_declined: { label: 'Advisor declined', tone: 'danger' },
  vp_declined: { label: 'You declined', tone: 'danger' },
  approved: { label: 'Approved & executed', tone: 'ok' },
};

export function VpTransferRequests() {
  const [requests, setRequests] = useState<TransferRequestDTO[] | null>(null);
  const [advisors, setAdvisors] = useState<VpAdvisorSummaryDTO[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api.vpTransferRequests().then(setRequests);
    api.vpAdvisorsSummary().then(setAdvisors);
  };
  useEffect(load, []);

  if (!requests || !advisors) return <Loading label="Loading transfer requests…" />;

  const advisorNameFor = (advisorId: string) => advisors.find(a => a.advisor.id === advisorId)?.advisor.name ?? advisorId;
  const pending = requests.filter(r => r.status === 'pending_vp');
  const history = requests.filter(r => r.status !== 'pending_vp').sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const approve = async (id: string) => {
    setBusyId(id);
    setError(null);
    try { await api.vpApproveTransferRequest(id); load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusyId(null); }
  };
  const decline = async (id: string) => {
    setBusyId(id);
    setError(null);
    try { await api.vpDeclineTransferRequest(id); load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusyId(null); }
  };

  return (
    <div className="su-fade">
      <div className="su-title" style={{ fontSize: 22, marginBottom: 4 }}>Transfer Requests</div>
      <div className="su-subtitle" style={{ marginBottom: 18 }}>
        Every transfer request across all 5 advisors, from submission through final decision. Only advisor-approved
        requests need your action — approving is what actually executes the transfer, visible to both the student
        and their advisor.
      </div>
      {error && <div className="su-note danger su-mt-16">{error}</div>}

      <Section title="Awaiting your review" eyebrow={`${pending.length} pending`}>
        {pending.length === 0 ? (
          <Empty>Nothing pending — every advisor-approved request has a final decision.</Empty>
        ) : (
          <div className="su-table-wrap su-mt-16">
            <table className="su-table">
              <thead><tr><th>Student</th><th>Advisor</th><th>Type</th><th>Target</th><th></th></tr></thead>
              <tbody>
                {pending.map(r => (
                  <tr key={r.id}>
                    <td><b>{r.studentName}</b></td>
                    <td className="su-muted">{advisorNameFor(r.advisorId)}</td>
                    <td className="su-muted">{r.type === 'internal_department' ? 'Internal (department)' : 'Faculty transfer'}</td>
                    <td>{r.type === 'internal_department' ? r.toDepartmentId : `${r.toFacultyId} / ${r.toDepartmentId}`}</td>
                    <td>
                      <div className="su-flex su-gap-8">
                        <button className="su-btn su-btn-sm" disabled={busyId === r.id} onClick={() => approve(r.id)}>Approve</button>
                        <button className="su-btn su-btn-sm su-btn-ghost" disabled={busyId === r.id} onClick={() => decline(r.id)}>Decline</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="History" eyebrow={`${history.length} requests`}>
        {history.length === 0 ? (
          <Empty>No other requests yet.</Empty>
        ) : (
          <div className="su-table-wrap su-mt-16">
            <table className="su-table">
              <thead><tr><th>Student</th><th>Advisor</th><th>Type</th><th>Target</th><th>Status</th></tr></thead>
              <tbody>
                {history.map(r => (
                  <tr key={r.id}>
                    <td><b>{r.studentName}</b></td>
                    <td className="su-muted">{advisorNameFor(r.advisorId)}</td>
                    <td className="su-muted">{r.type === 'internal_department' ? 'Internal (department)' : 'Faculty transfer'}</td>
                    <td>{r.type === 'internal_department' ? r.toDepartmentId : `${r.toFacultyId} / ${r.toDepartmentId}`}</td>
                    <td><span className={`su-badge ${STATUS_BADGE[r.status].tone}`}>{STATUS_BADGE[r.status].label}</span></td>
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
