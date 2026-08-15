// Spec §16.6 — a professor's own VentureProjects: post/edit, toggle
// isActive, and jump to each one's ranked candidate list.
import { useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { api, ProfessorDetailDTO, VentureProjectType } from '../api/client';

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
  const { professor, reload } = useOutletContext<OutletCtx>();
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!id) return null;

  const create = async () => {
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
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2>My Venture Projects</h2>
          <button className="secondary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'Post New Project'}
          </button>
        </div>
        {showForm && (
          <div style={{ marginTop: 10 }}>
            <div className="form-row">
              <input placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={{ flex: 1 }} />
            </div>
            <div className="form-row">
              <input placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ flex: 1 }} />
            </div>
            <div className="form-row">
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as VentureProjectType })}>
                <option value="academic_research">Academic research</option>
                <option value="commercial_spinoff">Commercial spin-off</option>
              </select>
              <input type="number" min="1" placeholder="Capacity" value={form.capacity} onChange={e => setForm({ ...form, capacity: Number(e.target.value) })} style={{ width: 90 }} />
            </div>
            <div className="form-row">
              <input placeholder="Required course codes (comma-separated)" value={form.requiredCourseCodes} onChange={e => setForm({ ...form, requiredCourseCodes: e.target.value })} style={{ flex: 1 }} />
            </div>
            <div className="form-row">
              <input placeholder="Preferred skills (comma-separated, e.g. embedded_systems, machine_learning)" value={form.preferredSkills} onChange={e => setForm({ ...form, preferredSkills: e.target.value })} style={{ flex: 1 }} />
            </div>
            {error && <div className="note" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>{error}</div>}
            <button disabled={busy || !form.title || !form.description} onClick={create}>Create Project</button>
          </div>
        )}
      </div>

      {professor?.projects.map(p => (
        <div className="card" key={p.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h3>{p.title}</h3>
            <span className={`badge ${p.isActive ? 'ok' : 'neutral'}`}>{p.isActive ? 'active' : 'archived'}</span>
          </div>
          <p className="sub">{p.description}</p>
          <p className="muted">
            {p.type === 'commercial_spinoff' ? 'Commercial spin-off' : 'Academic research'} · capacity {p.capacity} · required: {p.requiredCourseCodes.join(', ') || '—'} · skills: {p.preferredSkills.join(', ') || '—'}
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to={`/faculty/${id}/${p.id}`}>
              <button className="secondary">View candidates</button>
            </Link>
            <button className="secondary" onClick={() => toggleActive(p.id, p.isActive)}>
              {p.isActive ? 'Archive' : 'Reactivate'}
            </button>
          </div>
        </div>
      ))}
      {professor && professor.projects.length === 0 && <div className="empty-state">No projects yet — post one above.</div>}
    </div>
  );
}
