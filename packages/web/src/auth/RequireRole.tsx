// Route guards — the actual enforcement mechanism for "advisor, student,
// and professor are separate parties who can't reach each other's pages."
// Not a UI convenience; these redirect away regardless of how the URL was
// reached (typed directly, bookmarked, etc.).
import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useAuth, homeRouteFor } from './AuthContext';

export function RequireAdvisor() {
  const { auth } = useAuth();
  if (!auth) return <Navigate to="/login" replace />;
  if (auth.role !== 'advisor') return <Navigate to={homeRouteFor(auth)} replace />;
  return <Outlet />;
}

/** Rendered at the `/portal/:id` path level, so `useParams` here sees the
 *  same `:id` the nested PortalLayout tree will read. A student can only
 *  ever land on their OWN id — anything else (including a syntactically
 *  valid other-student id) redirects back to their own portal. */
export function RequireStudent() {
  const { auth } = useAuth();
  const { id } = useParams();
  if (!auth) return <Navigate to="/login" replace />;
  if (auth.role !== 'student') return <Navigate to={homeRouteFor(auth)} replace />;
  if (auth.studentId !== id) return <Navigate to={`/portal/${auth.studentId}`} replace />;
  return <Outlet />;
}

/** Spec §16.6 — the Faculty Console. Same own-id-only shape as
 *  RequireStudent: a professor can only ever land on their own console. */
export function RequireProfessor() {
  const { auth } = useAuth();
  const { id } = useParams();
  if (!auth) return <Navigate to="/login" replace />;
  if (auth.role !== 'professor') return <Navigate to={homeRouteFor(auth)} replace />;
  if (auth.professorId !== id) return <Navigate to={`/faculty/${auth.professorId}`} replace />;
  return <Outlet />;
}
