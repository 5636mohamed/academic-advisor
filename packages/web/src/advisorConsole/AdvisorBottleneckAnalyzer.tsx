// Curriculum Analytics epic, Feature 3 (Advisor) — see
// docs/CURRICULUM_ANALYTICS_BLUEPRINT.md. Same institution-wide ranked
// list as the VP's page, PLUS the one genuinely new cross-reference this
// feature adds: which of THIS advisor's own advisees are actually at risk
// from a real bottleneck course (already failed it and need a retake, or
// it's still a real unfulfilled gate ahead in their own remaining plan) —
// the roster-actionable framing that's why this feature is "Advisors, VP"
// rather than "Department, VP" like Features 1-2.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, AdvisorBottlenecksDTO } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Loading, Section, Empty, StatCard } from '../portal/ui/Primitives';
import { ALL_COURSE_FILTER, CourseFilterBar, CourseFilterValue, filterCourses } from '../portal/ui/CourseFilterBar';
import { departmentsCell } from '../portal/lib/departmentsCell';
import { downloadBottleneckAnalyzerPdf } from '../lib/pdfReport';

const REASON_LABEL: Record<string, string> = {
  failed_needs_retake: 'Already failed — needs a retake',
  prereq_not_yet_cleared: 'Still a real gate ahead in their plan',
};

export function AdvisorBottleneckAnalyzer() {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const advisorId = auth?.role === 'advisor' ? auth.advisorId : undefined;
  const [data, setData] = useState<AdvisorBottlenecksDTO | null>(null);
  const [filter, setFilter] = useState<CourseFilterValue>(ALL_COURSE_FILTER);
  // Real live report: "make them categorized by level" — a level filter
  // for the advisees table specifically (course-level filtering already
  // covers the institution-wide ranking table below via CourseFilterBar).
  const [levelFilter, setLevelFilter] = useState('all');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (advisorId) api.advisorBottlenecks(advisorId).then(setData);
  }, [advisorId]);

  // Kept ABOVE the `!data` early return below — useMemo must run every
  // render in the same order (real rules-of-hooks bug caught before
  // shipping, see VpCurriculumHealthMonitor.tsx's identical fix).
  const genuineBottlenecks = (data?.bottlenecks ?? []).filter(b => b.cascadingDelaySemesters > 0);
  const real = useMemo(() => filterCourses(genuineBottlenecks, filter), [genuineBottlenecks, filter]);
  const affectedAll = data?.affectedAdvisees ?? [];
  const advisedLevels = useMemo(() => [...new Set(affectedAll.map(a => a.studentLevel))].sort((a, b) => a - b), [affectedAll]);
  const affected = useMemo(
    () => (levelFilter === 'all' ? affectedAll : affectedAll.filter(a => String(a.studentLevel) === levelFilter)),
    [affectedAll, levelFilter]
  );

  if (!data) return <Loading label="Checking your roster against real institutional bottlenecks…" />;

  const affectedStudentCount = new Set(affected.map(a => a.studentId)).size;

  return (
    <>
      <div className="su-stat-grid su-stagger">
        <StatCard label="Your advisees at risk" value={affectedStudentCount} sub="From a real institutional bottleneck" subTone={affectedStudentCount > 0 ? 'warn' : 'muted'} accent />
        <StatCard label="Real bottleneck courses" value={real.length} sub="Institution-wide, ranked below" />
        <StatCard label="Worst expected delay" value={real[0] ? `${real[0].cascadingDelaySemesters.toFixed(1)} sem` : '—'} sub={real[0]?.courseCode ?? 'None found'} />
      </div>

      <Section
        eyebrow="Curriculum Analytics"
        title="Advisees affected by a real bottleneck"
        subtitle="Students on your roster who've already failed a bottleneck course, or still have one as a real, unfulfilled gate ahead in their remaining plan."
        className="su-mt-16"
        right={
          <button
            className="su-btn su-btn-secondary su-btn-sm"
            disabled={downloading}
            onClick={async () => {
              setDownloading(true);
              try {
                await downloadBottleneckAnalyzerPdf({ title: 'Course Bottleneck & Dependency Analyzer — Advisor', bottlenecks: real, affectedAdvisees: affected });
              } finally {
                setDownloading(false);
              }
            }}
          >
            {downloading ? 'Building PDF…' : 'Download PDF'}
          </button>
        }
      >
        {advisedLevels.length > 1 && (
          <div className="su-field" style={{ maxWidth: 200, marginBottom: 14 }}>
            <label>Level</label>
            <select className="su-input" value={levelFilter} onChange={e => setLevelFilter(e.target.value)}>
              <option value="all">All levels</option>
              {advisedLevels.map(l => (
                <option key={l} value={l}>Level {l}</option>
              ))}
            </select>
          </div>
        )}
        {affected.length === 0 ? (
          <Empty>{affectedAll.length === 0 ? 'No advisee on your roster is currently affected by a real bottleneck course.' : 'No advisee at this level is currently affected.'}</Empty>
        ) : (
          <div className="su-table-wrap">
            <table className="su-table">
              <thead>
                <tr><th>Student</th><th>Level</th><th>Bottleneck course</th><th>Why</th></tr>
              </thead>
              <tbody>
                {affected.map((a, i) => (
                  <tr key={`${a.studentId}-${a.bottleneckCourseCode}-${i}`} style={{ cursor: 'pointer' }} onClick={() => navigate(`/students/${a.studentId}`)}>
                    <td><b>{a.studentName}</b></td>
                    <td className="su-muted">{a.studentLevel}</td>
                    <td>{a.bottleneckCourseCode}</td>
                    <td>
                      <span className={`su-badge ${a.reason === 'failed_needs_retake' ? 'danger' : 'warn'}`}>{REASON_LABEL[a.reason]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        eyebrow="Curriculum Analytics"
        title="Institution-wide bottleneck ranking"
        subtitle="Every course ranked by expected graduation-delay impact, across all departments — for context on where your advisees' bottlenecks rank institution-wide."
        className="su-mt-16"
      >
        <CourseFilterBar courses={genuineBottlenecks} value={filter} onChange={setFilter} />
        {real.length === 0 ? (
          <Empty>No genuine bottlenecks match the selected filters.</Empty>
        ) : (
          <div className="su-table-wrap">
            <table className="su-table">
              <thead>
                <tr><th>Course</th><th>Department</th><th>Expected delay</th><th>Failure rate</th><th>Directly blocks</th></tr>
              </thead>
              <tbody>
                {real.slice(0, 15).map(b => (
                  <tr key={b.courseCode}>
                    <td><b>{b.courseCode}</b><div className="su-muted" style={{ fontSize: 11.5 }}>{b.courseName}</div></td>
                    <td className="su-muted">{departmentsCell(b.departments)}</td>
                    <td><span className="su-badge danger">{b.cascadingDelaySemesters.toFixed(1)} sem</span></td>
                    <td className="su-muted">{b.failureRate}%</td>
                    <td className="su-muted" style={{ fontSize: 12 }}>{b.directlyBlocks.length > 0 ? b.directlyBlocks.join(', ') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
