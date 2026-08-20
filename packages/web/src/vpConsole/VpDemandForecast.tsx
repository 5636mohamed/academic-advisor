// Curriculum Analytics epic, Feature 1 (VP) — see
// docs/CURRICULUM_ANALYTICS_BLUEPRINT.md. Every real department's next-term
// enrollment/section/instructor-load projection, from real CourseOffering
// history via the same weighted-OLS trend machinery every other projection
// in this system already uses (resourceForecast.service.ts). Sections/
// instructor-load are explicitly derived estimates — this app has no real
// Section/Instructor entity — labeled as such in the UI, not presented as
// if real staffing data exists.
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from 'recharts';
import { api } from '../api/client';
import { DepartmentDemandForecast } from '@advisor/shared';
import { Loading, Section, Empty, StatCard } from '../portal/ui/Primitives';
import { useChartTokens } from '../portal/ui/chartTheme';

function DepartmentDemandChart({ departments }: { departments: DepartmentDemandForecast[] }) {
  const tokens = useChartTokens();
  const data = [...departments].sort((a, b) => b.totalNextTermEnrolled - a.totalNextTermEnrolled);
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 34 + 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 10, right: 24, bottom: 10, left: 10 }}>
        <CartesianGrid stroke={tokens.border} horizontal={false} />
        <XAxis type="number" tick={{ fill: tokens.textMuted, fontSize: 11 }} stroke={tokens.border} />
        <YAxis type="category" dataKey="departmentId" width={60} tick={{ fill: tokens.text, fontSize: 12 }} stroke={tokens.border} />
        <Tooltip
          cursor={{ fill: tokens.surface2 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as DepartmentDemandForecast;
            return (
              <div className="su-card" style={{ padding: 10, fontSize: 12, boxShadow: 'var(--su-shadow-md)' }}>
                <div><b>{d.departmentId}</b></div>
                <div className="su-muted">{d.totalNextTermEnrolled} seats forecasted next term</div>
                <div className="su-muted">{d.totalForecastedSections} sections · {d.totalForecastedInstructorLoad} instructor-load (est.)</div>
              </div>
            );
          }}
        />
        <Bar dataKey="totalNextTermEnrolled" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => <Cell key={i} fill={tokens.info} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function VpDemandForecast() {
  const [departments, setDepartments] = useState<DepartmentDemandForecast[] | null>(null);
  useEffect(() => { api.vpDemandForecast().then(setDepartments); }, []);

  if (!departments) return <Loading label="Forecasting demand across every department…" />;

  const totalSeats = departments.reduce((s, d) => s + d.totalNextTermEnrolled, 0);
  const totalSections = departments.reduce((s, d) => s + d.totalForecastedSections, 0);
  const totalInstructorLoad = departments.reduce((s, d) => s + d.totalForecastedInstructorLoad, 0);

  return (
    <>
      <div className="su-stat-grid su-stagger">
        <StatCard label="Forecasted seats, next term" value={totalSeats} sub="Across every department" accent />
        <StatCard label="Forecasted sections" value={totalSections} sub="Derived estimate — see note below" />
        <StatCard label="Forecasted instructor load" value={totalInstructorLoad} sub="Assumes 1 instructor per section" />
      </div>

      <Section
        eyebrow="Resource Planning"
        title="Academic Resource Demand Forecast"
        subtitle="Next-term enrollment projected from each course's real historical offering data (recency-weighted trend), rolled up by department."
        className="su-mt-16"
      >
        {departments.length === 0 ? (
          <Empty>No department catalogs seeded yet.</Empty>
        ) : (
          <>
            <DepartmentDemandChart departments={departments} />
            <div className="su-note su-mt-16" style={{ fontSize: 12 }}>
              Sections and instructor load are <b>derived estimates</b> (forecasted enrollment ÷ this course
              category's typical historical class size, assuming one instructor per section) — this system has no
              real section-scheduling or instructor-assignment data behind them.
            </div>
            <div className="su-table-wrap su-mt-16">
              <table className="su-table">
                <thead>
                  <tr><th>Department</th><th>Courses</th><th>Forecasted seats</th><th>Forecasted sections</th><th>Instructor load (est.)</th></tr>
                </thead>
                <tbody>
                  {[...departments].sort((a, b) => b.totalNextTermEnrolled - a.totalNextTermEnrolled).map(d => (
                    <tr key={d.departmentId}>
                      <td><b>{d.departmentId}</b></td>
                      <td className="su-muted">{d.courses.length}</td>
                      <td>{d.totalNextTermEnrolled}</td>
                      <td>{d.totalForecastedSections}</td>
                      <td>{d.totalForecastedInstructorLoad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Section>
    </>
  );
}
