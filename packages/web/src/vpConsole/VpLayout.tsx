// Vice President portal — oversees all 5 advisors (each with their own
// 25-student roster) without opening the advisor console itself. Mirrors
// AdvisorLayout.tsx's chrome exactly (same su-* design system, same
// topbar shape) — the VP is a single global identity, same "one shared
// account" shape the pre-multi-advisor advisor login used to have, so
// (like that old advisor topbar) this shows a generic "Vice President"
// label rather than a per-id name.
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { IconLogout, IconMoon, IconSun } from '../portal/ui/Icons';
import { BrandMark } from '../portal/ui/BrandMark';
import '../portal/student-theme.css';

export function VpLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const tabs = [
    { to: '/vp', label: 'Dashboard', end: true },
    { to: '/vp/transfer-requests', label: 'Transfer requests' },
    { to: '/vp/venture-board', label: 'Venture board' },
  ];

  return (
    <div className="su">
      <div className="su-shell">
        <header className="su-topbar">
          <div className="su-brand">
            <span className="su-brand-mark"><BrandMark /></span>
            <div className="su-brand-text">
              <div className="su-brand-name">AEGIS</div>
              <div className="su-brand-sub">Academic Advisor System</div>
            </div>
          </div>
          <div className="su-brand-divider" />
          <div className="su-role-tag">Vice President</div>

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
              <div className="su-user-name">Vice President</div>
              <div className="su-user-id">All advisors &amp; ventures</div>
            </div>
            <div className="su-avatar">VP</div>
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
