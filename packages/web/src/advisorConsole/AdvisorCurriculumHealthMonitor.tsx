// Curriculum Analytics epic, Feature 2 (Advisor) — see
// docs/CURRICULUM_ANALYTICS_BLUEPRINT.md. Scoped to the advisor's own HOME
// department (Advisor.departmentId) — same department-level (not roster-
// level) scope as AdvisorDemandForecast.tsx, for the same reason.
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { CurriculumHealthReport } from '@advisor/shared';
import { useAuth } from '../auth/AuthContext';
import { Loading, Section, Empty, StatCard } from '../portal/ui/Primitives';

function healthBadge(score: number) {
  if (score >= 75) return <span className="su-badge ok">{score}</span>;
  if (score >= 55) return <span className="su-badge warn">{score}</span>;
  return <span className="su-badge danger">{score}</span>;
}

export function AdvisorCurriculumHealthMonitor() {
  const { auth } = useAuth();
  const advisorId = auth?.role === 'advisor' ? auth.advisorId : undefined;
  const [report, setReport] = useState<CurriculumHealthReport | null>(null);

  useEffect(() => {
    if (advisorId) api.advisorCurriculumHealthMonitor(advisorId).then(setReport);
  }, [advisorId]);

  if (!report) return <Loading label="Scoring curriculum health across your department…" />;

  const sortedCourses = [...report.allCourses].sort((a, b) => a.healthScore - b.healthScore);

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
      >
        {sortedCourses.length === 0 ? (
          <Empty>No courses scored yet.</Empty>
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
