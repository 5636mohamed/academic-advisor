// VP epic — the advisor's "requests" window: every transfer request (internal
// or faculty) their students have submitted. Pending ones get Approve/Decline;
// approving sends it on to the Vice President for final sign-off (it does NOT
// execute the transfer itself), declining ends the chain right here.
import { useEffect, useState } from 'react';
import { api, TransferRequestDTO } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Empty, Loading, Section } from '../portal/ui/Primitives';

const STATUS_BADGE: Record<TransferRequestDTO['status'], { label: string; tone: 'ok' | 'warn' | 'danger' | 'neutral' }> = {
  pending_advisor: { label: 'Awaiting your review', tone: 'warn' },
  pending_vp: { label: 'Sent to Vice President', tone: 'neutral' },
  advisor_declined: { label: 'You declined', tone: 'danger' },
  vp_declined: { label: 'VP declined', tone: 'danger' },
  approved: { label: 'Approved & executed', tone: 'ok' },
};

export function AdvisorTransferRequests() {
  const { auth } = useAuth();
  const advisorId = auth?.role === 'advisor' ? auth.advisorId : undefined;
  const [requests, setRequests] = useState<TransferRequestDTO[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (advisorId) api.advisorTransferRequests(advisorId).then(setRequests);
  };
  useEffect(load, [advisorId]);

  if (!requests) return <Loading label="Loading transfer requests…" />;

  const pending = requests.filter(r => r.status === 'pending_advisor');
  const history = requests.filter(r => r.status !== 'pending_advisor').sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const approve = async (id: string) => {
    setBusyId(id);
    setError(null);
    try { await api.advisorApproveTransferRequest(id); load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusyId(null); }
  };
  const decline = async (id: string) => {
    setBusyId(id);
    setError(null);
    try { await api.advisorDeclineTransferRequest(id); load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusyId(null); }
  };

  return (
    <div className="su-fade">
      <div className="su-title" style={{ fontSize: 22, marginBottom: 4 }}>Transfer Requests</div>
      <div className="su-subtitle" style={{ marginBottom: 18 }}>
        Your students' internal (department) and faculty transfer requests. Approving sends a request on to the Vice
        President for final sign-off — it doesn't move the student yet.
      </div>
      {error && <div className="su-note danger su-mt-16">{error}</div>}

      <Section title="Awaiting your review" eyebrow={`${pending.length} pending`}>
        {pending.length === 0 ? (
          <Empty>Nothing pending — every request has moved past your review.</Empty>
        ) : (
          <div className="su-table-wrap su-mt-16">
            <table className="su-table">
              <thead><tr><th>Student</th><th>Type</th><th>Target</th><th>Requested</th><th></th></tr></thead>
              <tbody>
                {pending.map(r => (
                  <tr key={r.id}>
                    <td><b>{r.studentName}</b></td>
                    <td className="su-muted">{r.type === 'internal_department' ? 'Internal (department)' : 'Faculty transfer'}</td>
                    <td>{r.type === 'internal_department' ? r.toDepartmentId : `${r.toFacultyId} / ${r.toDepartmentId}`}</td>
                    <td className="su-muted">{new Date(r.createdAt).toLocaleDateString()}</td>
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

      <Section title="History" eyebrow={`${history.length} decided`}>
        {history.length === 0 ? (
          <Empty>No decided requests yet.</Empty>
        ) : (
          <div className="su-table-wrap su-mt-16">
            <table className="su-table">
              <thead><tr><th>Student</th><th>Type</th><th>Target</th><th>Status</th></tr></thead>
              <tbody>
                {history.map(r => (
                  <tr key={r.id}>
                    <td><b>{r.studentName}</b></td>
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
