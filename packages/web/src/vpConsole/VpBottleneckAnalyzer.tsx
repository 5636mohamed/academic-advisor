// Curriculum Analytics epic, Feature 3 (VP) — see
// docs/CURRICULUM_ANALYTICS_BLUEPRINT.md. Institution-wide ranked list of
// courses whose real failure rate + downstream chain impact cascades into
// the most expected graduation delay — reuses courseRiskScore.service.ts's
// computeCourseRisk() (same primitive Feature 2 is built on), ranked
// instead of scored-and-rolled-up. No per-student tracing here — that's
// the Advisor-scoped page's own job (affectedAdvisees); the VP already has
// per-advisor drill-down on VpAdvisorDetail.tsx.
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { BottleneckCourse } from '@advisor/shared';
import { Loading, Section, Empty, StatCard } from '../portal/ui/Primitives';

export function VpBottleneckAnalyzer() {
  const [bottlenecks, setBottlenecks] = useState<BottleneckCourse[] | null>(null);
  useEffect(() => { api.vpBottlenecks().then(setBottlenecks); }, []);

  if (!bottlenecks) return <Loading label="Ranking bottleneck courses across every department…" />;

  const real = bottlenecks.filter(b => b.cascadingDelaySemesters > 0);
  const totalBlocked = new Set(real.flatMap(b => b.directlyBlocks)).size;

  return (
    <>
      <div className="su-stat-grid su-stagger">
        <StatCard label="Real bottleneck courses" value={real.length} sub={`Of ${bottlenecks.length} scored — carry genuine cascading delay`} accent />
        <StatCard label="Courses gated behind them" value={totalBlocked} sub="Directly blocked, at least one hop" />
        <StatCard label="Worst expected delay" value={real[0] ? `${real[0].cascadingDelaySemesters.toFixed(1)} sem` : '—'} sub={real[0]?.courseCode ?? 'None found'} />
      </div>

      <Section
        eyebrow="Curriculum Analytics"
        title="Course Bottleneck & Dependency Analyzer"
        subtitle="Every course ranked by expected graduation-delay impact — its real failure rate, current demand pressure, and exactly which other courses it gates."
        className="su-mt-16"
      >
        {real.length === 0 ? (
          <Empty>No genuine bottlenecks found — every course either has no real dependents or a healthy failure rate.</Empty>
        ) : (
          <div className="su-table-wrap">
            <table className="su-table">
              <thead>
                <tr><th>Course</th><th>Department</th><th>Expected delay</th><th>Failure rate</th><th>Directly blocks</th></tr>
              </thead>
              <tbody>
                {real.map(b => (
                  <tr key={b.courseCode}>
                    <td><b>{b.courseCode}</b><div className="su-muted" style={{ fontSize: 11.5 }}>{b.courseName}</div></td>
                    <td className="su-muted">{b.departmentId ?? 'Shared / UR'}</td>
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
