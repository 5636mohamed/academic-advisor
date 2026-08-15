// Spec §10.1 — the persistent sidebar "student file" list, kept on every
// screen, plus the masthead and per-student nav tabs (§10 steps 2-8).
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useStudentList } from '../state/students';
import { ProbationCounterPill } from '../components/ProbationCounterPill';
import { useAuth } from '../auth/AuthContext';
import { ThemeToggle } from '../theme/ThemeToggle';

export function Layout() {
  const { students, error, reload } = useStudentList();
  const { id } = useParams();
  const navigate = useNavigate();
  const { logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="masthead">
        <h1>Academic Advisor</h1>
        <span className="tagline">Advising, early-warning &amp; transfer system</span>
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
        <nav className="sidebar">
          {error && <div className="empty-state">Could not load students: {error}</div>}
          {!students && !error && <div className="loading">Loading…</div>}
          {students?.map(s => (
            <button
              key={s.id}
              className={`student-item ${s.id === id ? 'active' : ''}`}
              onClick={() => navigate(`/students/${s.id}`)}
            >
              <div className="name">{s.name}</div>
              <div className="meta">
                Level {s.level} · {s.facultyId}/{s.departmentId}
              </div>
              <div className="meta">
                CGPA <b>{s.cgpa.toFixed(2)}</b>{' '}
                <span className={`badge ${s.cgpa >= 2.0 ? 'ok' : 'warn'}`}>{s.cgpa >= 2.0 ? 'good standing' : 'below 2.00'}</span>
              </div>
              <div className="meta">
                <ProbationCounterPill count={s.probationCounter.count} />
                {s.status === 'dismissed' && <span className="badge danger">dismissed</span>}
              </div>
            </button>
          ))}
          <div style={{ padding: '12px 18px' }}>
            <NavLink to="/advisor-console" className={({ isActive }) => (isActive ? 'active' : '')}>
              Advisor Console →
            </NavLink>
          </div>
        </nav>
        <main className="main">
          <div className="main-inner">
            <Outlet context={{ reloadStudents: reload }} />
          </div>
        </main>
      </div>
    </div>
  );
}
