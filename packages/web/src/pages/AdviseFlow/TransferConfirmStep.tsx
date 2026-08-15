// Spec §10 step 6 — internal: simple confirm + remapped requirement-slot
// preview. External: Transfer Semester preview (which courses transfer,
// which don't and why, resulting GPA/new base CGPA) before commit, with an
// explicit note that the warning counter will reset.
import { useEffect, useState } from 'react';
import { api } from '../../api/client';

export function TransferConfirmStep({
  studentId,
  kind,
  targetId, // toDepartmentId for internal, toFacultyId for external
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

function InternalConfirm({
  studentId,
  toDepartmentId,
  onDone,
  onCancel,
}: {
  studentId: string;
  toDepartmentId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.transferInternal(studentId, toDepartmentId);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="card">
        <h2>Internal transfer complete</h2>
        <p className="sub">Now in department <b>{result.departmentId}</b>. Credits carried over 1:1; the warning counter is unchanged (spec §7.1).</p>
        {result.excessCreditCourseCodes.length > 0 && (
          <div className="note">
            These passed courses don't map to a requirement slot in the new department (still count toward your 160-credit total): {result.excessCreditCourseCodes.join(', ')}
          </div>
        )}
        <button onClick={onDone} style={{ marginTop: 12 }}>Continue</button>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Confirm internal transfer</h2>
      <p className="sub">
        Moving to department <b>{toDepartmentId}</b> within your current faculty. Your transcript is not reset — shared and matching courses remap automatically; courses with no equivalent become "excess credit" (still counted toward graduation).
      </p>
      {error && <div className="note" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="secondary" onClick={onCancel}>Cancel</button>
        <button disabled={busy} onClick={confirm}>Confirm transfer</button>
      </div>
    </div>
  );
}

function ExternalConfirm({
  studentId,
  toFacultyId,
  onDone,
  onCancel,
}: {
  studentId: string;
  toFacultyId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
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
      const r = await api.transferExternal(studentId, toFacultyId, toDepartmentId);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="card">
        <h2>Faculty transfer complete</h2>
        <p className="sub">
          Now in <b>{result.facultyId}</b> / <b>{result.departmentId}</b>, Level {result.level}. New base CGPA:{' '}
          <b>{result.activeBaseSnapshot.cgpa.toFixed(2)}</b>. Warning counter reset to 0/6 (spec §7.2.3).
        </p>
        <button onClick={onDone}>Continue</button>
      </div>
    );
  }

  if (!preview) return <div className="loading">Building Transfer Semester preview…</div>;

  return (
    <div className="card">
      <h2>Transfer Semester preview</h2>
      <p className="sub">
        This is a dry run — nothing is saved until you confirm. Only your passed UR/LRA and basic-science courses are considered; each needs a registrar equivalency mapping to the new faculty to actually transfer.
      </p>
      <table>
        <thead>
          <tr>
            <th>Course</th>
            <th>Maps to</th>
            <th>Grade</th>
            <th>Credits</th>
          </tr>
        </thead>
        <tbody>
          {preview.transferredCourses.map(c => (
            <tr key={c.courseCode}>
              <td>{c.courseCode}</td>
              <td>{c.mappedToCourseCode ?? <span className="muted">waived / free elective</span>}</td>
              <td>{c.letter}</td>
              <td>{c.credits}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {preview.excludedCourses.length > 0 && (
        <p className="muted">
          Does not transfer (no equivalency): {preview.excludedCourses.map(c => c.courseCode).join(', ')}
        </p>
      )}
      <div className="stat-row" style={{ marginTop: 10 }}>
        <div className="stat">
          <div className="label">New base CGPA</div>
          <div className="value">{preview.gpa.toFixed(2)}</div>
        </div>
        <div className="stat">
          <div className="label">Transferred credits</div>
          <div className="value">{preview.totalCredits}</div>
        </div>
      </div>
      <div className="note">
        Confirming will set this GPA as your new base CGPA (older faculty history stays in your transcript but stops counting), and{' '}
        <b>reset your warning counter to 0/6</b>.
      </div>
      <div className="form-row">
        <label>Department in {toFacultyId}:</label>
        <select value={toDepartmentId} onChange={e => setToDepartmentId(e.target.value)}>
          {departments.map(d => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      {error && <div className="note" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="secondary" onClick={onCancel}>Cancel</button>
        <button disabled={busy || !toDepartmentId} onClick={confirm}>Confirm faculty transfer</button>
      </div>
    </div>
  );
}
