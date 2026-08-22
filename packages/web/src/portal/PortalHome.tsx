// Spec §15.1 screen 1 — "Grades & Trend", rebuilt as the Dashboard screen
// from dashboard-student.pdf: four top stat cards, the probation warning
// track, a Quick Access panel linking into the other tabs, the CGPA trend
// (now bars, colored by standing, instead of the advisor view's line chart —
// this file only ever touches the student portal), and a searchable grades
// table with the advisor system's retake recommendation per row.
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, CurriculumCourseDTO, FrictionTimelineDTO, StudentDetail } from '../api/client';
import { ColdStartAssessment } from '@advisor/shared';
import { CgpaBarChart, Empty, Loading, SearchBox, Section, StatCard } from './ui/Primitives';
import { ProbationTrack } from './ui/Primitives';
import { FrictionTimeline } from './ui/FrictionTimeline';
import { IconArrowRight, IconFileText, IconLayers, IconTarget } from './ui/Icons';
import { categoryTag, creditCapDisplay, gradeRecommendation, letterClass, levelLabel } from './lib/studentUiHelpers';

const TOTAL_DEGREE_CREDITS = 160; // §2.3 LEVEL_THRESHOLDS ceiling

// Same "newest few by default, View more for the rest" collapse
// PortalTranscript.tsx's own Grade History already uses — kept as its own
// constant here rather than importing theirs since these are two
// independently-scrollable "my grades" tables (dashboard summary vs. full
// transcript), not one shared component.
const COLLAPSED_ROW_COUNT = 5;

// Mirrors coldStart.service.ts's COLD_START_TIER_COPY — kept as plain
// client-side copy (not fetched) since it's static text, same pattern
// TYPE_LABEL/STAGE_LABEL etc. already use elsewhere for small closed enums.
const COLD_START_TIER_LABEL: Record<string, string> = {
  strong_start: 'Strong projected start',
  solid_start: 'Solid projected start',
  needs_early_support: 'Early support recommended',
};
const COLD_START_TIER_DETAIL: Record<string, string> = {
  strong_start: 'Your G12 and entrance exam results put you well above the typical first-semester range — no early-support flag needed, just keep the same study habits going.',
  solid_start: 'Your G12 and entrance exam results project a solid, on-track first semester. A quick check-in with your advisor after your first quiz/midterm results is still a good idea.',
  needs_early_support: 'Your G12 and entrance exam results are on the lower end of the range that tends to need extra support in a demanding first semester — your advisor has been flagged to reach out early, before any real grades are in yet.',
};
const COLD_START_TIER_TONE: Record<string, 'ok' | 'warn' | 'danger'> = {
  strong_start: 'ok', solid_start: 'warn', needs_early_support: 'danger',
};

export function PortalHome() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [curriculum, setCurriculum] = useState<CurriculumCourseDTO[] | null>(null);
  const [query, setQuery] = useState('');
  const [showAllGrades, setShowAllGrades] = useState(false);
  const [workload, setWorkload] = useState<FrictionTimelineDTO | null>(null);
  const [coldStart, setColdStart] = useState<ColdStartAssessment | null | undefined>(undefined); // undefined = not loaded yet, null = not applicable

  useEffect(() => {
    if (!id) return;
    api.getStudent(id).then(setStudent);
    api.getCurriculum(id).then(setCurriculum);
    api.frictionTimeline(id).then(setWorkload);
    api.coldStartAssessment(id).then(setColdStart);
  }, [id]);

  const nameByCode = useMemo(() => {
    const m = new Map<string, CurriculumCourseDTO>();
    curriculum?.forEach(r => m.set(r.course.code, r));
    return m;
  }, [curriculum]);

  // Real bug (live user report): this used to re-derive "Completed Credits"
  // from the (department-scoped) Curriculum tab's `status === 'passed'`
  // rows, which is a STRICTER bar than earned-credit-hours (it also
  // excludes D/D+, "needs retake" grades that still earned their credit —
  // see completeTranscript's doc comment in inMemoryDb.ts) and silently
  // drops any credit earned before an internal/external transfer, since
  // those old-department course codes aren't in the new department's
  // catalog at all. That combination is exactly what could show "0
  // completed credits" for a student who was nonetheless Level 2/3.
  // `student.cumulativeEarnedCredits` is the same authoritative figure
  // `level` itself is derived from, so it can never disagree with Level.
  const completedCredits = student?.cumulativeEarnedCredits ?? null;

  if (!id) return null;
  if (!student) return <Loading label="Loading your dashboard…" />;

  const hasCompletedAnyCourse = (curriculum ?? []).some(r => r.status === 'passed' || r.status === 'needs_retake');
  const cap = creditCapDisplay(student.cgpa, hasCompletedAnyCourse);
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
  // Collapsed to the newest few by default, same reasoning as
  // PortalTranscript.tsx's Grade History — searching always shows every
  // match regardless of the cap.
  const isFiltering = query.trim().length > 0;
  const displayedGradedRows = isFiltering || showAllGrades ? gradedRows : gradedRows.slice(0, COLLAPSED_ROW_COUNT);
  const hiddenGradeCount = gradedRows.length - displayedGradedRows.length;

  return (
    <div>
      {/* Cognitive Load — the real interactive chart (not just a summary
          stat), first thing on the dashboard so it's what the student
          actually sees on open, not something they have to scroll to or
          find via a separate tab. Same component the Workload tab uses,
          fully interactive here too (click a week, check off/move tasks) —
          not a read-only preview. */}
      {workload && workload.readings.length > 0 && (
        <FrictionTimeline timeline={workload} studentId={id} onTimelineChange={setWorkload} />
      )}

      <div className="su-stat-grid su-stagger su-mt-16">
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
              recommendation under university bylaws.
            </div>
          </Section>

          {coldStart ? (
            <Section
              eyebrow="Getting Started"
              title={COLD_START_TIER_LABEL[coldStart.tier]}
              right={<span className={`su-badge ${COLD_START_TIER_TONE[coldStart.tier]}`}>{coldStart.projectedLetter} projected</span>}
              className="su-mt-16"
            >
              <div className="su-subtitle">{COLD_START_TIER_DETAIL[coldStart.tier]}</div>
              <div className="su-flex su-gap-18 su-mt-16" style={{ flexWrap: 'wrap' }}>
                <div>
                  <div className="su-muted" style={{ fontSize: 11.5 }}>G12 (Thanaweya Amma)</div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{coldStart.g12Score}%</div>
                </div>
                <div>
                  <div className="su-muted" style={{ fontSize: 11.5 }}>Entrance exam</div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{coldStart.entranceExamScore}%</div>
                </div>
                <div>
                  <div className="su-muted" style={{ fontSize: 11.5 }}>Projected starting performance</div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{coldStart.projectedPct}% <span className="su-muted" style={{ fontSize: 13, fontWeight: 600 }}>({coldStart.projectedLetter})</span></div>
                </div>
              </div>
              <div className="su-muted su-mt-16" style={{ fontSize: 11 }}>
                No graded courses yet this semester, so there's no grade trend to chart — this projection is based on your G12 and entrance exam results instead, and will be replaced by a real trend once your first grades come in.
              </div>
            </Section>
          ) : (
            <Section eyebrow="Trend" title="CGPA Semester Trend" className="su-mt-16">
              <CgpaBarChart points={trend.map(s => ({ label: `S${s.semesterOrdinal}`, value: s.cgpa }))} />
            </Section>
          )}
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
                {displayedGradedRows.map(r => {
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
        {!isFiltering && hiddenGradeCount > 0 && (
          <button className="su-btn su-btn-secondary su-btn-sm su-mt-16" onClick={() => setShowAllGrades(true)}>
            View more ({hiddenGradeCount} older attempt{hiddenGradeCount === 1 ? '' : 's'})
          </button>
        )}
        {!isFiltering && showAllGrades && gradedRows.length > COLLAPSED_ROW_COUNT && (
          <button className="su-btn su-btn-ghost su-btn-sm su-mt-16" onClick={() => setShowAllGrades(false)}>
            Show fewer
          </button>
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
