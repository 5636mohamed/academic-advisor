// Curriculum Analytics epic, Feature 1 (Advisor) — see
// docs/CURRICULUM_ANALYTICS_BLUEPRINT.md. Scoped to the advisor's own HOME
// department (Advisor.departmentId), not their 25-student roster — this is
// a department-level diagnostic view, deliberately wider than the advisor's
// other, roster-scoped pages (mirrors why the feature is named "Department,
// VP" rather than "Advisors, VP" in the request).
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { DepartmentDemandForecast } from '@advisor/shared';
import { useAuth } from '../auth/AuthContext';
import { Loading, Section, Empty, StatCard } from '../portal/ui/Primitives';

export function AdvisorDemandForecast() {
  const { auth } = useAuth();
  const advisorId = auth?.role === 'advisor' ? auth.advisorId : undefined;
  const [forecast, setForecast] = useState<DepartmentDemandForecast | null>(null);

  useEffect(() => {
    if (advisorId) api.advisorDemandForecast(advisorId).then(setForecast);
  }, [advisorId]);

  if (!forecast) return <Loading label="Forecasting demand across your department…" />;

  const sortedCourses = [...forecast.courses].sort((a, b) => b.nextTermEnrolled - a.nextTermEnrolled);

  return (
    <>
      <div className="su-stat-grid su-stagger">
        <StatCard label="Forecasted seats, next term" value={forecast.totalNextTermEnrolled} sub={`${forecast.departmentId} — all courses`} accent />
        <StatCard label="Forecasted sections" value={forecast.totalForecastedSections} sub="Derived estimate — see note below" />
        <StatCard label="Forecasted instructor load" value={forecast.totalForecastedInstructorLoad} sub="Assumes 1 instructor per section" />
      </div>

      <Section
        eyebrow="Resource Planning"
        title={`${forecast.departmentId} Demand Forecast`}
        subtitle="Next-term enrollment projected from each course's real historical offering data (recency-weighted trend) — sorted by highest forecasted demand."
        className="su-mt-16"
      >
        {sortedCourses.length === 0 ? (
          <Empty>No courses seeded for this department yet.</Empty>
        ) : (
          <>
            <div className="su-note su-mt-16" style={{ fontSize: 12, marginTop: 0 }}>
              Sections and instructor load are <b>derived estimates</b> (forecasted enrollment ÷ this course
              category's typical historical class size, assuming one instructor per section) — not real
              section-scheduling or instructor-assignment data.
            </div>
            <div className="su-table-wrap su-mt-16">
              <table className="su-table">
                <thead>
                  <tr><th>Course</th><th>Last real enrollment</th><th>Forecasted next term</th><th>Confidence band</th><th>Sections</th><th>Trend</th></tr>
                </thead>
                <tbody>
                  {sortedCourses.map(c => {
                    const last = c.history[c.history.length - 1];
                    return (
                      <tr key={c.courseCode}>
                        <td><b>{c.courseCode}</b><div className="su-muted" style={{ fontSize: 11.5 }}>{c.courseName}</div></td>
                        <td className="su-muted">{last ? `${last.enrolled} (${last.term} ${last.year})` : '—'}</td>
                        <td>{c.nextTermEnrolled}</td>
                        <td className="su-muted">± {c.confidenceBand}</td>
                        <td>{c.forecastedSections}</td>
                        <td>
                          {c.trendSlope > 0.5 ? (
                            <span className="su-badge warn">Rising</span>
                          ) : c.trendSlope < -0.5 ? (
                            <span className="su-badge ok">Declining</span>
                          ) : (
                            <span className="su-badge neutral">Steady</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Section>
    </>
  );
}
