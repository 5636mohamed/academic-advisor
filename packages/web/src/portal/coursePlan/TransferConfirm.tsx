// Re-themed version of pages/AdviseFlow/TransferConfirmStep.tsx for the
// student portal. VP epic — "Confirm transfer" no longer executes
// immediately: it creates a pending request that has to clear the
// student's advisor and then the Vice President before anything actually
// changes on the student's record (§ "student clicks transfer -> pending
// for the advisor -> advisor accepts -> sent to the VP -> VP accepts ->
// executes"). The external path's dry-run preview is unchanged and still
// pure — nothing is saved until the request is actually created, and even
// then nothing executes until the VP signs off.
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Loading } from '../ui/Primitives';

export function TransferConfirm({
  studentId,
  kind,
  targetId,
  onDone,
  onCancel,
}: {
  studentId: string;
  kind: 'internal' | 'external';
  targetId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  if (kind === 'internal') return <InternalConfirm studentId={studentId} toDepartmentId={targetId} onDone={onDone} onCancel={onCancel} />;
  return <ExternalConfirm studentId={studentId} toFacultyId={targetId} onDone={onDone} onCancel={onCancel} />;
}

function PendingResult({ toLabel, onDone }: { toLabel: string; onDone: () => void }) {
  return (
    <div className="su-card su-pop">
      <div className="su-title">Transfer request submitted</div>
      <div className="su-subtitle">
        Your request to transfer to <b>{toLabel}</b> is now <b>pending your advisor's review</b>. Nothing on your
        record changes yet — if your advisor approves, it's sent to the Vice President for final sign-off, and only
        then does the transfer actually take effect. You can track its status from your Dashboard.
      </div>
      <div className="su-note warn su-mt-16">This request needs both your advisor's and the Vice President's approval before it executes.</div>
      <button className="su-btn su-mt-16" onClick={onDone}>Continue</button>
    </div>
  );
}

function InternalConfirm({ studentId, toDepartmentId, onDone, onCancel }: { studentId: string; toDepartmentId: string; onDone: () => void; onCancel: () => void }) {
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.createTransferRequest(studentId, 'internal_department', toDepartmentId);
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (submitted) return <PendingResult toLabel={`department ${toDepartmentId}`} onDone={onDone} />;

  return (
    <div className="su-card su-pop">
      <div className="su-title">Confirm internal transfer</div>
      <div className="su-subtitle">
        Requesting a move to department <b>{toDepartmentId}</b> within your current faculty. Your transcript isn't
        reset — shared and matching courses remap automatically; anything with no equivalent becomes "excess credit"
        (still counted toward graduation). This only takes effect once your advisor and then the Vice President both
        approve it.
      </div>
      {error && <div className="su-note danger su-mt-16">{error}</div>}
      <div className="su-flex su-gap-10 su-mt-16">
        <button className="su-btn su-btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="su-btn" disabled={busy} onClick={confirm}>Request transfer</button>
      </div>
    </div>
  );
}

function ExternalConfirm({ studentId, toFacultyId, onDone, onCancel }: { studentId: string; toFacultyId: string; onDone: () => void; onCancel: () => void }) {
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof api.transferPreview>> | null>(null);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [toDepartmentId, setToDepartmentId] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.transferPreview(studentId, toFacultyId).then(setPreview);
    api.facultyDepartments(toFacultyId).then(depts => {
      setDepartments(depts);
      if (depts[0]) setToDepartmentId(depts[0].id);
    });
  }, [studentId, toFacultyId]);

  const confirm = async () => {
    if (!toDepartmentId) return;
    setBusy(true);
    setError(null);
    try {
      await api.createTransferRequest(studentId, 'external_faculty', toDepartmentId, toFacultyId);
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (submitted) return <PendingResult toLabel={`${toFacultyId} / ${toDepartmentId}`} onDone={onDone} />;

  if (!preview) return <Loading label="Building Transfer Semester preview…" />;

  return (
    <div className="su-card su-pop">
      <div className="su-title">Transfer Semester preview</div>
      <div className="su-subtitle">
        Dry run — nothing is saved until you submit, and even then nothing executes until your advisor and the Vice
        President both approve. Only your passed general-university and basic-science courses are considered; each
        needs a registrar equivalency mapping to actually transfer.
      </div>
      <div className="su-table-wrap su-mt-16">
        <table className="su-table">
          <thead><tr><th>Course</th><th>Maps to</th><th>Grade</th><th>Credits</th></tr></thead>
          <tbody>
            {preview.transferredCourses.map(c => (
              <tr key={c.courseCode}>
                <td>{c.courseCode}</td>
                <td>{c.mappedToCourseCode ?? <span className="su-muted">waived / free elective</span>}</td>
                <td>{c.letter}</td>
                <td>{c.credits}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {preview.excludedCourses.length > 0 && (
        <div className="su-subtitle su-mt-16">Does not transfer (no equivalency): {preview.excludedCourses.map(c => c.courseCode).join(', ')}</div>
      )}
      <div className="su-stat-grid su-mt-16" style={{ gridTemplateColumns: 'repeat(2, minmax(140px,1fr))' }}>
        <div className="su-stat-card"><div className="su-stat-label">New base CGPA</div><div className="su-stat-value">{preview.gpa.toFixed(2)}</div></div>
        <div className="su-stat-card"><div className="su-stat-label">Transferred credits</div><div className="su-stat-value">{preview.totalCredits}</div></div>
      </div>
      <div className="su-note warn su-mt-16">
        If approved by both your advisor and the Vice President, this becomes your new base CGPA (older faculty
        history stays in your transcript but stops counting) and <b>resets your warning counter to 0/6</b>.
      </div>
      <div className="su-field su-mt-16" style={{ maxWidth: 280 }}>
        <label>Department in {toFacultyId}</label>
        <select className="su-input" value={toDepartmentId} onChange={e => setToDepartmentId(e.target.value)}>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      {error && <div className="su-note danger su-mt-16">{error}</div>}
      <div className="su-flex su-gap-10 su-mt-16">
        <button className="su-btn su-btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="su-btn" disabled={busy || !toDepartmentId} onClick={confirm}>Request faculty transfer</button>
      </div>
    </div>
  );
}
