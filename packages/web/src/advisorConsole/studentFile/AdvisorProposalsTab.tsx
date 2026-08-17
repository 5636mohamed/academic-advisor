// "Proposals" mode — the advisor's own §15.3 review capability (approve
// the system's suggestion, decline it, or propose a different course,
// scored live before confirming). This is genuinely different from the
// student portal's read-only "choose between what's on offer" tab — this
// is where courses GET advisor-approved in the first place. Carried over
// from the old ProposalReview.tsx with su-* styling; percentages are shown
// throughout, same as every other advisor screen.
import { useEffect, useState } from 'react';
import { api, AlternateScorePreviewDTO, CourseProposalDTO, EligibleCourseDTO } from '../../api/client';
import { letterClass } from '../../portal/lib/studentUiHelpers';
import { Loading } from '../../portal/ui/Primitives';

interface Slot { slotKey: string; system?: CourseProposalDTO; advisor?: CourseProposalDTO }

function groupBySlot(proposals: CourseProposalDTO[]): Slot[] {
  const bySlot = new Map<string, Slot>();
  for (const p of proposals) {
    if (p.status === 'declined') continue;
    const slot = bySlot.get(p.slotKey) ?? { slotKey: p.slotKey };
    if (p.origin === 'system') slot.system = p;
    else slot.advisor = p;
    bySlot.set(p.slotKey, slot);
  }
  return [...bySlot.values()];
}

export function AdvisorProposalsTab({ studentId }: { studentId: string }) {
  const [proposals, setProposals] = useState<CourseProposalDTO[] | null>(null);
  const [impact, setImpact] = useState<{ expectedProjectedCGPA: number; bestCaseProjectedCGPA: number } | null>(null);
  const [eligible, setEligible] = useState<EligibleCourseDTO[]>([]);
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [altPicker, setAltPicker] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Record<string, AlternateScorePreviewDTO | null>>({});
  const [previewSlot, setPreviewSlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api.getProposals(studentId).then(r => {
      setProposals(r.proposals);
      setImpact({ expectedProjectedCGPA: r.expectedProjectedCGPA, bestCaseProjectedCGPA: r.bestCaseProjectedCGPA });
    });
    api.getEligibleCourses(studentId).then(setEligible);
  };

  useEffect(load, [studentId]);

  if (!proposals) return <Loading />;

  const generate = async () => {
    setBusySlot('__generate__');
    setError(null);
    try {
      const r = await api.generateProposals(studentId);
      setProposals(r.proposals);
      setImpact({ expectedProjectedCGPA: r.expectedProjectedCGPA, bestCaseProjectedCGPA: r.bestCaseProjectedCGPA });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusySlot(null);
    }
  };

  const approve = async (proposalId: string) => {
    setBusySlot(proposalId);
    try { await api.approveProposal(proposalId); load(); } finally { setBusySlot(null); }
  };
  const decline = async (proposalId: string) => {
    setBusySlot(proposalId);
    try { await api.declineProposal(proposalId); load(); } finally { setBusySlot(null); }
  };
  const proposeAlternate = async (slotKey: string) => {
    const courseCode = altPicker[slotKey];
    if (!courseCode) return;
    setBusySlot(slotKey);
    setError(null);
    try { await api.proposeAlternate(studentId, slotKey, courseCode); setPreview({ ...preview, [slotKey]: null }); load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusySlot(null); }
  };
  const pickAlternate = async (slotKey: string, courseCode: string) => {
    setAltPicker({ ...altPicker, [slotKey]: courseCode });
    setPreview({ ...preview, [slotKey]: null });
    if (!courseCode) return;
    setPreviewSlot(slotKey);
    try { setPreview(p => ({ ...p, [slotKey]: null })); const result = await api.previewAlternate(studentId, slotKey, courseCode); setPreview(p => ({ ...p, [slotKey]: result })); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setPreviewSlot(null); }
  };

  const slots = groupBySlot(proposals);

  return (
    <div className="su-fade">
      <div className="su-card">
        <div className="su-flex su-justify-between su-items-center" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="su-title" style={{ fontSize: 16 }}>Course Proposals — Advisor Review</div>
            <div className="su-subtitle" style={{ marginTop: 4 }}>
              Approve the system's suggestion as-is, or propose a different course — its expected and best-case
              grades are computed live before you confirm.
            </div>
          </div>
          <button className="su-btn su-btn-sm" disabled={busySlot === '__generate__'} onClick={generate}>
            {proposals.length === 0 ? 'Generate proposals from plan' : 'Refresh from latest plan'}
          </button>
        </div>
        {error && <div className="su-note danger su-mt-16">{error}</div>}
        {impact && (
          <div className="su-stat-grid su-mt-16" style={{ gridTemplateColumns: 'repeat(2, minmax(160px,1fr))' }}>
            <div className="su-stat-card"><div className="su-stat-label">Expected CGPA (this plan)</div><div className="su-stat-value">{impact.expectedProjectedCGPA.toFixed(2)}</div></div>
            <div className="su-stat-card"><div className="su-stat-label">Best-case CGPA (peak performance)</div><div className="su-stat-value" style={{ color: 'var(--su-good)' }}>{impact.bestCaseProjectedCGPA.toFixed(2)}</div></div>
          </div>
        )}
      </div>

      {slots.length === 0 && proposals.length === 0 && (
        <div className="su-empty su-mt-16">No proposals yet — click "Generate proposals from plan" above.</div>
      )}

      {slots.map(slot => (
        <div className="su-card su-mt-16" key={slot.slotKey}>
          <div className="su-title" style={{ fontSize: 15 }}>{slot.slotKey}</div>
          <div className="su-table-wrap su-mt-16">
            <table className="su-table">
              <thead><tr><th>Source</th><th>Course</th><th>Expected</th><th>Best case</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {slot.system && (
                  <tr>
                    <td className="su-muted">System</td>
                    <td><b>{slot.system.courseCode}</b></td>
                    <td className={letterClass(slot.system.expectedLetter)}>{slot.system.expectedLetter} ({slot.system.expectedPct.toFixed(1)}%)</td>
                    <td className={letterClass(slot.system.bestCaseLetter)}>{slot.system.bestCaseLetter} ({slot.system.bestCasePct.toFixed(1)}%)</td>
                    <td><span className={`su-badge ${slot.system.status === 'advisor_approved' || slot.system.status === 'registered' ? 'ok' : 'neutral'}`}>{slot.system.status}</span></td>
                    <td>
                      {slot.system.status === 'pending' && (
                        <div className="su-flex su-gap-8">
                          <button className="su-btn su-btn-sm su-btn-secondary" disabled={busySlot === slot.system.id} onClick={() => approve(slot.system!.id)}>Approve</button>
                          <button className="su-btn su-btn-sm su-btn-ghost" disabled={busySlot === slot.system.id} onClick={() => decline(slot.system!.id)}>Decline</button>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
                {slot.advisor && (
                  <tr>
                    <td className="su-muted">Advisor</td>
                    <td><b>{slot.advisor.courseCode}</b></td>
                    <td className={letterClass(slot.advisor.expectedLetter)}>{slot.advisor.expectedLetter} ({slot.advisor.expectedPct.toFixed(1)}%)</td>
                    <td className={letterClass(slot.advisor.bestCaseLetter)}>{slot.advisor.bestCaseLetter} ({slot.advisor.bestCasePct.toFixed(1)}%)</td>
                    <td><span className="su-badge ok">advisor_approved</span></td>
                    <td></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {!slot.advisor && (
            <div className="su-mt-16">
              <div className="su-flex su-gap-10 su-items-center" style={{ flexWrap: 'wrap' }}>
                <div className="su-field" style={{ flex: 1, minWidth: 220 }}>
                  <label>Propose alternate</label>
                  {/* The system's own recommendation for this slot is deliberately
                      excluded here — proposing it back as an "alternate" isn't a
                      real alternative, and Approve above already covers that case.
                      (Backend still rejects it too, in case of a stale course list.) */}
                  <select className="su-input" value={altPicker[slot.slotKey] ?? ''} onChange={e => pickAlternate(slot.slotKey, e.target.value)}>
                    <option value="">Choose a course…</option>
                    {eligible.filter(e => e.course.code !== slot.system?.courseCode).map(e => <option key={e.course.code} value={e.course.code}>{e.course.code} — {e.course.name}</option>)}
                  </select>
                </div>
                <button className="su-btn su-btn-sm" style={{ alignSelf: 'flex-end' }} disabled={busySlot === slot.slotKey || !altPicker[slot.slotKey]} onClick={() => proposeAlternate(slot.slotKey)}>Propose</button>
              </div>

              {previewSlot === slot.slotKey && <div className="su-muted su-mt-16">Scoring {altPicker[slot.slotKey]} live…</div>}

              {preview[slot.slotKey] && (() => {
                const p = preview[slot.slotKey]!;
                const recommended = slot.system;
                const delta = recommended ? p.expectedPoints - recommended.expectedPoints : null;
                const deltaTone = delta === null ? 'neutral' : delta > 0 ? 'ok' : delta < 0 ? 'danger' : 'neutral';
                const deltaLabel = delta === null ? null : delta === 0 ? 'no change' : `${delta > 0 ? '+' : ''}${delta.toFixed(2)} grade points`;
                return (
                  <div className="su-note su-mt-16">
                    <b>{p.courseCode}</b> expected grade: <span className={letterClass(p.expectedLetter)}>{p.expectedLetter} ({p.expectedPct.toFixed(1)}%)</span>
                    {' · '}best case: <span className={letterClass(p.bestCaseLetter)}>{p.bestCaseLetter} ({p.bestCasePct.toFixed(1)}%)</span>
                    {recommended && (
                      <div className="su-mt-16" style={{ marginTop: 6 }}>
                        Consequence of choosing this instead of the recommended <b>{recommended.courseCode}</b>{' '}
                        (<span className={letterClass(recommended.expectedLetter)}>{recommended.expectedLetter}</span>):{' '}
                        <span className={`su-badge ${deltaTone}`}>{deltaLabel}</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
