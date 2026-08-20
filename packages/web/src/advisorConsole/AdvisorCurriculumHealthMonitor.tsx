// Curriculum Analytics epic, Feature 2 (Advisor) — see
// docs/CURRICULUM_ANALYTICS_BLUEPRINT.md. Scoped to the advisor's own HOME
// department (Advisor.departmentId) — same department-level (not roster-
// level) scope as AdvisorDemandForecast.tsx, for the same reason.
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { CurriculumHealthReport } from '@advisor/shared';
import { useAuth } from '../auth/AuthContext';
import { Loading, Section, Empty, StatCard } from '../portal/ui/Primitives';
import { ALL_COURSE_FILTER, CourseFilterBar, CourseFilterValue, filterCourses } from '../portal/ui/CourseFilterBar';
import { downloadCurriculumHealthPdf } from '../lib/pdfReport';

function healthBadge(score: number) {
  if (score >= 75) return <span className="su-badge ok">{score}</span>;
  if (score >= 55) return <span className="su-badge warn">{score}</span>;
  return <span className="su-badge danger">{score}</span>;
}

export function AdvisorCurriculumHealthMonitor() {
  const { auth } = useAuth();
  const advisorId = auth?.role === 'advisor' ? auth.advisorId : undefined;
  const [report, setReport] = useState<CurriculumHealthReport | null>(null);
  const [filter, setFilter] = useState<CourseFilterValue>(ALL_COURSE_FILTER);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (advisorId) api.advisorCurriculumHealthMonitor(advisorId).then(setReport);
  }, [advisorId]);

  // Kept ABOVE the `!report` early return below — useMemo must run every
  // render in the same order (real rules-of-hooks bug caught before
  // shipping, see VpCurriculumHealthMonitor.tsx's identical fix).
  const sortedCourses = useMemo(
    () => filterCourses([...(report?.allCourses ?? [])].sort((a, b) => a.healthScore - b.healthScore), filter),
    [report, filter]
  );

  if (!report) return <Loading label="Scoring curriculum health across your department…" />;

  return (
    <>
      <div className="su-stat-grid su-stagger">
        <StatCard
          label="Average health score"
          value={report.averageHealthScore}
          unit="/ 100"
          accent
          sub={report.departmentId ?? 'This department'}
        />
        <StatCard label="Courses at risk" value={report.coursesAtRisk} sub={`Of ${report.totalCourses} total`} subTone={report.coursesAtRisk > 0 ? 'warn' : 'muted'} />
        <StatCard label="Worst course" value={report.worstCourses[0]?.courseCode ?? '—'} sub={report.worstCourses[0] ? `Health ${report.worstCourses[0].healthScore}/100` : 'Nothing at risk'} />
      </div>

      <Section
        eyebrow="Curriculum Analytics"
        title={`${report.departmentId ?? ''} Curriculum Health Monitor`}
        subtitle="Every course in your department's own catalog — health score, real failure rate, downstream chain impact, demand pressure, and expected graduation delay — worst first."
        className="su-mt-16"
        right={
          <button
            className="su-btn su-btn-secondary su-btn-sm"
            disabled={downloading}
            onClick={async () => {
              setDownloading(true);
              try {
                await downloadCurriculumHealthPdf({ title: `Curriculum Health Monitor — ${report.departmentId ?? ''}`, courses: sortedCourses });
              } finally {
                setDownloading(false);
              }
            }}
          >
            {downloading ? 'Building PDF…' : 'Download PDF'}
          </button>
        }
      >
        <CourseFilterBar courses={report.allCourses} value={filter} onChange={setFilter} showDepartment={false} />
        {sortedCourses.length === 0 ? (
          <Empty>No courses match the selected filters.</Empty>
        ) : (
          <div className="su-table-wrap">
            <table className="su-table">
              <thead>
                <tr><th>Course</th><th>Health</th><th>Failure rate</th><th>Gates</th><th>Demand pressure</th><th>Expected delay</th></tr>
              </thead>
              <tbody>
                {sortedCourses.map(c => (
                  <tr key={c.courseCode}>
                    <td><b>{c.courseCode}</b><div className="su-muted" style={{ fontSize: 11.5 }}>{c.courseName}</div></td>
                    <td>{healthBadge(c.healthScore)}</td>
                    <td className="su-muted">{c.failureRate}%</td>
                    <td className="su-muted">{c.downstreamImpact.toFixed(1)}</td>
                    <td className="su-muted">{(c.demandPressure * 100).toFixed(0)}%</td>
                    <td>{c.cascadingDelaySemesters > 0 ? `${c.cascadingDelaySemesters.toFixed(1)} sem` : '—'}</td>
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
