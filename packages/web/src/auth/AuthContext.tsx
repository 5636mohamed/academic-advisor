// Lightweight session boundary between the three parties (advisor,
// student, professor). This is a demo login (localStorage, no password, no
// server-side session) — the same category of simplification already
// documented for this build's `x-role` admin header (see
// docs/BUILD_SPEC.md §15.1) — but the ACCESS CONTROL it enforces is real:
// once signed in as one party, the route guards in auth/RequireRole.tsx
// make the other parties' pages unreachable, not just unlinked.
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type AuthState =
  | { role: 'advisor'; advisorId: string }
  | { role: 'student'; studentId: string }
  | { role: 'professor'; professorId: string }
  /** A single global identity, same as advisor used to be before the
   *  multi-advisor epic — one Vice President oversees all 5 advisors. */
  | { role: 'vice_president' }
  | null;

interface AuthContextValue {
  auth: AuthState;
  loginAsAdvisor: (advisorId: string) => void;
  loginAsStudent: (studentId: string) => void;
  loginAsProfessor: (professorId: string) => void;
  loginAsVicePresident: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = 'academic-advisor-auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AuthState) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (auth) localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    else localStorage.removeItem(STORAGE_KEY);
  }, [auth]);

  const value: AuthContextValue = {
    auth,
    loginAsAdvisor: advisorId => setAuth({ role: 'advisor', advisorId }),
    loginAsStudent: studentId => setAuth({ role: 'student', studentId }),
    loginAsProfessor: professorId => setAuth({ role: 'professor', professorId }),
    loginAsVicePresident: () => setAuth({ role: 'vice_president' }),
    logout: () => setAuth(null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** Where a signed-in session's own pages live — used by the route guards to
 *  bounce a party away from someone else's pages toward their own, rather
 *  than just to a generic "not allowed" screen. */
export function homeRouteFor(auth: AuthState): string {
  if (!auth) return '/login';
  if (auth.role === 'advisor') return '/'; // unchanged — the advisor console's own URLs never gained an :advisorId segment (see plan notes); identity comes from context, not the URL
  if (auth.role === 'student') return `/portal/${auth.studentId}`;
  if (auth.role === 'vice_president') return '/vp';
  return `/faculty/${auth.professorId}`;
}
