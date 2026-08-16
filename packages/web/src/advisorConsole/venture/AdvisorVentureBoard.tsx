// "Venture board" tab — folds the old §16.6 Faculty Console's project
// management into the advisor console (product decision: every professor
// at E-JUST is also an academic advisor, so this capability belongs here
// too, reachable without a separate professor login). Lists every
// professor with their own project count; picking one manages their
// projects exactly like the old Faculty Console did.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ProfessorSummaryDTO } from '../../api/client';
import { IconLayers, IconPeople } from '../../portal/ui/Icons';
import { Loading, SearchBox } from '../../portal/ui/Primitives';

export function AdvisorVentureBoard() {
  const navigate = useNavigate();
  const [professors, setProfessors] = useState<ProfessorSummaryDTO[] | null>(null);
  const [projectCounts, setProjectCounts] = useState<Record<string, number>>({});
  const [query, setQuery] = useState('');

  useEffect(() => {
    api.professors().then(list => {
      setProfessors(list);
      Promise.all(list.map(p => api.professor(p.id).then(d => [p.id, d.projects.length] as const))).then(pairs =>
        setProjectCounts(Object.fromEntries(pairs))
      );
    });
  }, []);

  if (!professors) return <Loading label="Loading faculty…" />;

  const filtered = professors.filter(p => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return p.name.toLowerCase().includes(q) || p.departmentId.toLowerCase().includes(q) || p.researchTags.some(t => t.toLowerCase().includes(q));
  });

  const totalProjects = Object.values(projectCounts).reduce((s, n) => s + n, 0);

  return (
    <div>
      <div className="su-flex su-justify-between su-items-center" style={{ marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="su-eyebrow">Innovation &amp; Venture Catalyst</div>
          <div className="su-title" style={{ fontSize: 24 }}>Venture Board</div>
        </div>
        <SearchBox value={query} onChange={setQuery} placeholder="Search faculty by name / department" />
      </div>

      <div className="su-stat-grid su-stagger">
        <div className="su-stat-card su-stat-icon-card">
          <span className="su-stat-icon"><IconPeople width={18} height={18} /></span>
          <div><div className="su-stat-value">{professors.length}</div><div className="su-stat-label" style={{ marginTop: 4 }}>Faculty accepting undergrads</div></div>
        </div>
        <div className="su-stat-card su-stat-icon-card">
          <span className="su-stat-icon"><IconLayers width={18} height={18} /></span>
          <div><div className="su-stat-value">{totalProjects}</div><div className="su-stat-label" style={{ marginTop: 4 }}>Total venture projects</div></div>
        </div>
      </div>

      <div className="su-stagger su-mt-16" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {filtered.map(p => (
          <button key={p.id} className="su-card su-hover" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => navigate(`/venture-board/${p.id}`)}>
            <div className="su-flex su-justify-between su-items-center">
              <div className="su-title" style={{ fontSize: 16 }}>{p.name}</div>
              <span className={`su-badge ${p.acceptingUndergrads ? 'ok' : 'neutral'}`}>{p.acceptingUndergrads ? 'accepting' : 'closed'}</span>
            </div>
            <div className="su-muted" style={{ marginTop: 4 }}>{p.facultyId}/{p.departmentId}</div>
            <div className="su-flex su-gap-8 su-mt-16" style={{ flexWrap: 'wrap' }}>
              {p.researchTags.map(t => <span key={t} className="su-badge neutral">{t}</span>)}
            </div>
            <div className="su-mt-16" style={{ fontWeight: 700, color: 'var(--su-accent)' }}>{projectCounts[p.id] ?? 0} project{(projectCounts[p.id] ?? 0) !== 1 ? 's' : ''} →</div>
          </button>
        ))}
        {filtered.length === 0 && <div className="su-empty">No faculty match “{query}”.</div>}
      </div>
    </div>
  );
}
