// Spec §10 component list — renders the §3.4 OLS trend line over a
// student's real CgpaSnapshot series. Plain inline SVG, no chart library.
import { CgpaSnapshot } from '@advisor/shared';

export function CgpaTrendChart({ snapshots, trendSlope }: { snapshots: CgpaSnapshot[]; trendSlope: number | null }) {
  if (snapshots.length === 0) return <div className="muted">No CGPA history yet.</div>;

  const width = 560;
  const height = 160;
  const pad = 28;
  const sorted = [...snapshots].sort((a, b) => a.semesterOrdinal - b.semesterOrdinal);
  const xs = sorted.map(s => s.semesterOrdinal);
  const ys = sorted.map(s => s.cgpa);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = 0;
  const yMax = 4;

  const xScale = (x: number) => pad + ((x - xMin) / Math.max(1, xMax - xMin)) * (width - 2 * pad);
  const yScale = (y: number) => height - pad - ((y - yMin) / (yMax - yMin)) * (height - 2 * pad);

  const points = sorted.map(s => `${xScale(s.semesterOrdinal)},${yScale(s.cgpa)}`).join(' ');
  const probationY = yScale(2.0);

  return (
    <div>
      {/* Colors set via `style` (not the `fill`/`stroke` attributes) so the
          CSS custom properties resolve and this chart follows dark mode,
          same as everything else on the page. */}
      <svg width={width} height={height} role="img" aria-label="CGPA trend chart">
        <line x1={pad} y1={probationY} x2={width - pad} y2={probationY} style={{ stroke: 'var(--warn)' }} strokeDasharray="4 3" />
        <text x={width - pad} y={probationY - 4} fontSize="10" style={{ fill: 'var(--danger)' }} textAnchor="end">
          2.00 probation line
        </text>
        <polyline points={points} fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth={2} />
        {sorted.map(s => (
          <circle key={s.semesterId} cx={xScale(s.semesterOrdinal)} cy={yScale(s.cgpa)} r={3.5} style={{ fill: s.isBaseSnapshot ? 'var(--accent)' : 'var(--ink)' }} />
        ))}
        {sorted.map(s => (
          <text key={`${s.semesterId}-label`} x={xScale(s.semesterOrdinal)} y={height - 8} fontSize="10" style={{ fill: 'var(--ink-muted)' }} textAnchor="middle">
            {s.semesterOrdinal}
          </text>
        ))}
      </svg>
      <div className="muted">
        Trend slope: {trendSlope === null ? 'insufficient history' : trendSlope.toFixed(3)} per semester
        {trendSlope !== null && (trendSlope > 0.01 ? ' (improving)' : trendSlope < -0.01 ? ' (declining)' : ' (flat)')}
      </div>
    </div>
  );
}
