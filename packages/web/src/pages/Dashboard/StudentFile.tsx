// Spec §10 step 1 — the student-file dashboard: transcript, CGPA trend,
// probation pill, base-snapshot indicator, and a quick grade-entry form (the
// "save/modify data" surface carried over from the session-4 demo).
import { useEffect, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { api, StudentDetail } from '../../api/client';
import { StudentNavTabs } from '../../components/StudentNavTabs';
import { ProbationCounterPill } from '../../components/ProbationCounterPill';
import { CgpaTrendChart } from '../../components/CgpaTrendChart';

const letterClass = (letter: string) => `letter-${letter.replace('+', 'p')}`;

export function StudentFile() {
  const { id } = useParams<{ id: string }>();
  const { reloadStudents } = useOutletContext<{ reloadStudents: () => void }>();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ courseCode: '', pct: '', semesterOrdinal: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    if (!id) return;
    api.getStudent(id).then(setStudent).catch(e => setError(e instanceof Error ? e.message : String(e)));
  };

  useEffect(load, [id]);

  if (!id) return null;
  if (error) return <div className="empty-state">{error}</div>;
  if (!student) return <div className="loading">Loading…</div>;

  const submitGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.courseCode || !form.pct || !form.semesterOrdinal) return;
    setSaving(true);
    try {
      await api.enroll(id, form.courseCode.toUpperCase(), Number(form.pct), Number(form.semesterOrdinal));
      setForm({ courseCode: '', pct: '', semesterOrdinal: '' });
      load();
      reloadStudents();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <StudentNavTabs id={id} />
      <div className="card">
        <h1>{student.name}</h1>
        <p className="sub">
          Level {student.level} · {student.facultyId}/{student.departmentId} ·{' '}
          <span className={`badge ${student.status === 'dismissed' ? 'danger' : 'ok'}`}>{student.status}</span>
        </p>
        <div className="stat-row">
          <div className="stat">
            <div className="label">CGPA</div>
            <div className="value">{student.cgpa.toFixed(2)}</div>
          </div>
          <div className="stat">
            <div className="label">Warning counter</div>
            <div className="value" style={{ fontSize: 16, marginTop: 4 }}>
              <ProbationCounterPill count={student.probationCounter.count} />
            </div>
          </div>
        </div>
        {student.activeBaseSnapshotId && (
          <div className="note">CGPA calculated since: Transfer Semester ({student.activeBaseSnapshotId}) — earlier faculty history is retained in the transcript but no longer counted.</div>
        )}
        {student.status === 'dismissed' && (
          <div className="note" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
            This student has been dismissed (warning counter reached 6/6). Advising, transfers, and registration are locked at the API layer. Contact the registrar for the appeal process.
          </div>
        )}
      </div>

      <div className="card">
        <h2>CGPA Trend</h2>
        <CgpaTrendChart snapshots={student.cgpaSnapshots} trendSlope={null} />
      </div>

      <div className="card">
        <h2>Transcript</h2>
        <table>
          <thead>
            <tr>
              <th>Sem.</th>
              <th>Course</th>
              <th>Grade</th>
              <th>%</th>
              <th>Points</th>
              <th>Retake?</th>
            </tr>
          </thead>
          <tbody>
            {student.transcript.map(r => (
              <tr key={`${r.courseCode}-${r.attemptNumber ?? 'registered'}`} className={r.status === 'registered' ? 'muted' : ''}>
                <td>{r.semesterOrdinal}</td>
                <td>{r.courseCode}</td>
                {r.status === 'registered' ? (
                  <td colSpan={3}><span className="badge neutral">registered — pending grade</span></td>
                ) : (
                  <>
                    <td className={letterClass(r.letter!)}>{r.letter}</td>
                    <td>{r.pct}</td>
                    <td>{r.points!.toFixed(2)}</td>
                  </>
                )}
                <td>{r.isRetake ? 'yes' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {student.status !== 'dismissed' && (
          <form onSubmit={submitGrade} className="form-row" style={{ marginTop: 14 }}>
            <input placeholder="Course code" value={form.courseCode} onChange={e => setForm({ ...form, courseCode: e.target.value })} style={{ width: 110 }} />
            <input placeholder="Score %" type="number" value={form.pct} onChange={e => setForm({ ...form, pct: e.target.value })} style={{ width: 90 }} />
            <input placeholder="Semester #" type="number" value={form.semesterOrdinal} onChange={e => setForm({ ...form, semesterOrdinal: e.target.value })} style={{ width: 100 }} />
            <button disabled={saving} type="submit">Record grade</button>
          </form>
        )}
      </div>

      {student.transferRecords.length > 0 && (
        <div className="card">
          <h2>Transfer History</h2>
          {student.transferRecords.map((t, i) => (
            <div key={i} className="timeline-item" style={{ marginLeft: 8 }}>
              <b>{t.type === 'internal_department' ? 'Internal transfer' : 'Faculty transfer'}</b>{' '}
              {t.type === 'internal_department'
                ? `${t.fromDepartmentId} → ${t.toDepartmentId}`
                : `${t.fromFacultyId} → ${t.toFacultyId} / ${t.toDepartmentId}`}
              <div className="muted">Counter: {t.counterAction}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
