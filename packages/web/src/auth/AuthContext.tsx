// Lightweight session boundary between the system's parties (advisor,
// student, Vice President). This is a demo login (localStorage, no
// password, no server-side session) — the same category of simplification
// already documented for this build's `x-role` admin header (see
// docs/BUILD_SPEC.md §15.1) — but the ACCESS CONTROL it enforces is real:
// once signed in as one party, the route guards in auth/RequireRole.tsx
// make the other parties' pages unreachable, not just unlinked.
//
// The professor role (the old Faculty Console, `/faculty/:id`) was removed
// entirely — every professor is already also an advisor, and the
// advisor console's own Venture Board already manages every project
// directly (§ the pre-existing "no directory of other professors" design),
// so the separate professor login never had anything the advisor console
// didn't already do. Existing seeded professors (prof-kamel, prof-adel)
// still exist as pure venture-attribution data ("Hosted by Dr. X" on a
// student's Venture Board) — only the LOGIN was eliminated, not that data.
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type AuthState =
  | { role: 'advisor'; advisorId: string }
  | { role: 'student'; studentId: string }
  /** A single global identity, same as advisor used to be before the
   *  multi-advisor epic — one Vice President oversees all 5 advisors. */
  | { role: 'vice_president' }
  | null;

interface AuthContextValue {
  auth: AuthState;
  loginAsAdvisor: (advisorId: string) => void;
  loginAsStudent: (studentId: string) => void;
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
  return '/vp';
}
