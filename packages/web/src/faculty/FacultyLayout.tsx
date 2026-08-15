// Spec §16.6 — the Faculty Console's own layout. Deliberately narrow: a
// professor only ever sees VentureProject/StudentVentureMatch data, never
// a student's transcript, probation counter, or transfer history (§16.6's
// "what a professor does NOT see" rule).
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api, ProfessorDetailDTO } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { ThemeToggle } from '../theme/ThemeToggle';

export function FacultyLayout() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [professor, setProfessor] = useState<ProfessorDetailDTO | null>(null);

  useEffect(() => {
    if (id) api.professor(id).then(setProfessor);
  }, [id]);

  return (
    <div className="app-shell">
      <header className="masthead">
        <h1>Faculty Console</h1>
        <span className="tagline">{professor ? professor.name : 'Loading…'} — venture projects &amp; candidates</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <ThemeToggle style={{ color: 'var(--masthead-fg)', borderColor: '#554' }} />
          <button
            className="secondary"
            style={{ color: 'var(--masthead-fg)', borderColor: '#554' }}
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Log out
          </button>
        </div>
      </header>
      <div className="layout">
        <main className="main" style={{ width: '100%' }}>
          <div className="main-inner">
            <div className="nav-tabs">
              <NavLink to={`/faculty/${id}`} end className={({ isActive }) => (isActive ? 'active' : '')}>
                My Projects
              </NavLink>
            </div>
            <Outlet context={{ professor, reload: () => id && api.professor(id).then(setProfessor) }} />
          </div>
        </main>
      </div>
    </div>
  );
}
