// Redesigned to match /login.pdf — a real (if still demo-only: client-side,
// no server session) email + password gate instead of the old "pick your
// identity from a list of buttons" picker. See auth/credentials.ts for how
// email/password map to a role, and docs/LOGIN_CREDENTIALS.md for the full
// human-readable roster (every student/advisor's email is derived straight
// from their real seeded NAME — firstname.lastname@aegis.edu.eg — never a
// second hardcoded list).
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { api, AdvisorDTO, StudentSummary } from '../../api/client';
import { ADVISOR_PASSWORD, STUDENT_PASSWORD, VP_EMAIL, VP_PASSWORD, advisorEmailFor, studentEmailFor } from '../../auth/credentials';
import { IconMoon, IconSun } from '../../portal/ui/Icons';
import { BrandMark } from '../../portal/ui/BrandMark';
import { Typewriter } from '../../components/Typewriter';
import '../../portal/student-theme.css';

export function Login() {
  const { loginAsAdvisor, loginAsStudent, loginAsVicePresident } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [students, setStudents] = useState<StudentSummary[] | null>(null);
  const [advisors, setAdvisors] = useState<AdvisorDTO[] | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showForgot, setShowForgot] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.listStudents().then(setStudents);
    api.advisors().then(setAdvisors);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const typedEmail = email.trim().toLowerCase();
    if (!typedEmail || !password) {
      setError('Enter both your email and password.');
      return;
    }
    setSubmitting(true);
    try {
      if (typedEmail === VP_EMAIL && password === VP_PASSWORD) {
        loginAsVicePresident();
        navigate('/vp');
        return;
      }
      const advisor = advisors?.find(a => advisorEmailFor(a.name) === typedEmail);
      if (advisor) {
        if (password !== ADVISOR_PASSWORD) return setError('Incorrect password.');
        loginAsAdvisor(advisor.id);
        navigate('/');
        return;
      }
      const student = students?.find(s => studentEmailFor(s.name) === typedEmail);
      if (student) {
        if (password !== STUDENT_PASSWORD) return setError('Incorrect password.');
        loginAsStudent(student.id);
        navigate(`/portal/${student.id}`);
        return;
      }
      setError('No account found for that email. See docs/LOGIN_CREDENTIALS.md for the demo roster.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="su su-login-page">
      <button type="button" className="su-icon-btn su-login-theme-btn" onClick={toggleTheme} aria-label="Toggle theme" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
        {theme === 'dark' ? <IconSun width={17} height={17} /> : <IconMoon width={17} height={17} />}
      </button>

      <div className="su-login-card su-login-card-wide">
        <div className="su-login-masthead">
          <div className="su-login-masthead-title">AEGIS</div>
          <div className="su-login-masthead-sub">Academic Advisor System</div>
        </div>

        <div className="su-login-columns">
          <div className="su-login-form-col">
            <div className="su-login-body">
              <div className="su-login-heading">
                <span className="su-login-heading-bar" />
                AEGIS <span className="su-login-heading-accent">Advising Portal</span>
              </div>
              <div className="su-subtitle" style={{ marginTop: 2, marginBottom: 22 }}>Log in using your academic portal credentials</div>

              <form onSubmit={submit}>
                <div className="su-field" style={{ marginBottom: 16 }}>
                  <label>Student / Advisor Email</label>
                  <input
                    className="su-input"
                    type="text"
                    autoComplete="username"
                    placeholder="e.g., ahmed.mostafa@aegis.edu.eg or nabil.fathy@aegis.edu.eg"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
                <div className="su-field">
                  <div className="su-flex su-justify-between su-items-center">
                    <label style={{ marginBottom: 0 }}>Password</label>
                    <button type="button" className="su-login-forgot" onClick={() => setShowForgot(true)}>Forgot Password?</button>
                  </div>
                  <input
                    className="su-input"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </div>

                {showForgot && (
                  <div className="su-note su-mt-16" style={{ marginTop: 14 }}>
                    Password resets aren't self-service in this demo — see the credential roster in{' '}
                    <code>docs/LOGIN_CREDENTIALS.md</code>, or contact the ICT Helpdesk below.
                  </div>
                )}
                {error && <div className="su-note danger su-mt-16" style={{ marginTop: 14 }}>{error}</div>}

                <button type="submit" className="su-btn su-btn-block su-login-submit" disabled={submitting}>
                  {submitting ? 'Signing in…' : 'Sign In to Advising Portal'}
                </button>
              </form>

              <div className="su-login-footer">
                Having trouble logging in? Please contact the ICT Helpdesk.
              </div>
            </div>
          </div>

          <div className="su-login-brand-col">
            <BrandMark variant="full" className="su-login-brand-logo" />
            <Typewriter className="su-login-typewriter" />
          </div>
        </div>
      </div>
    </div>
  );
}
