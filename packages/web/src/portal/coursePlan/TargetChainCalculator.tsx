// The "chain calculation" the Target CGPA tab was missing: instead of one
// flat "you need X average from here on" number, this breaks the remaining
// credits into semester-by-semester rows and lets the student type a
// hypothetical GPA for each one — the running cumulative CGPA and the
// "still-needed average for what's left" recompute live as a real chain,
// each row depending on every row before it. Every number is derived from
// the student's own real current CGPA + completed credits; the only
// assumption is an even ~18-credit-per-semester pace for how many semesters
// remain, which is editable.
import { useMemo, useState } from 'react';

function requiredAverage(target: number, currentCgpa: number, completedCredits: number, remainingCredits: number): number {
  if (remainingCredits <= 0) return 0;
  const requiredPoints = target * (completedCredits + remainingCredits) - currentCgpa * completedCredits;
  return requiredPoints / remainingCredits;
}

export function TargetChainCalculator({
  currentCgpa,
  completedCredits,
  totalDegreeCredits = 160,
}: {
  currentCgpa: number;
  completedCredits: number | null;
  totalDegreeCredits?: number;
}) {
  const [target, setTarget] = useState('3.00');
  const [creditsPerSemester, setCreditsPerSemester] = useState('18');
  const completed = completedCredits ?? 0;
  const remainingTotal = Math.max(0, totalDegreeCredits - completed);
  const perSemester = Math.max(1, Number(creditsPerSemester) || 18);
  const semesterCount = Math.max(1, Math.ceil(remainingTotal / perSemester));

  const flatRequired = useMemo(
    () => requiredAverage(Number(target), currentCgpa, completed, remainingTotal),
    [target, currentCgpa, completed, remainingTotal]
  );

  const [rowGpas, setRowGpas] = useState<Record<number, string>>({});

  const rows = useMemo(() => {
    let runningQualityPoints = currentCgpa * completed;
    let runningCredits = completed;
    const out: Array<{ i: number; credits: number; assumed: number; cumulativeCgpa: number; stillNeededAvg: number }> = [];
    for (let i = 0; i < semesterCount; i++) {
      const creditsThis = Math.min(perSemester, totalDegreeCredits - runningCredits);
      const assumed = Number(rowGpas[i] ?? flatRequired.toFixed(2));
      runningQualityPoints += assumed * creditsThis;
      runningCredits += creditsThis;
      const cumulativeCgpa = runningCredits > 0 ? runningQualityPoints / runningCredits : 0;
      const remainingAfter = totalDegreeCredits - runningCredits;
      const stillNeededAvg = requiredAverage(Number(target), cumulativeCgpa, runningCredits, remainingAfter);
      out.push({ i, credits: creditsThis, assumed, cumulativeCgpa, stillNeededAvg });
    }
    return out;
  }, [semesterCount, perSemester, completed, currentCgpa, rowGpas, flatRequired, target, totalDegreeCredits]);

  const targetNum = Number(target);
  const alreadyThere = currentCgpa >= targetNum;

  return (
    <div className="su-card su-mt-16">
      <div className="su-title" style={{ fontSize: 16 }}>Target CGPA Chain</div>
      <div className="su-subtitle">
        See the semester-by-semester GPA you'd need to actually land on your target by graduation — edit any
        semester's assumed GPA and the rest of the chain recalculates.
      </div>

      <div className="su-flex su-gap-14 su-mt-16" style={{ flexWrap: 'wrap' }}>
        <div className="su-field">
          <label>Target CGPA</label>
          <input className="su-input" type="number" step="0.01" min="0" max="4" value={target} onChange={e => setTarget(e.target.value)} style={{ width: 90 }} />
        </div>
        <div className="su-field">
          <label>Assumed credits / semester</label>
          <input className="su-input" type="number" min="1" max="24" value={creditsPerSemester} onChange={e => setCreditsPerSemester(e.target.value)} style={{ width: 90 }} />
        </div>
        <div className="su-field">
          <label>Remaining credits</label>
          <div style={{ padding: '9px 0', fontWeight: 700 }}>{remainingTotal} of {totalDegreeCredits}</div>
        </div>
      </div>

      {alreadyThere ? (
        <div className="su-note good su-mt-16">
          Your current CGPA ({currentCgpa.toFixed(2)}) is already at or above the {targetNum.toFixed(2)} target.
        </div>
      ) : remainingTotal === 0 ? (
        <div className="su-note su-mt-16">No credits remaining to plan against.</div>
      ) : (
        <>
          <div className="su-note su-mt-16">
            Flat pace: averaging <b>{flatRequired.toFixed(2)}</b> across all {semesterCount} remaining semesters gets
            you to {targetNum.toFixed(2)}. Adjust any row below to see how falling short (or exceeding it) early
            changes what's needed later.
          </div>
          <div className="su-table-wrap su-mt-16">
            <table className="su-table">
              <thead>
                <tr>
                  <th>Semester</th>
                  <th>Credits</th>
                  <th>Assumed GPA</th>
                  <th>Cumulative CGPA</th>
                  <th>Still needed after this</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.i}>
                    <td>+{r.i + 1}</td>
                    <td className="su-muted">{r.credits}</td>
                    <td>
                      <input
                        className="su-input"
                        type="number"
                        step="0.01"
                        min="0"
                        max="4"
                        style={{ width: 80 }}
                        value={rowGpas[r.i] ?? flatRequired.toFixed(2)}
                        onChange={e => setRowGpas({ ...rowGpas, [r.i]: e.target.value })}
                      />
                    </td>
                    <td style={{ fontWeight: 700, color: r.cumulativeCgpa >= targetNum ? 'var(--su-good)' : 'var(--su-warn)' }}>
                      {r.cumulativeCgpa.toFixed(2)}
                    </td>
                    <td className="su-muted">{r.i === rows.length - 1 ? '—' : r.stillNeededAvg.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
