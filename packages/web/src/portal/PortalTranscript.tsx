// "Transcript" tab — the full grade history from dashboard-student.pdf's
// "My grades" widget (all graded attempts, searchable, with the advisor
// system's retake recommendation per row), plus the existing per-semester
// Curriculum Map (§14 CATALOG browser) as a second sub-tab so that real
// feature keeps a home under the new five-item topbar.
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api, CurriculumCourseDTO, CurriculumCourseStatus, StudentDetail } from '../api/client';
import { categoryTag, gradeRecommendation, letterClass } from './lib/studentUiHelpers';
import { Empty, Loading, SearchBox } from './ui/Primitives';
import { downloadUnofficialTranscriptPdf } from '../lib/pdfReport';

// Default "collapsed" view — the newest few attempts only, matching how a
// student mostly wants "what did I just take", not their whole multi-year
// history at a glance. "View more" (or a search) drops this cap entirely.
const COLLAPSED_ROW_COUNT = 5;

const STATUS_META: Record<CurriculumCourseStatus, { label: string; tone: string }> = {
  passed: { label: 'Passed', tone: 'ok' },
  needs_retake: { label: 'Retake needed', tone: 'danger' },
  registered: { label: 'Registered — pending grade', tone: 'neutral' },
  eligible: { label: 'Eligible now', tone: 'warn' },
  locked: { label: 'Not yet reachable', tone: 'neutral' },
};

export function PortalTranscript() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<'history' | 'curriculum'>(params.get('tab') === 'curriculum' ? 'curriculum' : 'history');
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [advisorName, setAdvisorName] = useState<string>('');
  const [curriculum, setCurriculum] = useState<CurriculumCourseDTO[] | null>(null);
  const [query, setQuery] = useState('');
  const [semester, setSemester] = useState<number | null>(null);
  const [showAllGrades, setShowAllGrades] = useState(false);
  const [downloadingTranscript, setDownloadingTranscript] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.getStudent(id).then(s => {
      setStudent(s);
      api.advisor(s.advisorId).then(a => setAdvisorName(a.name)).catch(() => setAdvisorName(''));
    });
    api.getCurriculum(id).then(data => {
      setCurriculum(data);
      const active = data.find(r => r.status === 'registered' || r.status === 'needs_retake' || r.status === 'eligible');
      setSemester(active ? active.course.semesterOrdinal : data[0]?.course.semesterOrdinal ?? 1);
    });
  }, [id]);

  const nameByCode = useMemo(() => {
    const m = new Map<string, CurriculumCourseDTO>();
    curriculum?.forEach(r => m.set(r.course.code, r));
    return m;
  }, [curriculum]);

  if (!id) return null;
  if (!student || !curriculum) return <Loading label="Loading your transcript…" />;

  const allGradedRows = student.transcript
    .filter(r => r.status === 'completed')
    .sort((a, b) => b.semesterOrdinal - a.semesterOrdinal || a.courseCode.localeCompare(b.courseCode));
  const gradedRows = allGradedRows.filter(r => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    const name = nameByCode.get(r.courseCode)?.course.name ?? '';
    return r.courseCode.toLowerCase().includes(q) || name.toLowerCase().includes(q);
  });
  // Collapsed to the newest few by default — searching (the student knows
  // exactly what they're after) always shows every match regardless of
  // the cap; browsing normally needs "View more" to see the rest.
  const isFiltering = query.trim().length > 0;
  const displayedRows = isFiltering || showAllGrades ? gradedRows : gradedRows.slice(0, COLLAPSED_ROW_COUNT);
  const hiddenCount = gradedRows.length - displayedRows.length;

  const downloadTranscript = async () => {
    setDownloadingTranscript(true);
    try {
      await downloadUnofficialTranscriptPdf({
        studentName: student.name,
        studentId: student.id,
        facultyId: student.facultyId,
        departmentId: student.departmentId,
        cgpa: student.cgpa,
        advisorName: advisorName || '—',
        rows: allGradedRows.map(r => ({
          semesterOrdinal: r.semesterOrdinal,
          courseCode: r.courseCode,
          courseName: nameByCode.get(r.courseCode)?.course.name ?? r.courseCode,
          credits: nameByCode.get(r.courseCode)?.course.credits ?? 0,
          letter: r.letter!,
        })),
      });
    } finally {
      setDownloadingTranscript(false);
    }
  };

  const semesters = [...new Set(curriculum.map(r => r.course.semesterOrdinal))].sort((a, b) => a - b);
  const visible = curriculum
    .filter(r => r.course.semesterOrdinal === semester)
    .sort((a, b) => a.course.code.localeCompare(b.course.code));

  return (
    <div>
      <div className="su-flex su-justify-between su-items-center" style={{ marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="su-eyebrow">Academic record</div>
          <div className="su-title" style={{ fontSize: 24 }}>Transcript</div>
        </div>
        <div className="su-subtabs" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: 0 }}>
          <button className={`su-subtab${tab === 'history' ? ' active' : ''}`} onClick={() => setTab('history')}>Grade History</button>
          <button className={`su-subtab${tab === 'curriculum' ? ' active' : ''}`} onClick={() => setTab('curriculum')}>Curriculum Map</button>
        </div>
      </div>

      {tab === 'history' && (
        <div className="su-card su-fade">
          <div className="su-flex su-justify-between su-items-center" style={{ flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            <div className="su-subtitle" style={{ margin: 0 }}>
              {isFiltering
                ? 'Every graded attempt on record, most recent semester first.'
                : `Your ${Math.min(COLLAPSED_ROW_COUNT, gradedRows.length)} most recent graded attempts — "View more" shows the full record.`}
            </div>
            <div className="su-flex su-gap-10 su-items-center" style={{ flexWrap: 'wrap' }}>
              <SearchBox value={query} onChange={setQuery} placeholder="Course code / Name" />
              <button className="su-btn su-btn-sm su-btn-secondary" disabled={downloadingTranscript} onClick={downloadTranscript}>
                {downloadingTranscript ? 'Building PDF…' : 'Download Unofficial Transcript'}
              </button>
            </div>
          </div>
          {gradedRows.length === 0 ? (
            <Empty>No graded courses match “{query}”.</Empty>
          ) : (
            <div className="su-table-wrap">
              <table className="su-table">
                <thead>
                  <tr>
                    <th>Sem.</th><th>Course code</th><th>Course name</th><th>Credits</th><th>Grade</th><th>Advisor system recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRows.map(r => {
                    const meta = nameByCode.get(r.courseCode);
                    const rec = gradeRecommendation(r.letter!);
                    return (
                      <tr key={`${r.courseCode}-${r.attemptNumber ?? 0}`}>
                        <td className="su-muted">{r.semesterOrdinal}</td>
                        <td><b>{r.courseCode}</b>{r.isRetake && <span className="su-badge neutral" style={{ marginLeft: 6 }}>retake</span>}</td>
                        <td>{meta?.course.name ?? '—'}</td>
                        <td>{meta?.course.credits ?? '—'}</td>
                        <td className={letterClass(r.letter!)} style={{ fontSize: 15 }}>{r.letter}</td>
                        <td><span className={`su-badge ${rec.tone}`}>{rec.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!isFiltering && hiddenCount > 0 && (
            <button className="su-btn su-btn-secondary su-btn-sm su-mt-16" onClick={() => setShowAllGrades(true)}>
              View more ({hiddenCount} older attempt{hiddenCount === 1 ? '' : 's'})
            </button>
          )}
          {!isFiltering && showAllGrades && gradedRows.length > COLLAPSED_ROW_COUNT && (
            <button className="su-btn su-btn-ghost su-btn-sm su-mt-16" onClick={() => setShowAllGrades(false)}>
              Show fewer
            </button>
          )}
        </div>
      )}

      {tab === 'curriculum' && semester !== null && (
        <div className="su-card su-fade">
          <div className="su-subtitle" style={{ marginBottom: 4 }}>
            Every subject in the program catalog, grouped by the semester it's normally offered — with your status on each.
          </div>
          <div className="su-subtabs su-mt-16">
            {semesters.map(s => (
              <button key={s} className={`su-subtab${s === semester ? ' active' : ''}`} onClick={() => setSemester(s)}>Semester {s}</button>
            ))}
          </div>
          <div className="su-table-wrap">
            <table className="su-table">
              <thead>
                <tr><th>Code</th><th>Subject</th><th>Credits</th><th>Category</th><th>Prereqs</th><th>Status</th></tr>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visible.length === 0 && <Empty>No subjects catalogued for this semester.</Empty>}
        </div>
      )}
    </div>
  );
}
