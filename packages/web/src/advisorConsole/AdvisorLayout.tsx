// Spec §10's advisor console, rebuilt to match /UI Design Professor/*.pdf —
// same AEGIS red/white design system the student portal already uses
// (student-theme.css's `.su-*` classes are reused verbatim, not
// reimplemented: this is genuinely the same visual language, just a
// different role's screens). Topbar nav is exactly the mockups' three
// items: Dashboard, All Students, Venture board — the §16.6 Faculty
// Console's own venture-project management now lives here too (per the
// product decision that every professor is also an academic
// advisor), reachable without a separate professor login.
//
// Multi-advisor epic: advisor is now a real per-id identity (5 named
// advisors, see db/seed/seedAdvisors.ts), so the topbar shows the actual
// logged-in advisor's real name/department instead of the old generic
// "Academic Advisor" placeholder from back when advisor was one shared
// account.
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api, AdvisorDTO } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { IconLogout, IconMoon, IconSun } from '../portal/ui/Icons';
import { BrandMark } from '../portal/ui/BrandMark';
import { Sidebar } from '../portal/ui/Sidebar';
import { TopbarNav } from '../portal/ui/TopbarNav';
import { NotificationBell } from '../portal/ui/NotificationBell';
import '../portal/student-theme.css';

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'A';
}

export function AdvisorLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { auth, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const advisorId = auth?.role === 'advisor' ? auth.advisorId : undefined;
  const [advisor, setAdvisor] = useState<AdvisorDTO | null>(null);
  // Real bug found by audit: this used to be a hardcoded "25 students"
  // string, never actually reflecting the logged-in advisor's real roster
  // size — now doubly wrong now that rosters are a random cross-department
  // mix rather than a uniform per-advisor number set at build time.
  const [studentCount, setStudentCount] = useState<number | null>(null);

  useEffect(() => {
    if (advisorId) api.advisor(advisorId).then(setAdvisor);
  }, [advisorId]);

  useEffect(() => {
    if (advisorId) api.listStudents(advisorId).then(list => setStudentCount(list.length));
  }, [advisorId]);

  const tabs = [
    { to: '/', label: 'Dashboard', end: true },
    { to: '/students', label: 'All Students' },
    { to: '/venture-board', label: 'Venture board' },
    { to: '/transfer-requests', label: 'Transfer requests' },
    { to: '/workload-overview', label: 'Workload' },
    { to: '/collider-board', label: 'Collider board' },
    { to: '/demand-forecast', label: 'Demand forecast', sectionLabel: 'Curriculum Analytics' },
    { to: '/curriculum-health', label: 'Curriculum health' },
    { to: '/bottleneck-analyzer', label: 'Bottleneck analyzer' },
  ];

  return (
    <div className="su">
      <div className="su-shell">
        <Sidebar tabs={tabs} />
        <div className="su-main">
          <header className="su-topbar">
            <div className="su-brand">
              <span className="su-brand-mark"><BrandMark /></span>
              <div className="su-brand-text">
                <div className="su-brand-name">AEGIS</div>
                <div className="su-brand-sub">Academic Advisor System</div>
              </div>
            </div>
            <div className="su-brand-divider" />
            <div className="su-role-tag"><span className="su-role-tag-full">Advisor</span><span className="su-role-tag-short">Advisor</span></div>

            <TopbarNav tabs={tabs} />

            <div className="su-topbar-user">
              <NotificationBell role="advisor" recipientId={advisorId} basePath="" />
              <button type="button" className="su-icon-btn" onClick={toggleTheme} aria-label="Toggle theme" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
                {theme === 'dark' ? <IconSun width={17} height={17} /> : <IconMoon width={17} height={17} />}
              </button>
              <button
                type="button"
                className="su-icon-btn danger"
                aria-label="Log out"
                title="Log out"
                onClick={() => {
                  void logout(); // fire-and-forget — navigation shouldn't wait on the server round-trip
                  navigate('/login');
                }}
              >
                <IconLogout width={17} height={17} />
              </button>
              {advisor && (
                <div className="su-user-meta">
                  <div className="su-user-name">{advisor.name}</div>
                  <div className="su-user-id">{advisor.facultyId}/{advisor.departmentId} · {studentCount ?? '…'} students</div>
                </div>
              )}
              <div className="su-avatar">{advisor ? initials(advisor.name) : 'A'}</div>
            </div>
          </header>

          <main className="su-body">
            <div className="su-inner su-page" key={location.pathname}>
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
