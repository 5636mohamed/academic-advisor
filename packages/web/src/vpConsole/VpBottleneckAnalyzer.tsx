// Curriculum Analytics epic, Feature 3 (VP) — see
// docs/CURRICULUM_ANALYTICS_BLUEPRINT.md. Institution-wide ranked list of
// courses whose real failure rate + downstream chain impact cascades into
// the most expected graduation delay — reuses courseRiskScore.service.ts's
// computeCourseRisk() (same primitive Feature 2 is built on), ranked
// instead of scored-and-rolled-up. No per-student tracing here — that's
// the Advisor-scoped page's own job (affectedAdvisees); the VP already has
// per-advisor drill-down on VpAdvisorDetail.tsx.
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { BottleneckCourse } from '@advisor/shared';
import { Loading, Section, Empty, StatCard } from '../portal/ui/Primitives';
import { ALL_COURSE_FILTER, CourseFilterBar, CourseFilterValue, filterCourses } from '../portal/ui/CourseFilterBar';
import { departmentsCell } from '../portal/lib/departmentsCell';
import { downloadBottleneckAnalyzerPdf } from '../lib/pdfReport';

export function VpBottleneckAnalyzer() {
  const [bottlenecks, setBottlenecks] = useState<BottleneckCourse[] | null>(null);
  const [filter, setFilter] = useState<CourseFilterValue>(ALL_COURSE_FILTER);
  const [downloading, setDownloading] = useState(false);
  useEffect(() => { api.vpBottlenecks().then(setBottlenecks); }, []);

  // Kept ABOVE the `!bottlenecks` early return below — useMemo must run
  // every render in the same order (real rules-of-hooks bug caught before
  // shipping, see VpCurriculumHealthMonitor.tsx's identical fix).
  const real = useMemo(
    () => filterCourses((bottlenecks ?? []).filter(b => b.cascadingDelaySemesters > 0), filter),
    [bottlenecks, filter]
  );

  if (!bottlenecks) return <Loading label="Ranking bottleneck courses across every department…" />;

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
        right={
          <button
            className="su-btn su-btn-secondary su-btn-sm"
            disabled={downloading}
            onClick={async () => {
              setDownloading(true);
              try {
                await downloadBottleneckAnalyzerPdf({ title: 'Course Bottleneck & Dependency Analyzer — Vice President', bottlenecks: real });
              } finally {
                setDownloading(false);
              }
            }}
          >
            {downloading ? 'Building PDF…' : 'Download PDF'}
          </button>
        }
      >
        <CourseFilterBar courses={bottlenecks.filter(b => b.cascadingDelaySemesters > 0)} value={filter} onChange={setFilter} />
        {real.length === 0 ? (
          <Empty>No genuine bottlenecks match the selected filters.</Empty>
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
