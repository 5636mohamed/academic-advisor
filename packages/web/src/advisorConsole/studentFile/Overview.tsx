// "Overview" — dashboard-Advisor-student.pdf: the exact same dashboard
// layout the student's own Dashboard uses (same stat cards, probation
// track, CGPA bar chart, grades table), viewed by the advisor for any
// chosen student. Two differences from the student's own view: percentages
// ARE shown (the advisor privilege every other advisor screen already had),
// and a manual grade-entry form + transfer history are appended — both
// carried over from the old StudentFile.tsx so neither capability is lost.
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { api, CurriculumCourseDTO, StudentDetail } from '../../api/client';
import { categoryTag, creditCapDisplay, gradeRecommendation, letterClass, levelLabel } from '../../portal/lib/studentUiHelpers';
import { CgpaBarChart, Loading, ProbationTrack, SearchBox, Section, StatCard } from '../../portal/ui/Primitives';
import { IconArrowRight, IconFileText, IconLayers, IconTarget } from '../../portal/ui/Icons';

const TOTAL_DEGREE_CREDITS = 160;

export function Overview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { reload } = useOutletContext<{ reload: () => void }>();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [curriculum, setCurriculum] = useState<CurriculumCourseDTO[] | null>(null);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({ courseCode: '', pct: '', semesterOrdinal: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!id) return;
    api.getStudent(id).then(setStudent);
    api.getCurriculum(id).then(setCurriculum);
  };

  useEffect(load, [id]);

  const nameByCode = useMemo(() => {
    const m = new Map<string, CurriculumCourseDTO>();
    curriculum?.forEach(r => m.set(r.course.code, r));
    return m;
  }, [curriculum]);

  const completedCredits = useMemo(
    () => curriculum?.filter(r => r.status === 'passed').reduce((s, r) => s + r.course.credits, 0) ?? null,
    [curriculum]
  );

  if (!id) return null;
  if (!student) return <Loading label="Loading student overview…" />;

  const cap = creditCapDisplay(student.cgpa);
  const trend = [...student.cgpaSnapshots].sort((a, b) => a.semesterOrdinal - b.semesterOrdinal);

  const submitGrade = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.courseCode || !form.pct || !form.semesterOrdinal) return;
    setSaving(true);
    setError(null);
    try {
      await api.enroll(id, form.courseCode.toUpperCase(), Number(form.pct), Number(form.semesterOrdinal));
      setForm({ courseCode: '', pct: '', semesterOrdinal: '' });
      load();
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const gradedRows = student.transcript
    .filter(r => r.status === 'completed')
    .sort((a, b) => b.semesterOrdinal - a.semesterOrdinal)
    .filter(r => {
      if (!query.trim()) return true;
      const q = query.trim().toLowerCase();
      const name = nameByCode.get(r.courseCode)?.course.name ?? '';
      return r.courseCode.toLowerCase().includes(q) || name.toLowerCase().includes(q);
    });

  return (
    <div>
      <div className="su-stat-grid su-stagger">
        <StatCard label="Cumulative GPA" value={student.cgpa.toFixed(2)} unit="/ 4.00" accent sub="Target: 3.00 for honors" />
        <StatCard label="Academic Level" value={`Level ${student.level}`} sub={levelLabel(student.level)} />
        <StatCard
          label="Completed Credits"
          value={completedCredits === null ? '—' : `${completedCredits} / ${TOTAL_DEGREE_CREDITS}`}
          sub={completedCredits === null ? undefined : `${((completedCredits / TOTAL_DEGREE_CREDITS) * 100).toFixed(1)}% degree completion`}
        />
        <StatCard label="Max Registration Cap" value={cap.cap} unit="Credits" sub={cap.reason} subTone={cap.cap < 20 ? 'warn' : 'muted'} />
      </div>

      <div className="su-two-col">
        <div>
          <Section
            eyebrow="Probation Counter"
            title="Warning Threshold"
            right={<span className={`su-badge ${student.probationCounter.count >= 3 ? 'danger' : student.probationCounter.count > 0 ? 'warn' : 'ok'}`}>{student.probationCounter.count} out of 6 semesters</span>}
          >
            <ProbationTrack count={student.probationCounter.count} />
            <div className="su-subtitle" style={{ marginTop: 4 }}>
              Warning: reaching 6 semesters on academic probation leads to mandatory suspension / program transfer
              recommendation under E-JUST university bylaws.
            </div>
          </Section>

          <Section eyebrow="Trend" title="CGPA Semester Trend" className="su-mt-16">
            <CgpaBarChart points={trend.map(s => ({ label: `S${s.semesterOrdinal}`, value: s.cgpa }))} />
          </Section>
        </div>

        <div>
          <Section title="Quick access">
            <div className="su-quick-list">
              <button className="su-quick-item" onClick={() => navigate(`/students/${id}/course-plan`)}>
                <span className="su-quick-dot" style={{ background: 'var(--su-info)' }} />
                <span className="body"><span className="head">Generate Plan</span><span className="desc">Run the recovery planner within their {cap.cap}-credit registration limit.</span></span>
                <IconArrowRight className="chev" width={16} height={16} />
              </button>
              <button className="su-quick-item" onClick={() => navigate(`/students/${id}/quiz`)}>
                <span className="su-quick-dot" style={{ background: 'var(--su-warn)' }} />
                <span className="body"><span className="head">Department Fit Quiz</span><span className="desc">See their best-fit department results.</span></span>
                <IconArrowRight className="chev" width={16} height={16} />
              </button>
              <button className="su-quick-item" onClick={() => navigate(`/students/${id}/curriculum`)}>
                <span className="su-quick-dot" style={{ background: 'var(--su-accent)' }} />
                <span className="body"><span className="head">Full Transcript</span><span className="desc">Complete course history and semester breakdown.</span></span>
                <IconArrowRight className="chev" width={16} height={16} />
              </button>
            </div>
          </Section>
          <Section className="su-mt-16">
            <div className="su-flex su-gap-10" style={{ flexWrap: 'wrap' }}>
              <button className="su-btn su-btn-secondary su-btn-sm" onClick={() => navigate(`/students/${id}/course-plan?mode=target`)}><IconTarget width={16} height={16} /> Target CGPA</button>
              <button className="su-btn su-btn-secondary su-btn-sm" onClick={() => navigate(`/students/${id}/curriculum?tab=curriculum`)}><IconLayers width={16} height={16} /> Curriculum map</button>
              <button className="su-btn su-btn-secondary su-btn-sm" onClick={() => navigate(`/students/${id}/course-plan?mode=proposals`)}><IconFileText width={16} height={16} /> Proposals</button>
            </div>
          </Section>
        </div>
      </div>

      <Section title={`Students grade ( ${student.name} )`} right={<SearchBox value={query} onChange={setQuery} placeholder="Course code / Name" />} className="su-mt-16">
        {gradedRows.length === 0 ? (
          <div className="su-empty">No graded courses match “{query}”.</div>
        ) : (
          <div className="su-table-wrap">
            <table className="su-table">
              <thead>
                <tr><th>Course code</th><th>Course name</th><th>Category</th><th>Credits</th><th>Grade</th><th>%</th><th>Advisor system recommendation</th></tr>
              </thead>
              <tbody>
                {gradedRows.map(r => {
                  const meta = nameByCode.get(r.courseCode);
                  const rec = gradeRecommendation(r.letter!);
                  return (
                    <tr key={`${r.courseCode}-${r.attemptNumber ?? 0}`}>
                      <td><b>{r.courseCode}</b>{r.isRetake && <span className="su-badge neutral" style={{ marginLeft: 6 }}>retake</span>}</td>
                      <td>{meta?.course.name ?? '—'}</td>
                      <td className="su-muted">{meta ? categoryTag(meta.course.category) : '—'}</td>
                      <td>{meta?.course.credits ?? '—'}</td>
                      <td className={letterClass(r.letter!)} style={{ fontSize: 15 }}>{r.letter}</td>
                      <td className="su-muted">{r.pct}%</td>
                      <td><span className={`su-badge ${rec.tone}`}>{rec.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {student.status !== 'dismissed' && (
        <Section eyebrow="Registrar action" title="Record a grade" className="su-mt-16">
          <form onSubmit={submitGrade} className="su-flex su-gap-10 su-items-center" style={{ flexWrap: 'wrap' }}>
            <div className="su-field"><label>Course code</label><input className="su-input" placeholder="e.g. ECE314" value={form.courseCode} onChange={e => setForm({ ...form, courseCode: e.target.value })} style={{ width: 130 }} /></div>
            <div className="su-field"><label>Score %</label><input className="su-input" type="number" min="0" max="100" value={form.pct} onChange={e => setForm({ ...form, pct: e.target.value })} style={{ width: 90 }} /></div>
            <div className="su-field"><label>Semester #</label><input className="su-input" type="number" min="1" value={form.semesterOrdinal} onChange={e => setForm({ ...form, semesterOrdinal: e.target.value })} style={{ width: 100 }} /></div>
            <button className="su-btn" disabled={saving} type="submit" style={{ alignSelf: 'flex-end' }}>Record grade</button>
          </form>
          {error && <div className="su-note danger su-mt-16">{error}</div>}
        </Section>
      )}

      {student.transferRecords.length > 0 && (
        <Section title="Transfer History" className="su-mt-16">
          {student.transferRecords.map((t, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: i < student.transferRecords.length - 1 ? '1px solid var(--su-border)' : 'none' }}>
              <b>{t.type === 'internal_department' ? 'Internal transfer' : 'Faculty transfer'}</b>{' '}
              {t.type === 'internal_department' ? `${t.fromDepartmentId} → ${t.toDepartmentId}` : `${t.fromFacultyId} → ${t.toFacultyId} / ${t.toDepartmentId}`}
              <div className="su-muted">Counter: {t.counterAction}</div>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}
