// Spec §15.3 — the advisor's review screen: generate proposals from the
// current plan, approve them as-is, or propose an alternate course (scored
// live by the real engine before confirming). Percentages ARE shown here —
// this is the advisor view, not the student portal (§15.1's restriction is
// component-layer, only applied in packages/web/src/pages/Portal/*).
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, AlternateScorePreviewDTO, CourseProposalDTO, EligibleCourseDTO } from '../../api/client';
import { StudentNavTabs } from '../../components/StudentNavTabs';

interface Slot {
  slotKey: string;
  system?: CourseProposalDTO;
  advisor?: CourseProposalDTO;
}

const letterClass = (letter: string) => `letter-${letter.replace('+', 'p')}`;

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

export function ProposalReview() {
  const { id } = useParams<{ id: string }>();
  const [proposals, setProposals] = useState<CourseProposalDTO[]>([]);
  const [impact, setImpact] = useState<{ expectedProjectedCGPA: number; bestCaseProjectedCGPA: number } | null>(null);
  const [eligible, setEligible] = useState<EligibleCourseDTO[]>([]);
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [altPicker, setAltPicker] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Record<string, AlternateScorePreviewDTO | null>>({});
  const [previewSlot, setPreviewSlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!id) return;
    api.getProposals(id).then(r => {
      setProposals(r.proposals);
      setImpact({ expectedProjectedCGPA: r.expectedProjectedCGPA, bestCaseProjectedCGPA: r.bestCaseProjectedCGPA });
    });
    api.getEligibleCourses(id).then(setEligible);
  };

  useEffect(load, [id]);

  if (!id) return null;

  const generate = async () => {
    setBusySlot('__generate__');
    setError(null);
    try {
      const r = await api.generateProposals(id);
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
    try {
      await api.approveProposal(proposalId);
      load();
    } finally {
      setBusySlot(null);
    }
  };

  const decline = async (proposalId: string) => {
    setBusySlot(proposalId);
    try {
      await api.declineProposal(proposalId);
      load();
    } finally {
      setBusySlot(null);
    }
  };

  const proposeAlternate = async (slotKey: string) => {
    const courseCode = altPicker[slotKey];
    if (!courseCode) return;
    setBusySlot(slotKey);
    setError(null);
    try {
      await api.proposeAlternate(id, slotKey, courseCode);
      setPreview({ ...preview, [slotKey]: null });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusySlot(null);
    }
  };

  // Live dry-run scoring, before anything is committed — shows the advisor
  // the candidate's own expected/best-case grade AND, once rendered against
  // the system's originally recommended course below, the grade-point
  // consequence of swapping away from it.
  const pickAlternate = async (slotKey: string, courseCode: string) => {
    setAltPicker({ ...altPicker, [slotKey]: courseCode });
    setPreview({ ...preview, [slotKey]: null });
    if (!courseCode) return;
    setPreviewSlot(slotKey);
    try {
      const result = await api.previewAlternate(id, slotKey, courseCode);
      setPreview(p => ({ ...p, [slotKey]: result }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPreviewSlot(null);
    }
  };

  const slots = groupBySlot(proposals);

  return (
    <div>
      <StudentNavTabs id={id} />
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2>Course Proposals — Advisor Review</h2>
          <button disabled={busySlot === '__generate__'} onClick={generate}>
            {proposals.length === 0 ? 'Generate proposals from plan' : 'Refresh from latest plan'}
          </button>
        </div>
        <p className="sub">
          Approve the system's suggestion as-is, or propose a different course — its expected and best-case grades are
          computed live by the same engine before you confirm.
        </p>
        {error && <div className="note" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>{error}</div>}
        {impact && (
          <div className="stat-row">
            <div className="stat">
              <div className="label">Expected CGPA (this plan)</div>
              <div className="value">{impact.expectedProjectedCGPA.toFixed(2)}</div>
            </div>
            <div className="stat">
              <div className="label">Best-case CGPA (peak performance)</div>
              <div className="value">{impact.bestCaseProjectedCGPA.toFixed(2)}</div>
            </div>
          </div>
        )}
      </div>

      {slots.length === 0 && proposals.length === 0 && (
        <div className="empty-state">No proposals yet — click "Generate proposals from plan" above.</div>
      )}

      {slots.map(slot => (
        <div className="card" key={slot.slotKey}>
          <h3>{slot.slotKey}</h3>
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th>Course</th>
                <th>Expected</th>
                <th>Best case</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {slot.system && (
                <tr>
                  <td>System</td>
                  <td>{slot.system.courseCode}</td>
                  <td>{slot.system.expectedLetter} ({slot.system.expectedPct.toFixed(1)}%)</td>
                  <td>{slot.system.bestCaseLetter} ({slot.system.bestCasePct.toFixed(1)}%)</td>
                  <td><span className={`badge ${slot.system.status === 'advisor_approved' ? 'ok' : slot.system.status === 'registered' ? 'ok' : 'neutral'}`}>{slot.system.status}</span></td>
                  <td>
                    {slot.system.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="secondary" disabled={busySlot === slot.system.id} onClick={() => approve(slot.system!.id)}>
                          Approve
                        </button>
                        <button className="secondary" disabled={busySlot === slot.system.id} onClick={() => decline(slot.system!.id)}>
                          Decline
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )}
              {slot.advisor && (
                <tr>
                  <td>Advisor</td>
                  <td>{slot.advisor.courseCode}</td>
                  <td>{slot.advisor.expectedLetter} ({slot.advisor.expectedPct.toFixed(1)}%)</td>
                  <td>{slot.advisor.bestCaseLetter} ({slot.advisor.bestCasePct.toFixed(1)}%)</td>
                  <td><span className="badge ok">advisor_approved</span></td>
                  <td></td>
                </tr>
              )}
            </tbody>
          </table>
          {!slot.advisor && (
            <div style={{ marginTop: 10 }}>
              <div className="form-row">
                <label>Propose alternate:</label>
                <select value={altPicker[slot.slotKey] ?? ''} onChange={e => pickAlternate(slot.slotKey, e.target.value)}>
                  <option value="">Choose a course…</option>
                  {eligible.map(e => (
                    <option key={e.course.code} value={e.course.code}>
                      {e.course.code} — {e.course.name}
                    </option>
                  ))}
                </select>
                <button disabled={busySlot === slot.slotKey || !altPicker[slot.slotKey]} onClick={() => proposeAlternate(slot.slotKey)}>
                  Propose
                </button>
              </div>

              {previewSlot === slot.slotKey && <div className="muted">Scoring {altPicker[slot.slotKey]} live…</div>}

              {preview[slot.slotKey] && (() => {
                const p = preview[slot.slotKey]!;
                const recommended = slot.system; // the system's original recommendation for this slot
                const delta = recommended ? p.expectedPoints - recommended.expectedPoints : null;
                const deltaTone = delta === null ? 'neutral' : delta > 0 ? 'ok' : delta < 0 ? 'danger' : 'neutral';
                const deltaLabel = delta === null ? null : delta === 0 ? 'no change' : `${delta > 0 ? '+' : ''}${delta.toFixed(2)} grade points`;
                return (
                  <div className="note" style={{ marginTop: 8 }}>
                    <b>{p.courseCode}</b> expected grade:{' '}
                    <span className={letterClass(p.expectedLetter)}>{p.expectedLetter} ({p.expectedPct.toFixed(1)}%)</span>
                    {' · '}best case:{' '}
                    <span className={letterClass(p.bestCaseLetter)}>{p.bestCaseLetter} ({p.bestCasePct.toFixed(1)}%)</span>
                    {recommended && (
                      <div style={{ marginTop: 4 }}>
                        Consequence of choosing this instead of the recommended{' '}
                        <b>{recommended.courseCode}</b>{' '}
                        (<span className={letterClass(recommended.expectedLetter)}>{recommended.expectedLetter}</span>):{' '}
                        <span className={`badge ${deltaTone}`}>{deltaLabel}</span>
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
