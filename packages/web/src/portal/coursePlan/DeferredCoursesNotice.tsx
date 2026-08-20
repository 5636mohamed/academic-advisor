// Surfaces `carriedToNextSemester` — real, required-to-graduate retakes
// that planPacker.ts deliberately left OUT of this cycle's plan (see its
// own doc comment on packPlan). Before this component existed,
// `carriedToNextSemester` was already in every /plan/fast and /plan/target
// API response but never rendered anywhere: a course could vanish from the
// visible plan with zero explanation. That's the wrong failure mode for a
// requirement that doesn't actually go away — this makes the "why isn't
// this showing up" answer visible instead of silent.
import { PlanBundle } from '../lib/planBundle';

const REASON_LABEL: Record<string, string> = {
  still_predicted_fail: 'Still predicted to fail this attempt — talk to your advisor about extra support before retaking it',
  credit_overflow: "Didn't fit this semester's credit cap — prioritized again next semester",
};

export function DeferredCoursesNotice({ bundles }: { bundles: PlanBundle[] }) {
  if (!bundles || bundles.length === 0) return null;
  return (
    <div className="su-note su-mt-16">
      <b>Not in this plan — still required to graduate:</b>
      <ul style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.7 }}>
        {bundles.flatMap(b =>
          b.members.map(m => (
            <li key={m.courseCode}>
              <b>{m.courseCode}</b>{' '}
              <span className={`su-badge ${b.carriedReason === 'still_predicted_fail' ? 'danger' : 'info'}`}>
                {REASON_LABEL[b.carriedReason ?? 'still_predicted_fail']}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
