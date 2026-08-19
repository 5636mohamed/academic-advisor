// AI Features Blueprint §2/§3.3/§4.2 — the macro Cognitive Load dashboard:
// mean friction score per (department, week) across every student's real
// completed transcript history, highlighting weeks that CONSISTENTLY
// overload a department across multiple semesters (not just a one-off
// spike) — see institutionalBottleneck.service.ts's own header for the
// exact rule and its honest note that today's real seed data only has one
// department (ECE), so this will show one row until a second course
// catalog ever gets seeded. Written to scale to more rows regardless.
import { useEffect, useState } from 'react';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { api } from '../api/client';
import { InstitutionalFrictionCell } from '@advisor/shared';
import { Loading, Section, Empty } from '../portal/ui/Primitives';
import { useChartTokens, interpolateSeverity } from '../portal/ui/chartTheme';

function BottleneckChart({ cells }: { cells: InstitutionalFrictionCell[] }) {
  const tokens = useChartTokens();
  const departments = Array.from(new Set(cells.map(c => c.departmentId)));
  const maxScore = Math.max(1, ...cells.map(c => c.meanFrictionScore));
  const data = cells.map(c => ({ ...c, x: c.weekNumber, y: departments.indexOf(c.departmentId) }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, departments.length * 80 + 60)}>
      <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 90 }}>
        <CartesianGrid stroke={tokens.border} />
        <XAxis type="number" dataKey="x" domain={[0.5, 14.5]} ticks={Array.from({ length: 14 }, (_, i) => i + 1)} tickFormatter={w => `W${w}`} tick={{ fill: tokens.textMuted, fontSize: 11 }} stroke={tokens.border} />
        <YAxis type="number" dataKey="y" domain={[-0.5, departments.length - 0.5]} ticks={departments.map((_, i) => i)} tickFormatter={i => departments[i] ?? ''} tick={{ fill: tokens.textMuted, fontSize: 12 }} stroke={tokens.border} />
        <ZAxis type="number" dataKey="meanFrictionScore" range={[100, 700]} />
        <Tooltip
          cursor={{ strokeDasharray: '3 3', stroke: tokens.border }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as InstitutionalFrictionCell;
            return (
              <div className="su-card" style={{ padding: 10, fontSize: 12, boxShadow: 'var(--su-shadow-md)' }}>
                <div><b>{d.departmentId}</b> — Week {d.weekNumber}</div>
                <div className="su-muted">Mean friction score: {d.meanFrictionScore}</div>
                <div className="su-muted">{Math.round(d.burnoutRiskFraction * 100)}% of students over burnout threshold</div>
                {d.isConsistentBottleneck && <div style={{ color: tokens.danger }}>Consistent bottleneck (repeats across recent semesters)</div>}
              </div>
            );
          }}
        />
        <Scatter data={data}>
          {data.map((d, i) => (
            <Cell key={i} fill={interpolateSeverity(d.meanFrictionScore / maxScore, tokens)} stroke={d.isConsistentBottleneck ? tokens.danger : 'transparent'} strokeWidth={d.isConsistentBottleneck ? 2 : 0} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export function VpInstitutionalFrictionDashboard() {
  const [cells, setCells] = useState<InstitutionalFrictionCell[] | null>(null);
  useEffect(() => { api.vpInstitutionalBottlenecks().then(setCells); }, []);

  if (!cells) return <Loading label="Aggregating institutional workload data…" />;

  const consistentBottlenecks = cells.filter(c => c.isConsistentBottleneck);

  return (
    <Section
      eyebrow="Cognitive Load"
      title="Institutional Friction Heatmap"
      subtitle="Mean weekly friction score per department, from every student's real completed course history. Red-outlined cells repeat as a top-decile bottleneck across recent semesters, not just a one-off spike."
      className="su-mt-16"
    >
      {cells.length === 0 ? (
        <Empty>Not enough completed-course history yet to chart.</Empty>
      ) : (
        <>
          <BottleneckChart cells={cells} />
          {consistentBottlenecks.length > 0 && (
            <div className="su-note danger su-mt-16">
              {consistentBottlenecks.map(c => `${c.departmentId} consistently overloads Week ${c.weekNumber}`).join(' · ')}
            </div>
          )}
        </>
      )}
    </Section>
  );
}
