// Spec §15.1 — the student portal's own layout, now rebuilt to match
// /UI Design Student/*.pdf's topbar (logo + "Student" role tag + centered
// nav + name/ID/avatar) instead of the advisor console's sidebar shell.
// Same access-control note as before still applies: no roster-of-all-
// students sidebar, no identity switcher — RequireStudent (auth/RequireRole)
// has already confirmed this session is signed in as exactly this student;
// the only way out is "Log out." Theme toggle + logout are kept as compact
// icon buttons next to the avatar since the mockups don't show them (they
// weren't designing the auth chrome) but the feature has to stay reachable.
import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api, StudentSummary } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { IconLogout, IconMoon, IconSun } from './ui/Icons';
import { BrandMark } from './ui/BrandMark';
import './student-theme.css';

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'S';
}

export function PortalLayout() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [student, setStudent] = useState<StudentSummary | null>(null);

  useEffect(() => {
    if (id) api.getStudent(id).then(setStudent);
  }, [id]);

  const tabs = [
    { to: `/portal/${id}`, label: 'Dashboard', end: true },
    { to: `/portal/${id}/course-plan`, label: 'Course Plan' },
    { to: `/portal/${id}/quiz`, label: 'Department Quiz' },
    { to: `/portal/${id}/transcript`, label: 'Transcript' },
    // §16.1/§16.5 — only ever shown to Level 3+ students, same gate as the
    // Venture Gate itself.
    ...(student && student.level >= 3 ? [{ to: `/portal/${id}/venture-board`, label: 'Venture board' }] : []),
  ];

  return (
    <div className="su">
      <div className="su-shell">
        <header className="su-topbar">
          <div className="su-brand">
            <span className="su-brand-mark"><BrandMark /></span>
            <div className="su-brand-text">
              <div className="su-brand-name">AEGIS</div>
              <div className="su-brand-sub">E-JUST Academic Advisor System</div>
            </div>
          </div>
          <div className="su-brand-divider" />
          <div className="su-role-tag">Student</div>

          <nav className="su-topbar-nav">
            {tabs.map(t => (
              <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'active' : '')}>
                {t.label}
              </NavLink>
            ))}
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
            {student && (
              <div className="su-user-meta">
                <div className="su-user-name">{student.name}</div>
                <div className="su-user-id">ID: {student.id}</div>
              </div>
            )}
            <div className="su-avatar">{student ? initials(student.name) : '…'}</div>
          </div>
        </header>

        <main className="su-body">
          <div className="su-inner su-page" key={location.pathname}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
