// Shared topbar navigation — used by all three shell layouts (PortalLayout,
// AdvisorLayout, VpLayout), which otherwise each duplicated the exact same
// `<nav className="su-topbar-nav">{tabs.map(...)}</nav>` block. Desktop
// keeps the existing centered pill-row nav unchanged; below the shell's
// 860px breakpoint that row used to become its own horizontally-scrolling
// strip (cramped, and the reason a tab like "Transfer requests" could end
// up scrolled out of sight with only a sliver showing) — it's now a
// hamburger button that opens a full-screen stacked menu instead, one tab
// per full-width row, closing itself the moment the route actually changes.
import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { IconClose, IconMenu } from './Icons';

export interface TopbarTab {
  to: string;
  label: string;
  end?: boolean;
}

export function TopbarNav({ tabs }: { tabs: TopbarTab[] }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Selecting a tab navigates -> pathname changes -> menu closes on its
  // own, same as tapping the backdrop/close button.
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // A full-screen menu with the page scrolling underneath it is a common
  // mobile-web sharp edge — lock body scroll while it's open, restore on
  // close/unmount so this never leaks into the rest of the app.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <>
      <nav className="su-topbar-nav su-topbar-nav-desktop">
        {tabs.map(t => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            {t.label}
          </NavLink>
        ))}
      </nav>

      <button
        type="button"
        className="su-icon-btn su-topbar-menu-btn"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        {open ? <IconClose width={18} height={18} /> : <IconMenu width={18} height={18} />}
      </button>

      {open && (
        <div className="su-mobile-menu" role="dialog" aria-label="Main navigation">
          <div className="su-mobile-menu-header">
            <span className="su-eyebrow">Menu</span>
            <button type="button" className="su-icon-btn" aria-label="Close menu" onClick={() => setOpen(false)}>
              <IconClose width={18} height={18} />
            </button>
          </div>
          <nav className="su-mobile-menu-nav">
            {tabs.map(t => (
              <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'active' : '')}>
                {t.label}
              </NavLink>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
