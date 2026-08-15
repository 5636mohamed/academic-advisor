// Spec §10 step 7 — timeline of ProbationCounterLog entries, human-readable,
// so a student can see exactly why they're at their current count.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { ProbationCounterLogEntry } from '@advisor/shared';
import { StudentNavTabs } from '../../components/StudentNavTabs';
import { ProbationCounterPill } from '../../components/ProbationCounterPill';

const REASON_TEXT: Record<ProbationCounterLogEntry['reason'], (e: ProbationCounterLogEntry) => string> = {
  increment_low_cgpa: e => `CGPA stayed below 2.00 → warning ${e.previousCount}/6 → ${e.newCount}/6`,
  reset_recovered: e => `CGPA recovered to 2.00 or above → warning reset to 0/6 (mid-window recovery, §4.4)`,
  reset_faculty_transfer: () => `Faculty transfer executed → warning counter reset to 0/6 (§7.2.3)`,
  unchanged_internal_transfer: e => `Internal department transfer executed → warning counter unchanged at ${e.newCount}/6 (§7.1)`,
  not_armed_first_semester: () => `First semester on record — never counted toward the warning ladder, regardless of GPA (§4.5)`,
};

export function ProbationHistory() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{ count: number; armed: boolean; history: ProbationCounterLogEntry[] } | null>(null);

  useEffect(() => {
    if (id) api.probation(id).then(setData);
  }, [id]);

  if (!id) return null;

  return (
    <div>
      <StudentNavTabs id={id} />
      <div className="card">
        <h2>Probation History</h2>
        {data && (
          <p className="sub">
            Current: <ProbationCounterPill count={data.count} /> · {data.armed ? 'armed' : 'not yet armed'}
          </p>
        )}
        {!data && <div className="loading">Loading…</div>}
        {data && data.history.length === 0 && <div className="muted">No probation events on record.</div>}
        {data && data.history.length > 0 && (
          <div className="timeline">
            {data.history.map((e, i) => (
              <div className="timeline-item" key={i}>
                <div className="when">Semester {e.semesterId}</div>
                <div>{REASON_TEXT[e.reason](e)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
