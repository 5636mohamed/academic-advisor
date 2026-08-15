// Per-semester curriculum browser — every subject in the program catalog
// (seedCatalog.ts's CATALOG), grouped by the semester it's normally offered
// and accessible one semester at a time via its own sub-tab, each row
// annotated with THIS student's status on it (passed / needs a retake /
// registered-and-pending / eligible now / not yet reachable). Shared by both
// the advisor's Curriculum page and the student portal's PortalCurriculum
// page via `hidePct` (§15.1's letters-only rule), same pattern as
// TargetCgpaPlanContent/QuizContent.
import { useEffect, useState } from 'react';
import { api, CurriculumCourseDTO, CurriculumCourseStatus } from '../../api/client';

const STATUS_META: Record<CurriculumCourseStatus, { label: string; badge: string }> = {
  passed: { label: 'Passed', badge: 'ok' },
  needs_retake: { label: 'Retake needed', badge: 'danger' },
  registered: { label: 'Registered — pending grade', badge: 'neutral' },
  eligible: { label: 'Eligible now', badge: 'warn' },
  locked: { label: 'Not yet reachable', badge: 'locked' },
};

const letterClass = (letter: string) => `letter-${letter.replace('+', 'p')}`;

export function CurriculumContent({ studentId, hidePct = false }: { studentId: string; hidePct?: boolean }) {
  const [rows, setRows] = useState<CurriculumCourseDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [semester, setSemester] = useState<number | null>(null);

  useEffect(() => {
    setRows(null);
    api.getCurriculum(studentId)
      .then(data => {
        setRows(data);
        // Default to the first semester with something still "live" in it
        // (a pending registration, a needed retake, or a freshly-eligible
        // course) so the tab opens where the student's actual next move is,
        // not always semester 1. Falls back to semester 1 if the whole
        // catalog is either fully passed or not yet reachable.
        const active = data.find(r => r.status === 'registered' || r.status === 'needs_retake' || r.status === 'eligible');
        setSemester(active ? active.course.semesterOrdinal : (data[0]?.course.semesterOrdinal ?? 1));
      })
      .catch(e => setError(e instanceof Error ? e.message : String(e)));
  }, [studentId]);

  if (error) return <div className="empty-state">{error}</div>;
  if (!rows || semester === null) return <div className="loading">Loading…</div>;

  const semesters = [...new Set(rows.map(r => r.course.semesterOrdinal))].sort((a, b) => a - b);
  const visible = rows
    .filter(r => r.course.semesterOrdinal === semester)
    .sort((a, b) => a.course.code.localeCompare(b.course.code));

  return (
    <div>
      <div className="card">
        <h2>Curriculum by Semester</h2>
        <p className="sub">Every subject in the program catalog, grouped by the semester it's normally offered — with your status on each.</p>
        <div className="sub-tabs">
          {semesters.map(s => (
            <button
              key={s}
              type="button"
              className={`tab-btn${s === semester ? ' active' : ''}`}
              onClick={() => setSemester(s)}
            >
              Semester {s}
            </button>
          ))}
        </div>

        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Subject</th>
              <th>Credits</th>
              <th>Category</th>
              <th>Prereqs</th>
              <th>Status</th>
              {!hidePct && <th>Grade</th>}
            </tr>
          </thead>
          <tbody>
            {visible.map(r => (
              <tr key={r.course.code}>
                <td><b>{r.course.code}</b></td>
                <td>{r.course.name}</td>
                <td>{r.course.credits}</td>
                <td className="muted">{r.course.category.replace(/_/g, ' ')}</td>
                <td className="muted">{r.course.prereq.length ? r.course.prereq.join(', ') : '—'}</td>
                <td><span className={`badge ${STATUS_META[r.status].badge}`}>{STATUS_META[r.status].label}</span></td>
                {!hidePct && (
                  <td>
                    {r.letter ? (
                      <span className={letterClass(r.letter)}>{r.letter}{r.pct !== null ? ` (${r.pct}%)` : ''}</span>
                    ) : '—'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && <div className="muted" style={{ marginTop: 10 }}>No subjects catalogued for this semester.</div>}
      </div>
    </div>
  );
}
