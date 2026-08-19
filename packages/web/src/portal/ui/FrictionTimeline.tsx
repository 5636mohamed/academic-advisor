// AI Features Blueprint §3.4 — the week-by-week friction strip + burnout
// alert banner, shared across the student's own "Workload" view and (in a
// simpler roster-table form, not this component directly — see
// AdvisorFrictionOverview.tsx's own header for why) the advisor's roster
// monitoring. Same tone tokens CgpaLegend already trained the user's eye
// on: green = fine, amber = building up, red = burnout risk — no new
// legend to learn.
import { FrictionTimelineDTO } from '../../api/client';
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

export function FrictionTimeline({ timeline, burnoutThreshold = 80 }: { timeline: FrictionTimelineDTO; burnoutThreshold?: number }) {
  const { readings, trend, courseCodes } = timeline;
  const anyBurnout = readings.some(r => r.burnoutRisk);
  const maxScore = Math.max(1, ...readings.map(r => r.frictionScore));

  return (
    <Section
      eyebrow="Cognitive Load"
      title="Weekly friction across your recommended plan"
      subtitle={courseCodes.length > 0 ? `Based on ${courseCodes.length} planned course${courseCodes.length === 1 ? '' : 's'}: ${courseCodes.join(', ')}` : 'No recommended courses to project a load from yet.'}
    >
      {readings.length === 0 ? (
        <Empty>No syllabus data available.</Empty>
      ) : (
        <>
          {anyBurnout && (
            <div className="su-note danger" style={{ marginBottom: 14 }}>
              At least one week crosses the burnout-risk threshold — several deadlines are landing in the same week. Consider spacing this plan out if possible.
            </div>
          )}
          <div className="su-flex su-gap-8" style={{ alignItems: 'flex-end', height: 140 }}>
            {readings.map(r => {
              const tone = severityTone(r.frictionScore, burnoutThreshold);
              const heightPct = Math.max(4, (r.frictionScore / maxScore) * 100);
              return (
                <div key={r.weekNumber} className="su-flex" style={{ flexDirection: 'column', alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end' }} title={r.contributingMilestones.map(m => `${m.courseCode}: ${m.title}`).join('\n') || 'No milestones this week'}>
                  <div style={{ width: '100%', maxWidth: 22, height: `${heightPct}%`, background: `var(--su-${tone})`, borderRadius: 4, transition: 'height 0.3s var(--su-ease)' }} />
                  <div className="su-muted" style={{ fontSize: 10.5, marginTop: 4 }}>W{r.weekNumber}</div>
                </div>
              );
            })}
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
    </Section>
  );
}
