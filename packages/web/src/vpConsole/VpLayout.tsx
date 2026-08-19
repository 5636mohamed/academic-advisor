// Vice President portal — oversees all 5 advisors (each with their own
// 25-student roster) without opening the advisor console itself. Mirrors
// AdvisorLayout.tsx's chrome exactly (same su-* design system, same
// topbar shape) — the VP is a single global identity, same "one shared
// account" shape the pre-multi-advisor advisor login used to have, so
// (like that old advisor topbar) this shows a generic "Vice President"
// label rather than a per-id name.
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { IconLogout, IconMoon, IconSun } from '../portal/ui/Icons';
import { BrandMark } from '../portal/ui/BrandMark';
import { TopbarNav } from '../portal/ui/TopbarNav';
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
    { to: '/vp/innovation-topography', label: 'Innovation topography' },
    { to: '/vp/institutional-friction', label: 'Institutional friction' },
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
          {/* "Vice President" is long enough to overflow the topbar on a
              narrow phone once the nav row hides (found via an actual
              375px screenshot) — "VP" below (matching the avatar's own
              abbreviation) only ever shows at that same breakpoint, via
              CSS, same hide/show pattern .su-brand-sub already uses. */}
          <div className="su-role-tag"><span className="su-role-tag-full">Vice President</span><span className="su-role-tag-short">VP</span></div>

          <TopbarNav tabs={tabs} />

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
