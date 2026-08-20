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
//
// A movable task (assignment/quiz/lab_report — never an exam/deadline,
// which has a real institutional date) also gets "+1 week"/"+2 weeks"
// buttons — same recalculate-and-replace round trip as the checkbox.
// Original week is read directly off the milestone id itself
// (`${courseCode}::${weekNumber}::${type}` — see seedSyllabusMilestones.ts),
// not a separate field, so the server stays the one source of truth for
// what "original" means without a redundant duplicated field to drift.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { api, FrictionTimelineDTO } from '../../api/client';
import { MilestoneType } from '@advisor/shared';
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

// Mirrors MOVABLE_MILESTONE_TYPES/MAX_MOVE_WEEKS/SEMESTER_WEEKS in
// frictionScore.service.ts / seedSyllabusMilestones.ts — the server is
// still the real source of truth (it re-validates every request), this
// is just enough to decide which buttons to show client-side.
const MOVABLE_TYPES: MilestoneType[] = ['assignment', 'quiz', 'lab_report'];
const MAX_MOVE_WEEKS = 2;
const SEMESTER_WEEKS = 14;

function originalWeekOf(milestoneId: string): number {
  return Number(milestoneId.split('::')[1]);
}

type FrictionReading = FrictionTimelineDTO['readings'][number];
type ContributingMilestone = FrictionReading['contributingMilestones'][number];

/** One task row — the checkbox + move-buttons markup, shared by both the
 *  single-list and two-column layouts below so there's only one place that
 *  actually renders a task. */
function TaskItem({
  m, weekNumber, interactive, busyId, onToggle, onMove,
}: {
  m: ContributingMilestone;
  weekNumber: number;
  interactive: boolean;
  busyId: string | null;
  onToggle: (milestoneId: string) => void;
  onMove: (milestoneId: string, newWeek: number) => void;
}) {
  const originalWeek = originalWeekOf(m.id);
  const wasMoved = originalWeek !== weekNumber;
  const movable = MOVABLE_TYPES.includes(m.type) && !m.done;
  const maxReachable = Math.min(originalWeek + MAX_MOVE_WEEKS, SEMESTER_WEEKS);
  return (
    <div>
      <label className="su-flex su-gap-10 su-items-center" style={{ cursor: interactive ? 'pointer' : 'default', opacity: m.done ? 0.6 : 1 }}>
        <input type="checkbox" checked={m.done} disabled={!interactive || busyId === m.id} onChange={() => onToggle(m.id)} />
        <span style={{ flex: 1 }}>
          <span style={{ textDecoration: m.done ? 'line-through' : 'none' }}>{m.title}</span>
          <span className="su-muted" style={{ marginLeft: 6, fontSize: 11.5 }}>
            {m.courseCode} · {TYPE_LABEL[m.type] ?? m.type}{wasMoved && ` · moved from Week ${originalWeek}`}
          </span>
        </span>
      </label>
      {interactive && movable && (
        <div className="su-flex su-gap-6" style={{ marginLeft: 28, marginTop: 4 }}>
          {Array.from({ length: MAX_MOVE_WEEKS }, (_, i) => originalWeek + i + 1)
            .filter(w => w <= maxReachable && w !== weekNumber)
            .map(w => (
              <button
                key={w} type="button" className="su-btn su-btn-secondary" style={{ fontSize: 11, padding: '4px 9px' }}
                disabled={busyId === m.id}
                onClick={() => onMove(m.id, w)}
              >
                Move to Week {w}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

/** A heavy/burnout week's task window splits into two columns — one for
 *  tasks with a real, fixed institutional date (exams, midterms, finals,
 *  project deadlines — never movable, per MOVABLE_TYPES) and one for the
 *  tasks that actually CAN be eased by moving them (assignments, quizzes,
 *  lab reports) — so a student staring down a long, heavy list can see at
 *  a glance which items are genuinely fixed vs. which ones are worth
 *  considering moving. A lighter week (not burnout, or few enough tasks
 *  that there's nothing to triage) stays the simpler single flat list —
 *  splitting a 1-2-task week into two mostly-empty columns would just add
 *  visual noise for no real benefit. */
/** A week counts as "heavy" for the two-column split (and the wider modal
 *  it needs) once it's flagged burnout-risk or has enough tasks that
 *  triaging fixed-vs-movable is actually useful — exported so
 *  FrictionTimeline can pick the right modal width with the exact same
 *  rule TaskList uses to decide its own layout, rather than a second,
 *  possibly-drifting copy of the threshold. */
export function isHeavyWeek(reading: FrictionReading): boolean {
  const HEAVY_TASK_COUNT = 5;
  return reading.burnoutRisk || reading.contributingMilestones.length >= HEAVY_TASK_COUNT;
}

function TaskList({
  reading, interactive, busyId, onToggle, onMove,
}: {
  reading: FrictionReading;
  interactive: boolean;
  busyId: string | null;
  onToggle: (milestoneId: string) => void;
  onMove: (milestoneId: string, newWeek: number) => void;
}) {
  const milestones = reading.contributingMilestones;

  if (!isHeavyWeek(reading)) {
    return (
      <div className="su-flex" style={{ flexDirection: 'column', gap: 10, marginTop: 14 }}>
        {milestones.map(m => (
          <TaskItem key={m.id} m={m} weekNumber={reading.weekNumber} interactive={interactive} busyId={busyId} onToggle={onToggle} onMove={onMove} />
        ))}
      </div>
    );
  }

  const fixed = milestones.filter(m => !MOVABLE_TYPES.includes(m.type));
  const movable = milestones.filter(m => MOVABLE_TYPES.includes(m.type));

  return (
    <div className="su-mt-16">
      <div className="su-note warn" style={{ marginBottom: 12, fontSize: 12 }}>
        A heavy week — split below so it's easier to see what's genuinely fixed vs. worth moving.
      </div>
      <div className="su-flex su-gap-18" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <div className="su-eyebrow" style={{ marginBottom: 8 }}>🔒 Fixed — exams &amp; deadlines ({fixed.length})</div>
          {fixed.length === 0 ? (
            <div className="su-muted" style={{ fontSize: 12 }}>None this week.</div>
          ) : (
            <div className="su-flex" style={{ flexDirection: 'column', gap: 10 }}>
              {fixed.map(m => (
                <TaskItem key={m.id} m={m} weekNumber={reading.weekNumber} interactive={interactive} busyId={busyId} onToggle={onToggle} onMove={onMove} />
              ))}
            </div>
          )}
        </div>
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <div className="su-eyebrow" style={{ marginBottom: 8 }}>📝 Flexible — assignments &amp; reports ({movable.length})</div>
          {movable.length === 0 ? (
            <div className="su-muted" style={{ fontSize: 12 }}>None this week.</div>
          ) : (
            <div className="su-flex" style={{ flexDirection: 'column', gap: 10 }}>
              {movable.map(m => (
                <TaskItem key={m.id} m={m} weekNumber={reading.weekNumber} interactive={interactive} busyId={busyId} onToggle={onToggle} onMove={onMove} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
  const { readings, trend, courseCodes, recommendations } = timeline;
  const anyBurnout = readings.some(r => r.burnoutRisk);
  const maxScore = Math.max(1, ...readings.map(r => r.frictionScore));
  const [openWeek, setOpenWeek] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const interactive = Boolean(studentId && onTimelineChange);

  const openReading = openWeek != null ? readings.find(r => r.weekNumber === openWeek) : null;
  const openRecommendation = openWeek != null ? recommendations.find(r => r.weekNumber === openWeek) : undefined;

  const toggle = async (milestoneId: string) => {
    if (!studentId || !onTimelineChange) return;
    setBusyId(milestoneId);
    try {
      onTimelineChange(await api.toggleFrictionMilestone(studentId, milestoneId));
    } finally {
      setBusyId(null);
    }
  };

  const move = async (milestoneId: string, newWeek: number) => {
    if (!studentId || !onTimelineChange) return;
    setBusyId(milestoneId);
    try {
      onTimelineChange(await api.rescheduleFrictionMilestone(studentId, milestoneId, newWeek));
    } finally {
      setBusyId(null);
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
              const hasRecommendation = recommendations.some(rec => rec.weekNumber === r.weekNumber);
              return (
                <div
                  key={r.weekNumber}
                  className="su-flex"
                  style={{ flexDirection: 'column', alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end', cursor: 'pointer', position: 'relative' }}
                  title={r.contributingMilestones.map(m => `${m.done ? '✓ ' : ''}${m.courseCode}: ${m.title}`).join('\n') || 'No milestones this week'}
                  onClick={() => setOpenWeek(r.weekNumber)}
                >
                  {hasRecommendation && (
                    <span style={{ position: 'absolute', top: -14, fontSize: 11, color: 'var(--su-accent)' }} title="A way to ease this week is available — click to see it">💡</span>
                  )}
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
            {recommendations.length > 0 && <span className="su-muted">💡 = a way to ease that week is available</span>}
          </div>
          <div className="su-subtitle" style={{ marginTop: 10 }}>{TREND_COPY[trend.reading]}</div>
        </>
      )}

      {openReading && createPortal(
        <div className="su">
          <div className="su-modal-overlay" role="dialog" onMouseDown={e => e.target === e.currentTarget && setOpenWeek(null)}>
            <div className={`su-card su-modal su-pop${openReading && isHeavyWeek(openReading) ? ' su-modal-wide' : ''}`}>
              <div className="su-title">Week {openReading.weekNumber} tasks</div>
              <div className="su-subtitle">
                {openReading.contributingMilestones.length === 0
                  ? 'No tasks, deadlines, or exams land in this week.'
                  : `Friction score this week: ${openReading.frictionScore}${openReading.burnoutRisk ? ' — burnout risk' : ''}.`}
              </div>

              {openRecommendation && interactive && (
                <div className="su-note warn" style={{ marginTop: 10 }}>
                  💡 To ease this week, consider moving <b>"{openRecommendation.title}"</b> ({openRecommendation.courseCode}) to Week {openRecommendation.suggestedNewWeek}
                  {' '}(currently a lighter week — score {openRecommendation.targetWeekScoreBefore}).
                  <div style={{ marginTop: 8 }}>
                    <button
                      type="button" className="su-btn su-btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }}
                      disabled={busyId === openRecommendation.milestoneId}
                      onClick={() => move(openRecommendation.milestoneId, openRecommendation.suggestedNewWeek)}
                    >
                      Move it to Week {openRecommendation.suggestedNewWeek}
                    </button>
                  </div>
                </div>
              )}

              {openReading.contributingMilestones.length > 0 && (
                <TaskList reading={openReading} interactive={interactive} busyId={busyId} onToggle={toggle} onMove={move} />
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
