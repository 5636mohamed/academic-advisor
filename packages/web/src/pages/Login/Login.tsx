// Demo sign-in — picks which party (and, for a student/professor, which
// identity) this browser session is. A real system would replace this with
// actual credentials; the point of THIS page is that once you've picked,
// the route guards in auth/RequireRole.tsx lock you to that party.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { api, StudentSummary, ProfessorSummaryDTO } from '../../api/client';
import { ThemeToggle } from '../../theme/ThemeToggle';

export function Login() {
  const { loginAsAdvisor, loginAsStudent, loginAsProfessor } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<StudentSummary[] | null>(null);
  const [professors, setProfessors] = useState<ProfessorSummaryDTO[] | null>(null);

  useEffect(() => {
    api.listStudents().then(setStudents);
    api.professors().then(setProfessors);
  }, []);

  return (
    <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative' }}>
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <ThemeToggle />
      </div>
      <div className="card" style={{ maxWidth: 460, width: '100%' }}>
        <h1>Academic Advisor</h1>
        <p className="sub">Sign in to continue. Each party only ever sees their own pages.</p>

        <button
          style={{ width: '100%', marginBottom: 20 }}
          onClick={() => {
            loginAsAdvisor();
            navigate('/');
          }}
        >
          Sign in as Advisor
        </button>

        <h3>Sign in as a student</h3>
        {!students && <div className="loading">Loading students…</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto', marginBottom: 20 }}>
          {students?.map(s => (
            <button
              key={s.id}
              className="secondary"
              style={{ textAlign: 'left' }}
              onClick={() => {
                loginAsStudent(s.id);
                navigate(`/portal/${s.id}`);
              }}
            >
              {s.name}
            </button>
          ))}
        </div>

        <h3>Sign in as a professor (§16 Faculty Console)</h3>
        {!professors && <div className="loading">Loading professors…</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {professors?.map(p => (
            <button
              key={p.id}
              className="secondary"
              style={{ textAlign: 'left' }}
              onClick={() => {
                loginAsProfessor(p.id);
                navigate(`/faculty/${p.id}`);
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
