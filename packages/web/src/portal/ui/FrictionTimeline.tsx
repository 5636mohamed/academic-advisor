// AI Features Blueprint §3.4 — the week-by-week friction strip + burnout
// alert banner, shared across the student's own "Workload" view and (in a
// simpler roster-table form, not this component directly — see
// AdvisorFrictionOverview.tsx's own header for why) the advisor's roster
// monitoring. Same tone tokens CgpaLegend already trained the user's eye
// on: green = fine, amber = building up, red = burnout risk — no new
// legend to learn.
//
// Clicking a week opens its task window (tasks/deadlines/exams for that
// week) with a "done" checkbox per task — checking one calls the toggle
// API, which returns the FULLY RECALCULATED timeline (the checked task's
// weight — and, if it was one of several colliding that week, its share of
// the deadline-clustering overlap penalty too — drops out of the score),
// and that recalculated timeline replaces the parent's state via
// onTimelineChange so the whole chart (bars, burnout banner, trend line)
// updates live, not just the open task window.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { api, FrictionTimelineDTO } from '../../api/client';
import { Section, Empty } from './Primitives';

function severityTone(score: number, burnoutThreshold: number): 'good' | 'warn' | 'danger' {
  if (score > burnoutThreshold) return 'danger';
  if (score > burnoutThreshold * 0.6) return 'warn';
  return 'good';
}

const TREND_COPY: Record<string, string> = {
  worsening: 'Rising — recent weeks are trending heavier than earlier ones.',
  improving: 'Easing — recent weeks are trending lighter than earlier ones.',
  flat: 'Steady — no clear rise or fall across the semester.',
  insufficient_history: 'Not enough weeks with milestones yet to read a trend.',
};

const TYPE_LABEL: Record<string, string> = {
  assignment: 'Assignment', lab_report: 'Lab report', quiz: 'Quiz', midterm: 'Midterm', final: 'Final exam', project_deadline: 'Project deadline',
};

export function FrictionTimeline({
  timeline,
  studentId,
  onTimelineChange,
  burnoutThreshold = 80,
}: {
  timeline: FrictionTimelineDTO;
  /** Omit to render a read-only strip (no click-to-open task window, no
   *  checkboxes) — e.g. for a future non-interactive embed. Both provided
   *  together is what PortalWorkload.tsx actually uses. */
  studentId?: string;
  onTimelineChange?: (t: FrictionTimelineDTO) => void;
  burnoutThreshold?: number;
}) {
  const { readings, trend, courseCodes } = timeline;
  const anyBurnout = readings.some(r => r.burnoutRisk);
  const maxScore = Math.max(1, ...readings.map(r => r.frictionScore));
  const [openWeek, setOpenWeek] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const interactive = Boolean(studentId && onTimelineChange);

  const openReading = openWeek != null ? readings.find(r => r.weekNumber === openWeek) : null;

  const toggle = async (milestoneId: string) => {
    if (!studentId || !onTimelineChange) return;
    setTogglingId(milestoneId);
    try {
      const updated = await api.toggleFrictionMilestone(studentId, milestoneId);
      onTimelineChange(updated);
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <Section
      eyebrow="Cognitive Load"
      title="Weekly friction across your recommended plan"
      subtitle={courseCodes.length > 0 ? `Based on ${courseCodes.length} planned course${courseCodes.length === 1 ? '' : 's'}: ${courseCodes.join(', ')}${interactive ? ' — click a week to see its tasks.' : ''}` : 'No recommended courses to project a load from yet.'}
    >
      {readings.length === 0 ? (
        <Empty>No syllabus data available.</Empty>
      ) : (
        <>
          {anyBurnout && (
            <div className="su-note danger" style={{ marginBottom: 14 }}>
              At least one week crosses the burnout-risk threshold — several deadlines are landing in the same week. Consider spacing this plan out if possible{interactive ? ', or check off anything you\'ve already finished — done tasks no longer count toward the score.' : '.'}
            </div>
          )}
          {/* 14 fixed-content-width columns (each needs room for its own
              "W14 (3)" label) don't actually shrink below that label's
              natural width no matter how much flex-shrink allows in
              theory — min-width:auto is the flexbox default, and text
              content sets that floor. On a narrow phone the 14-column
              total genuinely exceeds the viewport (found via an actual
              375px screenshot: this row alone was ~550px wide) — same
              "wide content scrolls in its own box, the page never does"
              rule .su-table-wrap already applies to wide tables, applied
              here to a wide chart instead. */}
          <div style={{ overflowX: 'auto' }}>
          <div className="su-flex su-gap-8" style={{ alignItems: 'flex-end', height: 140, minWidth: 480 }}>
            {readings.map(r => {
              const tone = severityTone(r.frictionScore, burnoutThreshold);
              const heightPct = Math.max(4, (r.frictionScore / maxScore) * 100);
              const remainingCount = r.contributingMilestones.filter(m => !m.done).length;
              return (
                <div
                  key={r.weekNumber}
                  className="su-flex"
                  style={{ flexDirection: 'column', alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end', cursor: 'pointer' }}
                  title={r.contributingMilestones.map(m => `${m.done ? '✓ ' : ''}${m.courseCode}: ${m.title}`).join('\n') || 'No milestones this week'}
                  onClick={() => setOpenWeek(r.weekNumber)}
                >
                  <div style={{ width: '100%', maxWidth: 22, height: `${heightPct}%`, background: `var(--su-${tone})`, borderRadius: 4, transition: 'height 0.3s var(--su-ease)' }} />
                  <div className="su-muted" style={{ fontSize: 10.5, marginTop: 4 }}>
                    W{r.weekNumber}
                    {remainingCount > 0 && <span style={{ marginLeft: 3 }}>({remainingCount})</span>}
                  </div>
                </div>
              );
            })}
          </div>
          </div>
          <div className="su-flex su-gap-14" style={{ flexWrap: 'wrap', marginTop: 14, fontSize: 11.5 }}>
            {(['good', 'warn', 'danger'] as const).map(tone => (
              <div className="su-flex su-gap-8 su-items-center" key={tone}>
                <span className="su-quick-dot" style={{ marginTop: 0, background: `var(--su-${tone})` }} />
                <span className="su-muted">{tone === 'good' ? 'Light week' : tone === 'warn' ? 'Building up' : 'Burnout risk'}</span>
              </div>
            ))}
          </div>
          <div className="su-subtitle" style={{ marginTop: 10 }}>{TREND_COPY[trend.reading]}</div>
        </>
      )}

      {openReading && createPortal(
        <div className="su">
          <div className="su-modal-overlay" role="dialog" onMouseDown={e => e.target === e.currentTarget && setOpenWeek(null)}>
            <div className="su-card su-modal su-pop">
              <div className="su-title">Week {openReading.weekNumber} tasks</div>
              <div className="su-subtitle">
                {openReading.contributingMilestones.length === 0
                  ? 'No tasks, deadlines, or exams land in this week.'
                  : `Friction score this week: ${openReading.frictionScore}${openReading.burnoutRisk ? ' — burnout risk' : ''}.`}
              </div>
              {openReading.contributingMilestones.length > 0 && (
                <div className="su-flex" style={{ flexDirection: 'column', gap: 10, marginTop: 14 }}>
                  {openReading.contributingMilestones.map(m => (
                    <label key={m.id} className="su-flex su-gap-10 su-items-center" style={{ cursor: interactive ? 'pointer' : 'default', opacity: m.done ? 0.6 : 1 }}>
                      <input
                        type="checkbox"
                        checked={m.done}
                        disabled={!interactive || togglingId === m.id}
                        onChange={() => toggle(m.id)}
                      />
                      <span style={{ flex: 1 }}>
                        <span style={{ textDecoration: m.done ? 'line-through' : 'none' }}>{m.title}</span>
                        <span className="su-muted" style={{ marginLeft: 6, fontSize: 11.5 }}>{m.courseCode} · {TYPE_LABEL[m.type] ?? m.type}</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {!interactive && <div className="su-muted su-mt-16" style={{ fontSize: 11.5 }}>Read-only view.</div>}
              <button type="button" className="su-btn su-mt-16" onClick={() => setOpenWeek(null)}>Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </Section>
  );
}
