// Spec §15.1 screen 1 — "Grades & Trend", rebuilt as the Dashboard screen
// from dashboard-student.pdf: four top stat cards, the probation warning
// track, a Quick Access panel linking into the other tabs, the CGPA trend
// (now bars, colored by standing, instead of the advisor view's line chart —
// this file only ever touches the student portal), and a searchable grades
// table with the advisor system's retake recommendation per row.
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, CurriculumCourseDTO, StudentDetail } from '../api/client';
import { CgpaBarChart, Empty, Loading, SearchBox, Section, StatCard } from './ui/Primitives';
import { ProbationTrack } from './ui/Primitives';
import { IconArrowRight, IconFileText, IconLayers, IconTarget } from './ui/Icons';
import { categoryTag, creditCapDisplay, gradeRecommendation, letterClass, levelLabel } from './lib/studentUiHelpers';

const TOTAL_DEGREE_CREDITS = 160; // §2.3 LEVEL_THRESHOLDS ceiling

export function PortalHome() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [curriculum, setCurriculum] = useState<CurriculumCourseDTO[] | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!id) return;
    api.getStudent(id).then(setStudent);
    api.getCurriculum(id).then(setCurriculum);
  }, [id]);

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
  if (!student) return <Loading label="Loading your dashboard…" />;

  const cap = creditCapDisplay(student.cgpa);
  const trend = [...student.cgpaSnapshots].sort((a, b) => a.semesterOrdinal - b.semesterOrdinal);

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
              <button className="su-quick-item" onClick={() => navigate(`/portal/${id}/course-plan`)}>
                <span className="su-quick-dot" style={{ background: 'var(--su-info)' }} />
                <span className="body">
                  <span className="head">Generate Plan</span>
                  <span className="desc">Build an optimal course path considering your maximum {cap.cap} credit registration limit.</span>
                </span>
                <IconArrowRight className="chev" width={16} height={16} />
              </button>
              <button className="su-quick-item" onClick={() => navigate(`/portal/${id}/quiz`)}>
                <span className="su-quick-dot" style={{ background: 'var(--su-warn)' }} />
                <span className="body">
                  <span className="head">Take Department Fit Quiz</span>
                  <span className="desc">Evaluate your natural strengths to see if another engineering track fits you better.</span>
                </span>
                <IconArrowRight className="chev" width={16} height={16} />
              </button>
              <button className="su-quick-item" onClick={() => navigate(`/portal/${id}/transcript`)}>
                <span className="su-quick-dot" style={{ background: 'var(--su-accent)' }} />
                <span className="body">
                  <span className="head">View Full Transcript</span>
                  <span className="desc">Review complete history of your courses, semester averages, and specific retake flags.</span>
                </span>
                <IconArrowRight className="chev" width={16} height={16} />
              </button>
            </div>
          </Section>

          <Section className="su-mt-16">
            <div className="su-flex su-gap-10" style={{ flexWrap: 'wrap' }}>
              <MiniLink icon={<IconTarget width={16} height={16} />} label="Target CGPA planner" onClick={() => navigate(`/portal/${id}/course-plan?mode=target`)} />
              <MiniLink icon={<IconLayers width={16} height={16} />} label="Curriculum map" onClick={() => navigate(`/portal/${id}/transcript?tab=curriculum`)} />
              <MiniLink icon={<IconFileText width={16} height={16} />} label="My recommendations" onClick={() => navigate(`/portal/${id}/course-plan?mode=recommendations`)} />
            </div>
          </Section>
        </div>
      </div>

      <Section title="My grades" right={<SearchBox value={query} onChange={setQuery} placeholder="Course code / Name" />} className="su-mt-16">
        {student.transcript.some(r => r.status === 'registered') && (
          <div className="su-note" style={{ marginBottom: 14 }}>
            You have course(s) registered and pending a grade this semester — they'll appear here once graded.
          </div>
        )}
        {gradedRows.length === 0 ? (
          <Empty>No graded courses match “{query}”.</Empty>
        ) : (
          <div className="su-table-wrap">
            <table className="su-table">
              <thead>
                <tr>
                  <th>Course code</th>
                  <th>Course name</th>
                  <th>Category</th>
                  <th>Credits</th>
                  <th>Grade</th>
                  <th>Advisor system recommendation</th>
                </tr>
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
                      <td>{meta ? `${meta.course.credits} Credits` : '—'}</td>
                      <td className={letterClass(r.letter!)} style={{ fontSize: 15 }}>{r.letter}</td>
                      <td><span className={`su-badge ${rec.tone}`}>{rec.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="su-subtitle" style={{ marginTop: 12, marginBottom: 0 }}>
          Only letter grades are shown here — percentages are visible to your advisor only.
        </div>
      </Section>
    </div>
  );
}

function MiniLink({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" className="su-btn su-btn-secondary su-btn-sm" onClick={onClick}>
      {icon} {label}
    </button>
  );
}
