// Session boundary between the system's parties (advisor, student, Vice
// President). Real backend authentication epic: login now calls
// POST /api/auth/login for real (api/client.ts), and every subsequent
// request carries the returned session token — this used to be a demo
// login with no password verification and no server-side session at all;
// see .github/SECURITY.md's rewritten Authentication section for the
// full before/after. The ACCESS CONTROL this enforces was already real
// even before that change (once signed in as one party, the route guards
// in auth/RequireRole.tsx make the other parties' pages unreachable, not
// just unlinked) — what changed is that the session itself, and every
// route it can reach, is now server-verified too, not just this
// client-side redirect layer.
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
import { api, setAuthToken, setUnauthorizedHandler } from '../api/client';

export type AuthState =
  | { role: 'advisor'; advisorId: string; token: string }
  | { role: 'student'; studentId: string; token: string }
  /** A single global identity, same as advisor used to be before the
   *  multi-advisor epic — one Vice President oversees all 5 advisors. */
  | { role: 'vice_president'; token: string }
  | null;

interface AuthContextValue {
  auth: AuthState;
  /** Called once with POST /api/auth/login's real response — replaces the
   *  old loginAsAdvisor/loginAsStudent/loginAsVicePresident trio, which
   *  each made their own client-side decision about what to sign in as;
   *  now there's exactly one real login response shape to apply. */
  applyLoginResult: (result: { token: string; role: 'advisor' | 'student' | 'vice_president'; id: string | null }) => void;
  /** Async now — also invalidates the session server-side
   *  (POST /api/auth/logout) before clearing local state, so a captured
   *  token can't be replayed after "logging out." Best-effort: local
   *  state clears either way even if the network call fails (an already-
   *  expired/invalid token 401s anyway, which is a no-op server-side). */
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = 'academic-advisor-auth';

/** Real defense-in-depth gap found by audit: a bare `JSON.parse(raw) as
 *  AuthState` trusts whatever's in localStorage to already match one of
 *  the three known shapes. A malformed/partial value (a stale schema from
 *  a future migration, a bad manual edit, a browser extension) that's
 *  object-truthy but has no valid `role` would fall through every branch
 *  in homeRouteFor's if-chain to its `return '/vp'` catch-all, and
 *  RequireVicePresident would then redirect right back to homeRouteFor's
 *  own '/vp' — an infinite loop instead of the safe "treat as logged out"
 *  fallback every other unrecognized session should get. */
function isValidAuthState(value: unknown): value is AuthState {
  if (value === null) return true;
  if (typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.token !== 'string') return false;
  if (v.role === 'advisor') return typeof v.advisorId === 'string';
  if (v.role === 'student') return typeof v.studentId === 'string';
  if (v.role === 'vice_president') return true;
  return false;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Real bug caught live (a page refresh silently logged the user back
  // out): setAuthToken() used to only run inside a useEffect below, but
  // React flushes CHILD effects before a parent's own effect on initial
  // mount — so on a fresh page load, AdvisorLayout/VpLayout/etc.'s own
  // data-fetching effects fired their first api.* calls before this
  // provider's effect ever set the token, those requests went out with no
  // Authorization header, 401'd, and onUnauthorized() cleared the session
  // that had just been restored. Setting it here, synchronously inside
  // the state initializer (which runs during the render pass, strictly
  // before ANY effect anywhere in the tree), closes that race entirely —
  // the token is already in place before a single child component starts
  // rendering, not just before its effects run.
  const [auth, setAuth] = useState<AuthState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (!isValidAuthState(parsed)) return null;
      if (parsed) setAuthToken(parsed.token);
      return parsed;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (auth) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
      setAuthToken(auth.token);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      setAuthToken(null);
    }
  }, [auth]);

  // Registered once — a 401 from ANY api.* call (session expired,
  // invalidated, or wiped by a server restart — this in-memory store
  // resets on every redeploy, same as every other collection in it)
  // clears the local session; the existing RequireRole guards then
  // redirect to /login on the next render, no new navigation code needed.
  useEffect(() => {
    setUnauthorizedHandler(() => setAuth(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  const value: AuthContextValue = {
    auth,
    applyLoginResult: result => {
      if (result.role === 'advisor') setAuth({ role: 'advisor', advisorId: result.id!, token: result.token });
      else if (result.role === 'student') setAuth({ role: 'student', studentId: result.id!, token: result.token });
      else setAuth({ role: 'vice_president', token: result.token });
    },
    logout: async () => {
      try {
        await api.logout();
      } catch {
        // best-effort — local state clears regardless, see the interface doc comment above
      }
      setAuth(null);
    },
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
  // Defense in depth: an unrecognized role never falls through to '/vp' by
  // default (that used to be able to infinite-loop against
  // RequireVicePresident for a malformed session — see isValidAuthState
  // above, which is the real fix; this is the second layer) — treat it
  // exactly like a logged-out session instead.
  return '/login';
}
