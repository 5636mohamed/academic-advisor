// Persistent left sidebar nav — replaces the old horizontal topbar pill-row
// nav (`.su-topbar-nav-desktop`, now removed) as every portal's growing tab
// count outgrew a single row: the VP and Advisor consoles reached 8-9 tabs
// after the Curriculum Analytics epic, which meant the pill row wrapped to a
// second, visually cramped line on real desktop widths — and, worse, made
// the newest tabs (added last in each array) easy to miss entirely. A
// vertical list has no such ceiling: every tab reads as one clean, always-
// visible column regardless of count, and the VP/advisor can scan straight
// down it to pick the page they want to work on instead of hunting across a
// wrapped row.
//
// Desktop-only by design — hidden below the shell's existing 860px
// breakpoint (student-theme.css), where TopbarNav.tsx's hamburger + full-
// screen menu (unchanged, already proven) takes over as the mobile
// equivalent. Both components read from the exact same tabs array each
// layout already builds, so there is only ever one source of truth per
// portal for "what pages does this role have."
import { NavLink } from 'react-router-dom';

export interface SidebarTab {
  to: string;
  label: string;
  end?: boolean;
  /** Renders a divider + section label directly above this tab — used to
   *  visually separate a portal's day-to-day pages from a later-added
   *  group (e.g. the Curriculum Analytics tabs) without inventing a nested
   *  data structure just for that one grouping. */
  sectionLabel?: string;
}

export function Sidebar({ tabs }: { tabs: SidebarTab[] }) {
  return (
    <aside className="su-sidebar">
      <nav className="su-sidebar-nav">
        {tabs.map(t => (
          <div key={t.to}>
            {t.sectionLabel && <div className="su-sidebar-section">{t.sectionLabel}</div>}
            <NavLink to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              {t.label}
            </NavLink>
          </div>
        ))}
      </nav>
    </aside>
  );
}
