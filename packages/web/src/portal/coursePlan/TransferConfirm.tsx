// Re-themed version of pages/AdviseFlow/TransferConfirmStep.tsx for the
// student portal — same two real endpoints (internal remap vs. external
// Transfer-Semester dry-run then commit), same warning-counter behavior
// (§7.1 retained / §7.2.3 reset to 0/6), just su-* chrome instead of the
// advisor console's editorial theme.
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

function InternalConfirm({ studentId, toDepartmentId, onDone, onCancel }: { studentId: string; toDepartmentId: string; onDone: () => void; onCancel: () => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await api.transferInternal(studentId, toDepartmentId));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="su-card su-pop">
        <div className="su-title">Internal transfer complete</div>
        <div className="su-subtitle">
          Now in department <b>{result.departmentId}</b>. Credits carried over 1:1; your warning counter is unchanged.
        </div>
        {result.excessCreditCourseCodes.length > 0 && (
          <div className="su-note su-mt-16">
            These passed courses don't map to a requirement slot in the new department (still count toward your 160-credit total): {result.excessCreditCourseCodes.join(', ')}
          </div>
        )}
        <button className="su-btn su-mt-16" onClick={onDone}>Continue</button>
      </div>
    );
  }

  return (
    <div className="su-card su-pop">
      <div className="su-title">Confirm internal transfer</div>
      <div className="su-subtitle">
        Moving to department <b>{toDepartmentId}</b> within your current faculty. Your transcript isn't reset — shared
        and matching courses remap automatically; anything with no equivalent becomes "excess credit" (still counted
        toward graduation).
      </div>
      {error && <div className="su-note danger su-mt-16">{error}</div>}
      <div className="su-flex su-gap-10 su-mt-16">
        <button className="su-btn su-btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="su-btn" disabled={busy} onClick={confirm}>Confirm transfer</button>
      </div>
    </div>
  );
}

function ExternalConfirm({ studentId, toFacultyId, onDone, onCancel }: { studentId: string; toFacultyId: string; onDone: () => void; onCancel: () => void }) {
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof api.transferPreview>> | null>(null);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [toDepartmentId, setToDepartmentId] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
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
      setResult(await api.transferExternal(studentId, toFacultyId, toDepartmentId));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="su-card su-pop">
        <div className="su-title">Faculty transfer complete</div>
        <div className="su-subtitle">
          Now in <b>{result.facultyId}</b> / <b>{result.departmentId}</b>, Level {result.level}. New base CGPA:{' '}
          <b>{result.activeBaseSnapshot.cgpa.toFixed(2)}</b>. Warning counter reset to 0/6.
        </div>
        <button className="su-btn su-mt-16" onClick={onDone}>Continue</button>
      </div>
    );
  }

  if (!preview) return <Loading label="Building Transfer Semester preview…" />;

  return (
    <div className="su-card su-pop">
      <div className="su-title">Transfer Semester preview</div>
      <div className="su-subtitle">
        Dry run — nothing is saved until you confirm. Only your passed general-university and basic-science courses
        are considered; each needs a registrar equivalency mapping to actually transfer.
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
        Confirming sets this as your new base CGPA (older faculty history stays in your transcript but stops counting) and <b>resets your warning counter to 0/6</b>.
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
        <button className="su-btn" disabled={busy || !toDepartmentId} onClick={confirm}>Confirm faculty transfer</button>
      </div>
    </div>
  );
}
