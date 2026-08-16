// Spec §16.6 — a professor's own VentureProjects: post/edit, toggle
// isActive, and jump to each one's ranked candidate list. Rebuilt onto
// the su-* design system (same visual language as the student portal and
// advisor console) instead of the old base editorial theme.
import { FormEvent, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { api, ProfessorDetailDTO, VentureProjectType } from '../api/client';
import { Loading } from '../portal/ui/Primitives';
import { IconPlus } from '../portal/ui/Icons';

interface OutletCtx {
  professor: ProfessorDetailDTO | null;
  reload: () => void;
}

const emptyForm = {
  title: '',
  description: '',
  type: 'academic_research' as VentureProjectType,
  requiredCourseCodes: '',
  preferredSkills: '',
  capacity: 2,
};

export function FacultyProjects() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { professor, reload } = useOutletContext<OutletCtx>();
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!id) return null;
  if (!professor) return <Loading label="Loading your projects…" />;

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createVentureProject(id, {
        title: form.title,
        description: form.description,
        type: form.type,
        requiredCourseCodes: form.requiredCourseCodes.split(',').map(s => s.trim()).filter(Boolean),
        preferredSkills: form.preferredSkills.split(',').map(s => s.trim()).filter(Boolean),
        capacity: Number(form.capacity) || 1,
        isActive: true,
      });
      setForm(emptyForm);
      setShowForm(false);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (projectId: string, isActive: boolean) => {
    await api.updateVentureProject(id, projectId, { isActive: !isActive });
    reload();
  };

  return (
    <div>
      <div className="su-flex su-justify-between su-items-center" style={{ marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="su-eyebrow">Innovation &amp; Venture Catalyst</div>
          <div className="su-title" style={{ fontSize: 24 }}>My Venture Projects</div>
        </div>
        <button className="su-btn" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : (<><IconPlus width={15} height={15} /> Post New Project</>)}
        </button>
      </div>

      {showForm && (
        <form className="su-card su-pop" onSubmit={create} style={{ marginBottom: 16 }}>
          <div className="su-title" style={{ fontSize: 15, marginBottom: 14 }}>New venture project</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input className="su-input" placeholder="Title" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            <input className="su-input" placeholder="Description" required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            <div className="su-flex su-gap-10" style={{ flexWrap: 'wrap' }}>
              <select className="su-input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value as VentureProjectType })}>
                <option value="academic_research">Academic research</option>
                <option value="commercial_spinoff">Commercial spin-off</option>
              </select>
              <input className="su-input" type="number" min="1" placeholder="Capacity" value={form.capacity} onChange={e => setForm({ ...form, capacity: Number(e.target.value) })} style={{ width: 110 }} />
            </div>
            <input className="su-input" placeholder="Required course codes (comma-separated)" value={form.requiredCourseCodes} onChange={e => setForm({ ...form, requiredCourseCodes: e.target.value })} />
            <input className="su-input" placeholder="Preferred skills (comma-separated, e.g. embedded_systems, machine_learning)" value={form.preferredSkills} onChange={e => setForm({ ...form, preferredSkills: e.target.value })} />
          </div>
          {error && <div className="su-note danger su-mt-16">{error}</div>}
          <button className="su-btn su-mt-16" disabled={busy || !form.title || !form.description} type="submit">Create Project</button>
        </form>
      )}

      <div className="su-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {professor.projects.map(p => (
          <div className="su-card" key={p.id}>
            <div className="su-flex su-justify-between su-items-center">
              <div className="su-title" style={{ fontSize: 16 }}>{p.title}</div>
              <span className={`su-badge ${p.isActive ? 'ok' : 'neutral'}`}>{p.isActive ? 'active' : 'archived'}</span>
            </div>
            <div className="su-subtitle">{p.description}</div>
            <div className="su-muted" style={{ fontSize: 12, marginBottom: 12 }}>
              {p.type === 'commercial_spinoff' ? 'Commercial spin-off' : 'Academic research'} · capacity {p.capacity} · required: {p.requiredCourseCodes.join(', ') || '—'} · skills: {p.preferredSkills.join(', ') || '—'}
            </div>
            <div className="su-flex su-gap-10">
              <button className="su-btn su-btn-sm su-btn-secondary" onClick={() => navigate(`/faculty/${id}/${p.id}`)}>View candidates</button>
              <button className="su-btn su-btn-sm su-btn-ghost" onClick={() => toggleActive(p.id, p.isActive)}>{p.isActive ? 'Archive' : 'Reactivate'}</button>
            </div>
          </div>
        ))}
      </div>
      {professor.projects.length === 0 && <div className="su-empty su-mt-16">No projects yet — post one above.</div>}
    </div>
  );
}
