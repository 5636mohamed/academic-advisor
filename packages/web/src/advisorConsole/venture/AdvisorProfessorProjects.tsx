// A specific professor's own venture projects — post/edit, toggle active,
// jump to each project's ranked candidates. Restyled from the old
// FacultyProjects.tsx; same endpoints, now reachable from inside the
// advisor console instead of a separate professor login.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ProfessorDetailDTO, VentureProjectType } from '../../api/client';
import { Loading } from '../../portal/ui/Primitives';

const emptyForm = { title: '', description: '', type: 'academic_research' as VentureProjectType, requiredCourseCodes: '', preferredSkills: '', capacity: 2 };

export function AdvisorProfessorProjects() {
  const { professorId } = useParams<{ professorId: string }>();
  const navigate = useNavigate();
  const [professor, setProfessor] = useState<ProfessorDetailDTO | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => { if (professorId) api.professor(professorId).then(setProfessor); };
  useEffect(load, [professorId]);

  if (!professorId) return null;
  if (!professor) return <Loading label="Loading professor…" />;

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.createVentureProject(professorId, {
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
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (projectId: string, isActive: boolean) => {
    await api.updateVentureProject(professorId, projectId, { isActive: !isActive });
    load();
  };

  return (
    <div>
      <button className="su-btn su-btn-ghost su-btn-sm" onClick={() => navigate('/venture-board')} style={{ marginBottom: 12 }}>← All faculty</button>

      <div className="su-flex su-justify-between su-items-center" style={{ marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="su-eyebrow">{professor.facultyId}/{professor.departmentId}</div>
          <div className="su-title" style={{ fontSize: 24 }}>{professor.name}</div>
        </div>
        <button className="su-btn" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : 'Post New Project'}</button>
      </div>

      {showForm && (
        <div className="su-card su-pop" style={{ marginBottom: 16 }}>
          <div className="su-title" style={{ fontSize: 15, marginBottom: 14 }}>New venture project</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input className="su-input" placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            <input className="su-input" placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            <div className="su-flex su-gap-10">
              <select className="su-input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value as VentureProjectType })}>
                <option value="academic_research">Academic research</option>
                <option value="commercial_spinoff">Commercial spin-off</option>
              </select>
              <input className="su-input" type="number" min="1" placeholder="Capacity" value={form.capacity} onChange={e => setForm({ ...form, capacity: Number(e.target.value) })} style={{ width: 100 }} />
            </div>
            <input className="su-input" placeholder="Required course codes (comma-separated)" value={form.requiredCourseCodes} onChange={e => setForm({ ...form, requiredCourseCodes: e.target.value })} />
            <input className="su-input" placeholder="Preferred skills (comma-separated, e.g. embedded_systems, machine_learning)" value={form.preferredSkills} onChange={e => setForm({ ...form, preferredSkills: e.target.value })} />
          </div>
          {error && <div className="su-note danger su-mt-16">{error}</div>}
          <button className="su-btn su-mt-16" disabled={busy || !form.title || !form.description} onClick={create}>Create Project</button>
        </div>
      )}

      <div className="su-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {professor.projects.map(p => (
          <div className="su-card" key={p.id}>
            <div className="su-flex su-justify-between su-items-center">
              <div className="su-title" style={{ fontSize: 16 }}>{p.title}</div>
              <span className={`su-badge ${p.isActive ? 'ok' : 'neutral'}`}>{p.isActive ? 'active' : 'archived'}</span>
            </div>
            <div className="su-subtitle">{p.description}</div>
            <div className="su-muted" style={{ marginBottom: 12 }}>
              {p.type === 'commercial_spinoff' ? 'Commercial spin-off' : 'Academic research'} · capacity {p.capacity} · required: {p.requiredCourseCodes.join(', ') || '—'}
            </div>
            <div className="su-flex su-gap-10">
              <Link to={`/venture-board/${professorId}/${p.id}`}><button className="su-btn su-btn-sm su-btn-secondary">View candidates</button></Link>
              <button className="su-btn su-btn-sm su-btn-ghost" onClick={() => toggleActive(p.id, p.isActive)}>{p.isActive ? 'Archive' : 'Reactivate'}</button>
            </div>
          </div>
        ))}
      </div>
      {professor.projects.length === 0 && <div className="su-empty">No projects yet — post one above.</div>}
    </div>
  );
}
