// AI Features Blueprint §2/§3.3/§4.2 — Innovation Topography bubble chart
// + the micro-funding allocation UI, folded into one page (the blueprint
// originally split funding into VpAdvisorDetail.tsx's drill-down; kept
// here instead for a first cut so funding a project and seeing where it
// sits on the topography aren't two separate navigations).
import { useEffect, useState } from 'react';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { api, ColliderProjectDTO, AdvisorDTO } from '../api/client';
import { TopographyCell } from '@advisor/shared';
import { Loading, Section, Empty, useToast } from '../portal/ui/Primitives';
import { useChartTokens } from '../portal/ui/chartTheme';
import { downloadInnovationTopographyPdf } from '../lib/pdfReport';

function TopographyChart({ cells }: { cells: TopographyCell[] }) {
  const tokens = useChartTokens();
  const skills = Array.from(new Set(cells.map(c => c.skill)));
  const faculties = Array.from(new Set(cells.map(c => c.facultyId)));
  const data = cells.map(c => ({ ...c, x: skills.indexOf(c.skill), y: faculties.indexOf(c.facultyId) }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(240, faculties.length * 70 + 60)}>
      <ScatterChart margin={{ top: 10, right: 20, bottom: 40, left: 90 }}>
        <CartesianGrid stroke={tokens.border} />
        <XAxis
          type="number" dataKey="x" domain={[-0.5, skills.length - 0.5]} ticks={skills.map((_, i) => i)}
          tickFormatter={i => skills[i] ?? ''} tick={{ fill: tokens.textMuted, fontSize: 11 }} angle={-30} textAnchor="end" height={60}
          stroke={tokens.border}
        />
        <YAxis
          type="number" dataKey="y" domain={[-0.5, faculties.length - 0.5]} ticks={faculties.map((_, i) => i)}
          tickFormatter={i => faculties[i] ?? ''} tick={{ fill: tokens.textMuted, fontSize: 12 }} stroke={tokens.border}
        />
        <ZAxis type="number" dataKey="projectCount" range={[80, 900]} />
        <Tooltip
          cursor={{ strokeDasharray: '3 3', stroke: tokens.border }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as TopographyCell;
            return (
              <div className="su-card" style={{ padding: 10, fontSize: 12, boxShadow: 'var(--su-shadow-md)' }}>
                <div><b>{d.skill}</b> — {d.facultyId}</div>
                <div className="su-muted">{d.projectCount} active project{d.projectCount === 1 ? '' : 's'}</div>
                {d.crossFacultyProjectCount > 0 && <div style={{ color: tokens.info }}>{d.crossFacultyProjectCount} cross-faculty</div>}
              </div>
            );
          }}
        />
        <Scatter data={data}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.crossFacultyProjectCount > 0 ? tokens.info : tokens.textFaint} fillOpacity={0.75} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function FundForm({ project, onFunded }: { project: ColliderProjectDTO; onFunded: (p: ColliderProjectDTO) => void }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [source, setSource] = useState<'university' | 'external_grant'>('university');
  const [grantName, setGrantName] = useState('');
  const [busy, setBusy] = useState(false);
  const { show, node } = useToast();

  const submit = async () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return;
    setBusy(true);
    try {
      const updated = await api.vpFundColliderProject(project.id, n, note, source, source === 'external_grant' ? grantName : undefined);
      onFunded(updated);
      setAmount(''); setNote(''); setGrantName('');
      show('Funding allocated.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="su-flex" style={{ flexDirection: 'column', gap: 8, marginTop: 8 }}>
      {project.fundingAllocations.length > 0 && (
        <div className="su-flex" style={{ flexDirection: 'column', gap: 4, marginBottom: 4 }}>
          {project.fundingAllocations.map((f, i) => (
            <div key={i} className="su-flex su-justify-between su-items-center" style={{ fontSize: 12 }}>
              <span>
                {f.amount.toLocaleString()} EGP — {f.note || 'no note'}
                {f.grantName && <span className="su-muted"> ({f.grantName})</span>}
              </span>
              <span className={`su-badge ${f.source === 'external_grant' ? 'accent' : 'neutral'}`}>
                {f.source === 'external_grant' ? 'External grant' : 'University'}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="su-flex su-gap-8" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="su-input" style={{ maxWidth: 120 }} type="number" min={1} placeholder="Amount (EGP)" value={amount} onChange={e => setAmount(e.target.value)} />
        <select className="su-input" style={{ maxWidth: 160 }} value={source} onChange={e => setSource(e.target.value as 'university' | 'external_grant')}>
          <option value="university">University funding</option>
          <option value="external_grant">External grant/award</option>
        </select>
        {source === 'external_grant' && (
          <input className="su-input" style={{ maxWidth: 200 }} placeholder="Grant/award name" value={grantName} onChange={e => setGrantName(e.target.value)} />
        )}
        <input className="su-input" style={{ maxWidth: 220 }} placeholder="Note (what it's for)" value={note} onChange={e => setNote(e.target.value)} />
        <button type="button" className="su-btn" disabled={busy || !amount} onClick={submit}>{busy ? 'Allocating…' : 'Allocate funding'}</button>
      </div>
      {node}
    </div>
  );
}

export function VpInnovationTopography() {
  const [cells, setCells] = useState<TopographyCell[] | null>(null);
  const [projects, setProjects] = useState<ColliderProjectDTO[] | null>(null);
  const [advisors, setAdvisors] = useState<AdvisorDTO[] | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api.vpInnovationTopography().then(setCells);
    // No single "all collider projects" endpoint (advisor-scoped only, by
    // design — see server.ts) — the VP's cross-advisor view fetches each
    // advisor's projects and flattens them, same shape as vp/advisors-summary
    // building its own cross-advisor picture from per-advisor data.
    api.advisors().then(async list => {
      setAdvisors(list);
      const perAdvisor = await Promise.all(list.map(a => api.advisorColliderProjects(a.id)));
      setProjects(perAdvisor.flat());
    });
  }, []);

  if (!cells || !projects || !advisors) return <Loading label="Loading the innovation topography…" />;

  const advisorNameFor = (advisorId: string) => advisors.find(a => a.id === advisorId)?.name ?? 'Unknown advisor';

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      await downloadInnovationTopographyPdf({
        projects: projects.map(p => ({ ...p, advisorName: advisorNameFor(p.advisorId) })),
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <Section
        eyebrow="Project Collider"
        title="Innovation Topography"
        subtitle="Active project skill clusters by faculty — bubble size is project count, blue marks a genuinely cross-faculty cluster."
        right={<button type="button" className="su-btn su-btn-secondary" disabled={downloading || projects.length === 0} onClick={downloadPdf}>{downloading ? 'Generating…' : 'Download PDF report'}</button>}
        className="su-mt-16"
      >
        {cells.length === 0 ? <Empty>No active projects to chart yet.</Empty> : <TopographyChart cells={cells} />}
      </Section>

      <Section eyebrow="Project Collider" title="Micro-funding allocation" subtitle="Allocate university funding or record an external grant/award against any active project, across any advisor's roster." className="su-mt-16">
        <div className="su-flex" style={{ flexDirection: 'column', gap: 14 }}>
          {projects.map(p => (
            <div key={p.id} className="su-card" style={{ padding: 14 }}>
              <div className="su-flex su-justify-between su-items-center" style={{ flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <b>{p.title}</b>
                  <div className="su-muted" style={{ fontSize: 12 }}>{p.skills.join(', ')} — advised by {advisorNameFor(p.advisorId)}</div>
                </div>
                <div className="su-muted" style={{ fontSize: 12 }}>
                  Total funded: {p.fundingAllocations.reduce((s, f) => s + f.amount, 0).toLocaleString()} EGP
                </div>
              </div>
              <FundForm project={p} onFunded={updated => setProjects(prev => prev!.map(x => (x.id === updated.id ? updated : x)))} />
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
