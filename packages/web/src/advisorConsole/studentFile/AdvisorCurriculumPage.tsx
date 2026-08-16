// "Curriculum" sub-tab — the per-semester catalog browser (§14 CATALOG),
// restyled from the old Curriculum/CurriculumContent.tsx. Percentages are
// shown (advisor privilege), unlike the student portal's Transcript tab.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, CurriculumCourseDTO, CurriculumCourseStatus } from '../../api/client';
import { categoryTag, letterClass } from '../../portal/lib/studentUiHelpers';
import { Empty, Loading } from '../../portal/ui/Primitives';

const STATUS_META: Record<CurriculumCourseStatus, { label: string; tone: string }> = {
  passed: { label: 'Passed', tone: 'ok' },
  needs_retake: { label: 'Retake needed', tone: 'danger' },
  registered: { label: 'Registered — pending grade', tone: 'neutral' },
  eligible: { label: 'Eligible now', tone: 'warn' },
  locked: { label: 'Not yet reachable', tone: 'neutral' },
};

export function AdvisorCurriculumPage() {
  const { id } = useParams<{ id: string }>();
  const [rows, setRows] = useState<CurriculumCourseDTO[] | null>(null);
  const [semester, setSemester] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    setRows(null);
    api.getCurriculum(id).then(data => {
      setRows(data);
      const active = data.find(r => r.status === 'registered' || r.status === 'needs_retake' || r.status === 'eligible');
      setSemester(active ? active.course.semesterOrdinal : data[0]?.course.semesterOrdinal ?? 1);
    });
  }, [id]);

  if (!id) return null;
  if (!rows || semester === null) return <Loading label="Loading curriculum…" />;

  const semesters = [...new Set(rows.map(r => r.course.semesterOrdinal))].sort((a, b) => a - b);
  const visible = rows.filter(r => r.course.semesterOrdinal === semester).sort((a, b) => a.course.code.localeCompare(b.course.code));

  return (
    <div className="su-card su-fade">
      <div className="su-subtitle" style={{ marginTop: 0 }}>
        Every subject in the program catalog, grouped by the semester it's normally offered — with this student's
        status on each.
      </div>
      <div className="su-subtabs su-mt-16">
        {semesters.map(s => (
          <button key={s} className={`su-subtab${s === semester ? ' active' : ''}`} onClick={() => setSemester(s)}>Semester {s}</button>
        ))}
      </div>
      <div className="su-table-wrap">
        <table className="su-table">
          <thead>
            <tr><th>Code</th><th>Subject</th><th>Credits</th><th>Category</th><th>Prereqs</th><th>Status</th><th>Grade</th></tr>
          </thead>
          <tbody>
            {visible.map(r => (
              <tr key={r.course.code}>
                <td><b>{r.course.code}</b></td>
                <td>{r.course.name}</td>
                <td>{r.course.credits}</td>
                <td className="su-muted">{categoryTag(r.course.category)}</td>
                <td className="su-muted">{r.course.prereq.length ? r.course.prereq.join(', ') : '—'}</td>
                <td><span className={`su-badge ${STATUS_META[r.status].tone}`}>{STATUS_META[r.status].label}</span></td>
                <td>{r.letter ? <span className={letterClass(r.letter)}>{r.letter}{r.pct !== null ? ` (${r.pct}%)` : ''}</span> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visible.length === 0 && <Empty>No subjects catalogued for this semester.</Empty>}
    </div>
  );
}
