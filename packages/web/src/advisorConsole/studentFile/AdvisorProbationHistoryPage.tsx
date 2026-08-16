// "Probation History" sub-tab — timeline of ProbationCounterLog entries,
// restyled from the old ProbationHistory.tsx.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { ProbationCounterLogEntry } from '@advisor/shared';
import { Loading } from '../../portal/ui/Primitives';

const REASON_TEXT: Record<ProbationCounterLogEntry['reason'], (e: ProbationCounterLogEntry) => string> = {
  increment_low_cgpa: e => `CGPA stayed below 2.00 → warning ${e.previousCount}/6 → ${e.newCount}/6`,
  reset_recovered: () => `CGPA recovered to 2.00 or above → warning reset to 0/6 (mid-window recovery)`,
  reset_faculty_transfer: () => `Faculty transfer executed → warning counter reset to 0/6`,
  unchanged_internal_transfer: e => `Internal department transfer executed → warning counter unchanged at ${e.newCount}/6`,
  not_armed_first_semester: () => `First semester on record — never counted toward the warning ladder, regardless of GPA`,
};

export function AdvisorProbationHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{ count: number; armed: boolean; history: ProbationCounterLogEntry[] } | null>(null);

  useEffect(() => { if (id) api.probation(id).then(setData); }, [id]);

  if (!id) return null;
  if (!data) return <Loading label="Loading probation history…" />;

  return (
    <div className="su-card su-fade">
      <div className="su-flex su-justify-between su-items-center" style={{ marginBottom: 16 }}>
        <div className="su-title" style={{ fontSize: 16 }}>Probation History</div>
        <span className={`su-badge ${data.count >= 3 ? 'danger' : data.count > 0 ? 'warn' : 'ok'}`}>{data.count} / 6 · {data.armed ? 'armed' : 'not yet armed'}</span>
      </div>
      {data.history.length === 0 ? (
        <div className="su-muted">No probation events on record.</div>
      ) : (
        <div style={{ borderLeft: '2px solid var(--su-border)', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {data.history.map((e, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: -23, top: 4, width: 9, height: 9, borderRadius: '50%', background: 'var(--su-accent)' }} />
              <div className="su-muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Semester {e.semesterId}</div>
              <div style={{ marginTop: 2 }}>{REASON_TEXT[e.reason](e)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
