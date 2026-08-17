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
  const [showFinalPlan, setShowFinalPlan] = useState(false);

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
  const approveAll = async () => {
    setBusySlot('__approve_all__');
    setError(null);
    try {
      const r = await api.approveAllProposals(studentId);
      setProposals(r.proposals);
      setImpact({ expectedProjectedCGPA: r.expectedProjectedCGPA, bestCaseProjectedCGPA: r.bestCaseProjectedCGPA });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusySlot(null);
    }
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
  // A slot is "still pending" once its final word — the advisor's alternate
  // if there is one, otherwise the system's own proposal — hasn't been
  // approved yet. That's exactly the set §15.3.2 step 3 sends to the
  // "contact your advisor" prompt when the student tries to register it.
  const finalForSlot = (slot: Slot) => slot.advisor ?? slot.system;
  const pendingSlots = slots.filter(s => finalForSlot(s)?.status === 'pending');
  // "Approve all" only ever touches system proposals the advisor hasn't
  // already overridden with their own alternate — count that subset so the
  // button can honestly say how many it's about to approve, and hide once
  // there's nothing left for it to do.
  const bulkApprovableCount = slots.filter(s => !s.advisor && s.system?.status === 'pending').length;

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
          <div className="su-flex su-gap-8" style={{ flexWrap: 'wrap' }}>
            {bulkApprovableCount > 0 && (
              <button className="su-btn su-btn-sm su-btn-secondary" disabled={busySlot === '__approve_all__'} onClick={approveAll}>
                Approve all ({bulkApprovableCount})
              </button>
            )}
            <button className="su-btn su-btn-sm" disabled={busySlot === '__generate__'} onClick={generate}>
              {proposals.length === 0 ? 'Generate proposals from plan' : 'Refresh from latest plan'}
            </button>
          </div>
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
              {slot.system && (
                <div className="su-muted" style={{ fontSize: 12.5, marginBottom: 10 }}>
                  <b>{slot.system.courseCode}</b> is already recommended by the system for this slot — it's excluded
                  from the list below{slot.system.status === 'pending'
                    ? ' (approve it above instead of re-proposing it)'
                    : ` (already ${slot.system.status.replace('_', ' ')} above)`}; pick a genuinely different course
                  here only if you want to override it.
                </div>
              )}
              <div className="su-flex su-gap-10 su-items-center" style={{ flexWrap: 'wrap' }}>
                <div className="su-field" style={{ flex: 1, minWidth: 220 }}>
                  <label>Propose alternate</label>
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
                const bestCaseDelta = recommended ? p.bestCasePoints - recommended.bestCasePoints : null;
                const deltaTone = delta === null ? 'neutral' : delta > 0 ? 'ok' : delta < 0 ? 'danger' : 'neutral';
                const deltaLabel = delta === null ? null : delta === 0 ? 'no change' : `${delta > 0 ? '+' : ''}${delta.toFixed(2)} grade points`;
                const bestCaseDeltaLabel = bestCaseDelta === null ? null : bestCaseDelta === 0 ? 'no change' : `${bestCaseDelta > 0 ? '+' : ''}${bestCaseDelta.toFixed(2)} grade points`;
                return (
                  <div className="su-note su-mt-16">
                    <b>{p.courseCode}</b> expected grade: <span className={letterClass(p.expectedLetter)}>{p.expectedLetter} ({p.expectedPct.toFixed(1)}%)</span>
                    {' · '}best case: <span className={letterClass(p.bestCaseLetter)}>{p.bestCaseLetter} ({p.bestCasePct.toFixed(1)}%)</span>
                    {recommended && (
                      <div className="su-mt-16" style={{ marginTop: 6 }}>
                        How this changes the student's registered/recommended course versus the system's <b>{recommended.courseCode}</b>{' '}
                        (<span className={letterClass(recommended.expectedLetter)}>{recommended.expectedLetter}</span>):
                        <div className="su-flex su-gap-8 su-items-center" style={{ marginTop: 4, flexWrap: 'wrap' }}>
                          <span className="su-muted" style={{ fontSize: 12 }}>Expected:</span>
                          <span className={`su-badge ${deltaTone}`}>{deltaLabel}</span>
                          <span className="su-muted" style={{ fontSize: 12 }}>Best case:</span>
                          <span className={`su-badge ${bestCaseDelta === null ? 'neutral' : bestCaseDelta > 0 ? 'ok' : bestCaseDelta < 0 ? 'danger' : 'neutral'}`}>{bestCaseDeltaLabel}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      ))}

      {slots.length > 0 && (
        <div className="su-card su-mt-16">
          <div className="su-flex su-justify-between su-items-center" style={{ flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div className="su-title" style={{ fontSize: 15 }}>Modified Plan</div>
              <div className="su-subtitle" style={{ marginTop: 4 }}>
                {pendingSlots.length === 0
                  ? "Every slot has a decision — this is the plan the student will see."
                  : `${pendingSlots.length} of ${slots.length} slot${slots.length === 1 ? '' : 's'} ${pendingSlots.length === 1 ? 'is' : 'are'} still unreviewed — the student will be asked to contact you if they try to register ${pendingSlots.length === 1 ? 'it' : 'them'} before you decide.`}
              </div>
            </div>
            <button className="su-btn su-btn-sm su-btn-secondary" onClick={() => setShowFinalPlan(!showFinalPlan)}>
              {showFinalPlan ? 'Hide' : 'Activate'} modified plan
            </button>
          </div>

          {showFinalPlan && (
            <>
              <div className="su-table-wrap su-mt-16">
                <table className="su-table">
                  <thead><tr><th>Slot</th><th>Course the student will receive</th><th>Source</th><th>Status</th></tr></thead>
                  <tbody>
                    {slots.map(slot => {
                      const final = finalForSlot(slot);
                      const isPending = final?.status === 'pending';
                      return (
                        <tr key={slot.slotKey}>
                          <td className="su-muted">{slot.slotKey}</td>
                          <td><b>{final?.courseCode ?? '—'}</b></td>
                          <td className="su-muted">{slot.advisor ? 'Advisor alternate' : 'System recommendation'}</td>
                          <td>{isPending ? <span className="su-badge warn">Not yet approved</span> : <span className="su-badge ok">{final?.status}</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {pendingSlots.length > 0 && (
                <div className="su-note warn su-mt-16">
                  <b>{pendingSlots.map(s => s.slotKey).join(', ')}</b> — not yet approved. If the student tries to
                  register {pendingSlots.length === 1 ? 'this course' : 'these courses'} first, they'll be shown a
                  "contact your advisor" notice instead of registering automatically (§15.3.2 step 3) — approve or
                  propose an alternate above to clear it.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
