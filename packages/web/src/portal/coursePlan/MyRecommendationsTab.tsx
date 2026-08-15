// Re-themed §15.3.2 step 3 — "My Recommendations": dual-approval proposal
// review (system suggestion vs. advisor's alternate, side by side). Same
// logic as the original PortalRecommendations.tsx, just su-* chrome and
// folded in as a Course Plan sub-tab instead of its own top-level nav item,
// since the new topbar only has room for the five tabs the mockups show.
import { useEffect, useState } from 'react';
import { api, CourseProposalDTO, RegisteredCourseDTO } from '../../api/client';
import { letterClass } from '../lib/studentUiHelpers';
import { Empty, Loading } from '../ui/Primitives';

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

function OptionCard({ proposal, label, onChoose, busy }: { proposal: CourseProposalDTO; label: string; onChoose: () => void; busy: boolean }) {
  const isFinal = proposal.status === 'registered';
  return (
    <div className="su-card" style={{ flex: 1, minWidth: 220 }}>
      <div className="su-eyebrow">{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, margin: '4px 0 10px' }}>{proposal.courseCode}</div>
      <div className="su-flex su-gap-18" style={{ marginBottom: 10 }}>
        <div>
          <div className="su-stat-label">Expected</div>
          <div className={letterClass(proposal.expectedLetter)} style={{ fontSize: 20, fontWeight: 800 }}>{proposal.expectedLetter}</div>
        </div>
        <div>
          <div className="su-stat-label">Best case</div>
          <div className={letterClass(proposal.bestCaseLetter)} style={{ fontSize: 20, fontWeight: 800 }}>{proposal.bestCaseLetter}</div>
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        {proposal.advisorApproved ? <span className="su-badge ok">advisor-approved</span> : <span className="su-badge warn">not yet approved</span>}
        {isFinal && <span className="su-badge ok" style={{ marginLeft: 6 }}>registered</span>}
      </div>
      {!isFinal && <button className="su-btn su-btn-sm" disabled={busy} onClick={onChoose}>Choose this course</button>}
    </div>
  );
}

export function MyRecommendationsTab({ studentId }: { studentId: string }) {
  const [proposals, setProposals] = useState<CourseProposalDTO[] | null>(null);
  const [impact, setImpact] = useState<{ expectedProjectedCGPA: number; bestCaseProjectedCGPA: number } | null>(null);
  const [registered, setRegistered] = useState<RegisteredCourseDTO[]>([]);
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [contactPopup, setContactPopup] = useState<string | null>(null);

  const load = () => {
    api.getProposals(studentId).then(r => {
      setProposals(r.proposals);
      setImpact({ expectedProjectedCGPA: r.expectedProjectedCGPA, bestCaseProjectedCGPA: r.bestCaseProjectedCGPA });
    });
    api.registeredCourses(studentId).then(setRegistered);
  };

  useEffect(load, [studentId]);

  if (!proposals) return <Loading />;

  const choose = async (proposal: CourseProposalDTO) => {
    setBusySlot(proposal.slotKey);
    try {
      const result = await api.chooseProposal(studentId, proposal.id);
      if (result.requiresAdvisorContact) setContactPopup(proposal.courseCode);
      else load();
    } finally {
      setBusySlot(null);
    }
  };

  const slots = groupBySlot(proposals);

  return (
    <div className="su-fade">
      <div className="su-subtitle" style={{ marginBottom: 16 }}>
        Your advisor may approve the system's suggestion as-is, or propose a different course. Pick the option you
        want — if it's already advisor-approved, it registers right away.
      </div>
      {impact && (
        <div className="su-stat-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(160px,1fr))', marginBottom: 18 }}>
          <div className="su-stat-card"><div className="su-stat-label">Expected CGPA</div><div className="su-stat-value">{impact.expectedProjectedCGPA.toFixed(2)}</div></div>
          <div className="su-stat-card"><div className="su-stat-label">At your best</div><div className="su-stat-value" style={{ color: 'var(--su-good)' }}>{impact.bestCaseProjectedCGPA.toFixed(2)}</div></div>
        </div>
      )}

      {slots.length === 0 && <Empty>No recommendations yet — generate a plan and submit it to your advisor first.</Empty>}

      <div className="su-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {slots.map(slot => (
          <div key={slot.slotKey} className="su-flex su-gap-14" style={{ flexWrap: 'wrap' }}>
            {slot.system && <OptionCard proposal={slot.system} label="System suggestion" onChoose={() => choose(slot.system!)} busy={busySlot === slot.slotKey} />}
            {slot.advisor && <OptionCard proposal={slot.advisor} label="Advisor suggestion" onChoose={() => choose(slot.advisor!)} busy={busySlot === slot.slotKey} />}
          </div>
        ))}
      </div>

      {registered.length > 0 && (
        <div className="su-card su-mt-16">
          <div className="su-title" style={{ fontSize: 15 }}>Registered for Next Semester</div>
          <div className="su-flex su-gap-8 su-mt-16" style={{ flexWrap: 'wrap' }}>
            {registered.map(r => <span className="su-badge ok" key={r.proposalId}>{r.courseCode}</span>)}
          </div>
        </div>
      )}

      {contactPopup && (
        <div className="su-modal-overlay" role="dialog">
          <div className="su-card su-modal">
            <div className="su-title">Advisor approval needed</div>
            <div className="su-subtitle">
              <b>{contactPopup}</b> hasn't been approved by your advisor yet. Please contact your advisor to review
              and approve this course before it can be registered.
            </div>
            <button className="su-btn su-mt-16" onClick={() => setContactPopup(null)}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}
