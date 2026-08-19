// AI Features Blueprint §2/§3.2 — advisor-level monitoring of "organic"
// Collider project groups on this advisor's roster, matched against a
// curated table of internships/grants/research fairs. No student-facing
// creation/matching UI in this cut — see seedColliderProjects.ts's header.
import { useEffect, useState } from 'react';
import { api, ColliderProjectDTO } from '../api/client';
import { OpportunityMatch } from '@advisor/shared';
import { useAuth } from '../auth/AuthContext';
import { Loading, Section, Empty } from '../portal/ui/Primitives';

const STAGE_LABEL: Record<string, string> = { idea: 'Idea', forming_team: 'Forming team', active: 'Active', matched_externally: 'Matched externally', archived: 'Archived' };
const STAGE_TONE: Record<string, 'neutral' | 'warn' | 'ok' | 'info'> = { idea: 'neutral', forming_team: 'warn', active: 'ok', matched_externally: 'info', archived: 'neutral' };

function OpportunityMatches({ projectId }: { projectId: string }) {
  const [matches, setMatches] = useState<OpportunityMatch[] | null>(null);
  useEffect(() => { api.colliderOpportunityMatches(projectId).then(setMatches); }, [projectId]);
  if (!matches) return <div className="su-muted" style={{ fontSize: 12 }}>Checking opportunity matches…</div>;
  if (matches.length === 0) return <div className="su-muted" style={{ fontSize: 12 }}>No matching internships, grants, or research fairs right now.</div>;
  return (
    <div className="su-flex" style={{ flexDirection: 'column', gap: 6, marginTop: 8 }}>
      {matches.map(m => (
        <div key={m.opportunity.id} className="su-flex su-justify-between su-items-center" style={{ fontSize: 12.5 }}>
          <span><b>{m.opportunity.title}</b> — {m.opportunity.organization} <span className="su-muted">({m.opportunity.kind.replace('_', ' ')})</span></span>
          <span className="su-badge info">{Math.round(m.matchScore * 100)}% match</span>
        </div>
      ))}
    </div>
  );
}

export function AdvisorColliderBoard() {
  const { auth } = useAuth();
  const advisorId = auth?.role === 'advisor' ? auth.advisorId : undefined;
  const [projects, setProjects] = useState<ColliderProjectDTO[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (advisorId) api.advisorColliderProjects(advisorId).then(setProjects);
  }, [advisorId]);

  if (!projects) return <Loading label="Loading organic project groups…" />;

  return (
    <Section
      eyebrow="Project Collider"
      title="Organic project groups on your roster"
      subtitle="Student-formed project teams, matched against curated internships, grants, and research fairs."
    >
      {projects.length === 0 ? (
        <Empty>No active project groups on your roster right now.</Empty>
      ) : (
        <div className="su-flex" style={{ flexDirection: 'column', gap: 12 }}>
          {projects.map(p => {
            const facultiesRepresented = new Set(p.members.map(m => m.facultyId));
            const isCrossFaculty = facultiesRepresented.size > 1;
            return (
              <div key={p.id} className="su-card" style={{ padding: 16, cursor: 'pointer' }} onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                <div className="su-flex su-justify-between su-items-center" style={{ flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div className="su-title" style={{ fontSize: 15 }}>{p.title}</div>
                    <div className="su-muted" style={{ fontSize: 12.5, marginTop: 2 }}>{p.description}</div>
                  </div>
                  <div className="su-flex su-gap-8">
                    {isCrossFaculty && <span className="su-badge accent">Cross-faculty</span>}
                    <span className={`su-badge ${STAGE_TONE[p.stage]}`}>{STAGE_LABEL[p.stage]}</span>
                  </div>
                </div>
                <div className="su-flex su-gap-8" style={{ flexWrap: 'wrap', marginTop: 10 }}>
                  {p.skills.map(s => <span key={s} className="su-badge neutral">{s}</span>)}
                </div>
                <div className="su-muted" style={{ fontSize: 12, marginTop: 10 }}>
                  Team: {p.members.map(m => `${m.name}${m.isCollaborator ? ` (${m.departmentId})` : ''}`).join(', ')}
                </div>
                {p.fundingAllocations.length > 0 && (
                  <div className="su-muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Funded: {p.fundingAllocations.reduce((s, f) => s + f.amount, 0).toLocaleString()} EGP across {p.fundingAllocations.length} allocation{p.fundingAllocations.length === 1 ? '' : 's'}
                  </div>
                )}
                {expanded === p.id && <OpportunityMatches projectId={p.id} />}
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}
