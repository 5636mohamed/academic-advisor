// Curriculum Analytics epic, Feature 2 (VP) — see
// docs/CURRICULUM_ANALYTICS_BLUEPRINT.md. Every real department's course
// health, scored by courseRiskScore.service.ts's computeCourseRisk()
// (failure rate, downstream chain impact, demand pressure, cascading
// delay) and rolled up by curriculumHealthMonitor.service.ts. A ranked
// table with severity badges, same visual language every other "which of
// these needs attention" list in this app already uses (AdvisorFrictionOverview,
// AdvisorAllStudents' risk column) — not a chart forced onto content a
// sortable table already serves better.
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { CurriculumHealthReport } from '@advisor/shared';
import { Loading, Section, Empty, StatCard } from '../portal/ui/Primitives';

function healthBadge(score: number) {
  if (score >= 75) return <span className="su-badge ok">{score}</span>;
  if (score >= 55) return <span className="su-badge warn">{score}</span>;
  return <span className="su-badge danger">{score}</span>;
}

export function VpCurriculumHealthMonitor() {
  const [report, setReport] = useState<CurriculumHealthReport | null>(null);
  useEffect(() => { api.vpCurriculumHealthMonitor().then(setReport); }, []);

  if (!report) return <Loading label="Scoring curriculum health across every department…" />;

  const sortedCourses = [...report.allCourses].sort((a, b) => a.healthScore - b.healthScore);

  return (
    <>
      <div className="su-stat-grid su-stagger">
        <StatCard
          label="Average health score"
          value={report.averageHealthScore}
          unit="/ 100"
          accent
          sub={report.averageHealthScore >= 75 ? 'Healthy' : report.averageHealthScore >= 55 ? 'Watch closely' : 'Needs attention'}
          subTone={report.averageHealthScore >= 75 ? 'good' : report.averageHealthScore >= 55 ? 'warn' : 'warn'}
        />
        <StatCard label="Courses at risk" value={report.coursesAtRisk} sub={`Of ${report.totalCourses} total, below the health threshold`} subTone={report.coursesAtRisk > 0 ? 'warn' : 'muted'} />
        <StatCard label="Total courses scored" value={report.totalCourses} sub="Across every real department" />
      </div>

      <Section
        eyebrow="Curriculum Analytics"
        title="Curriculum Health Monitor"
        subtitle="Every course's health score — from its real failure rate, how many other courses it gates, current demand pressure, and the resulting expected graduation delay — worst first."
        className="su-mt-16"
      >
        {sortedCourses.length === 0 ? (
          <Empty>No courses scored yet.</Empty>
        ) : (
          <div className="su-table-wrap">
            <table className="su-table">
              <thead>
                <tr><th>Course</th><th>Department</th><th>Health</th><th>Failure rate</th><th>Gates</th><th>Demand pressure</th><th>Expected delay</th></tr>
              </thead>
              <tbody>
                {sortedCourses.map(c => (
                  <tr key={c.courseCode}>
                    <td><b>{c.courseCode}</b><div className="su-muted" style={{ fontSize: 11.5 }}>{c.courseName}</div></td>
                    <td className="su-muted">{c.departmentId ?? 'Shared / UR'}</td>
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
