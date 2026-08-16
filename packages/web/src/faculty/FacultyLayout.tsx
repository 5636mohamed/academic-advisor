// Spec §16.6 — the Faculty Console's own layout. Deliberately narrow: a
// professor only ever sees VentureProject/StudentVentureMatch data, never
// a student's transcript, probation counter, or transfer history (§16.6's
// "what a professor does NOT see" rule). Rebuilt onto the same su-*
// design system every other portal in the system uses now — no exception
// — instead of the old base editorial theme.
import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api, ProfessorDetailDTO } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { IconLogout, IconMoon, IconSun } from '../portal/ui/Icons';
import ejustLogo from '../assets/ejust-logo.png';
import '../portal/student-theme.css';

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'P';
}

export function FacultyLayout() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [professor, setProfessor] = useState<ProfessorDetailDTO | null>(null);

  useEffect(() => {
    if (id) api.professor(id).then(setProfessor);
  }, [id]);

  return (
    <div className="su">
      <div className="su-shell">
        <header className="su-topbar">
          <div className="su-brand">
            <span className="su-brand-mark"><img src={ejustLogo} alt="" /></span>
            <div className="su-brand-text">
              <div className="su-brand-name">E-JUST</div>
              <div className="su-brand-sub">Academic Advising</div>
            </div>
          </div>
          <div className="su-brand-divider" />
          <div className="su-role-tag">Faculty</div>

          <nav className="su-topbar-nav">
            <NavLink to={`/faculty/${id}`} end className={({ isActive }) => (isActive ? 'active' : '')}>
              My Projects
            </NavLink>
          </nav>

          <div className="su-topbar-user">
            <button type="button" className="su-icon-btn" onClick={toggleTheme} aria-label="Toggle theme" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              {theme === 'dark' ? <IconSun width={17} height={17} /> : <IconMoon width={17} height={17} />}
            </button>
            <button
              type="button"
              className="su-icon-btn danger"
              aria-label="Log out"
              title="Log out"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              <IconLogout width={17} height={17} />
            </button>
            {professor && (
              <div className="su-user-meta">
                <div className="su-user-name">{professor.name}</div>
                <div className="su-user-id">{professor.facultyId}/{professor.departmentId}</div>
              </div>
            )}
            <div className="su-avatar">{professor ? initials(professor.name) : '…'}</div>
          </div>
        </header>

        <main className="su-body">
          <div className="su-inner su-page" key={location.pathname}>
            <Outlet context={{ professor, reload: () => id && api.professor(id).then(setProfessor) }} />
          </div>
        </main>
      </div>
    </div>
  );
}
