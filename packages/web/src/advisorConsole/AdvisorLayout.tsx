// Spec §10's advisor console, rebuilt to match /UI Design Professor/*.pdf —
// same E-JUST red/white design system the student portal already uses
// (student-theme.css's `.su-*` classes are reused verbatim, not
// reimplemented: this is genuinely the same visual language, just a
// different role's screens). Topbar nav is exactly the mockups' three
// items: Dashboard, All Students, Venture board — the §16.6 Faculty
// Console's own venture-project management now lives here too (per the
// product decision that every professor at E-JUST is also an academic
// advisor), reachable without a separate professor login.
//
// The advisor role itself is still the single shared session
// auth/AuthContext.tsx has always modeled (no per-advisor identity/login,
// unlike student/professor) — so unlike the mockup's "Dr. Mohamed", the
// topbar shows a generic "Academic Advisor" label rather than inventing a
// fake name/ID that isn't backed by any real login data.
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { IconLogout, IconMoon, IconSun } from '../portal/ui/Icons';
import ejustLogo from '../assets/ejust-logo.png';
import '../portal/student-theme.css';

export function AdvisorLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const tabs = [
    { to: '/', label: 'Dashboard', end: true },
    { to: '/students', label: 'All Students' },
    { to: '/venture-board', label: 'Venture board' },
  ];

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
          <div className="su-role-tag">Advisor</div>

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
            <div className="su-user-meta">
              <div className="su-user-name">Academic Advisor</div>
              <div className="su-user-id">All students &amp; ventures</div>
            </div>
            <div className="su-avatar">AA</div>
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
