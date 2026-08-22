// "Venture board" tab — Venture-board.pdf. §16.5: every matched project for
// this Level-3+ student, ranked, plus the §16.1 Venture Gate/Interest Form
// (now reachable both inline and through the "Discover venture" step
// wizard). Stat cards, "recent activity" and "my ventures" are all derived
// live from the real VentureMatchResultDTO[] — nothing here is a canned
// number; a status this app has no data for (the mockup's "Collaborators"
// count) was dropped rather than invented.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, VentureMatchResultDTO } from '../api/client';
import { IconClock, IconPaperPlane, IconPeople, IconPerson, IconPlus, IconTrendUp } from './ui/Icons';
import { Empty, Loading } from './ui/Primitives';
import { DiscoverVentureWizard } from './venture/DiscoverVentureWizard';
import { VentureProjectCard } from './venture/VentureProjectCard';

export function PortalVentureBoard() {
  const { id } = useParams<{ id: string }>();
  const [level, setLevel] = useState<number | null>(null);
  const [matches, setMatches] = useState<VentureMatchResultDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);

  const load = () => {
    if (id) api.ventureMatches(id).then(setMatches).catch(e => setError(e instanceof Error ? e.message : String(e)));
  };

  useEffect(() => {
    if (!id) return;
    api.getStudent(id).then(s => setLevel(s.level));
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!id) return null;
  if (level !== null && level < 3) return <Empty>Venture opportunities are only offered to Level 3+ students.</Empty>;
  if (matches === null) return <Loading label="Loading the venture board…" />;

  const accepted = matches.filter(m => m.status === 'accepted');
  const applied = matches.filter(m => m.status === 'applied' || m.status === 'accepted' || m.status === 'declined');
  const browseable = matches.filter(m => m.status !== 'accepted');
  const activity = matches
    .filter(m => m.status === 'applied' || m.status === 'accepted' || m.status === 'declined')
    .map(m => ({
      id: m.project.id,
      text:
        m.status === 'accepted' ? `Your application to ${m.project.title} was accepted` :
        m.status === 'declined' ? `Your application to ${m.project.title} was declined` :
        `You applied to ${m.project.title}`,
    }));

  const express = async (projectId: string, cv?: { fileName: string; dataUrl: string }) => {
    await api.expressInterestInProject(id, projectId, cv);
    load();
  };

  return (
    <div>
      <div className="su-flex su-justify-between su-items-center" style={{ marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="su-eyebrow">Innovation &amp; Venture Catalyst</div>
          <div className="su-title" style={{ fontSize: 24 }}>Venture Board</div>
        </div>
        <button className="su-btn" onClick={() => setWizardOpen(true)}><IconTrendUp width={15} height={15} /> Discover venture</button>
      </div>

      {error && <div className="su-note danger su-mt-16" style={{ marginTop: 0, marginBottom: 16 }}>{error}</div>}

      <div className="su-stat-grid su-stagger">
        <div className="su-stat-card su-stat-icon-card">
          <span className="su-stat-icon"><IconPerson width={18} height={18} /></span>
          <div><div className="su-stat-value">{accepted.length}</div><div className="su-stat-label" style={{ marginTop: 4 }}>Active Ventures</div></div>
        </div>
        <div className="su-stat-card su-stat-icon-card">
          <span className="su-stat-icon"><IconPaperPlane width={18} height={18} /></span>
          <div><div className="su-stat-value">{applied.length}</div><div className="su-stat-label" style={{ marginTop: 4 }}>Applications Sent</div></div>
        </div>
        <div className="su-stat-card su-stat-icon-card">
          <span className="su-stat-icon"><IconPeople width={18} height={18} /></span>
          <div><div className="su-stat-value">{accepted.length}</div><div className="su-stat-label" style={{ marginTop: 4 }}>Accepted Invites</div></div>
        </div>
        <div className="su-stat-card su-stat-icon-card">
          <span className="su-stat-icon"><IconTrendUp width={18} height={18} /></span>
          <div><div className="su-stat-value">{matches.length}</div><div className="su-stat-label" style={{ marginTop: 4 }}>Opportunities Available</div></div>
        </div>
      </div>

      <div className="su-two-col su-mt-16">
        <div className="su-card">
          <div className="su-title" style={{ fontSize: 15 }}>Recent activity</div>
          {activity.length === 0 ? (
            <div className="su-subtitle su-mt-16">No activity yet — express interest in a venture below to get started.</div>
          ) : (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {activity.slice(0, 6).map(a => (
                <div key={a.id} className="su-flex su-gap-10" style={{ alignItems: 'flex-start' }}>
                  <IconPaperPlane width={15} height={15} style={{ color: 'var(--su-info)', marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: 13 }}>{a.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="su-card">
          <div className="su-title" style={{ fontSize: 15 }}>Find ventures that match you</div>
          <div className="su-subtitle">Set your preferences to get ranked venture recommendations.</div>
          <div className="su-flex su-gap-10" style={{ marginTop: 14, alignItems: 'flex-start' }}>
            <IconClock width={16} height={16} style={{ color: 'var(--su-info)', marginTop: 2 }} />
            <div><b style={{ fontSize: 13 }}>Short and easy</b><div className="su-muted">A few quick questions</div></div>
          </div>
          <div className="su-flex su-gap-10" style={{ marginTop: 10, alignItems: 'flex-start' }}>
            <IconTrendUp width={16} height={16} style={{ color: 'var(--su-good-text)', marginTop: 2 }} />
            <div><b style={{ fontSize: 13 }}>Better opportunities</b><div className="su-muted">Find roles that match your goals</div></div>
          </div>
          <button className="su-btn su-btn-block su-mt-16" onClick={() => setWizardOpen(true)}>Discover venture</button>
        </div>
      </div>

      <div className="su-flex su-justify-between su-items-center su-mt-20" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="su-title" style={{ fontSize: 17 }}>My ventures</div>
          <div className="su-subtitle" style={{ margin: 0 }}>Ventures you are currently part of.</div>
        </div>
        <button className="su-btn su-btn-outline" onClick={() => setBrowseOpen(o => !o)}><IconPlus width={14} height={14} /> Join venture</button>
      </div>

      {accepted.length === 0 ? (
        <div className="su-empty su-mt-16">Not a member of any venture yet — express interest in one below.</div>
      ) : (
        <div className="su-stagger su-mt-16" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          {accepted.map(m => <VentureProjectCard key={m.project.id} match={m} onExpressInterest={express} />)}
        </div>
      )}

      {browseOpen && (
        <div className="su-card su-mt-16 su-pop">
          <div className="su-title" style={{ fontSize: 15 }}>All opportunities</div>
          {browseable.length === 0 ? (
            <div className="su-subtitle su-mt-16">No open projects right now — check back later.</div>
          ) : (
            <div className="su-stagger su-mt-16" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
              {browseable.map(m => <VentureProjectCard key={m.project.id} match={m} onExpressInterest={express} />)}
            </div>
          )}
        </div>
      )}

      {wizardOpen && <DiscoverVentureWizard studentId={id} onClose={() => { setWizardOpen(false); load(); }} />}
    </div>
  );
}
