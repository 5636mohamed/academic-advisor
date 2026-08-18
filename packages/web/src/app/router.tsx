import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Login } from '../pages/Login/Login';
import { PortalLayout } from '../portal/PortalLayout';
import { PortalHome } from '../portal/PortalHome';
import { PortalCoursePlan } from '../portal/PortalCoursePlan';
import { PortalQuiz } from '../portal/PortalQuiz';
import { PortalTranscript } from '../portal/PortalTranscript';
import { PortalVentureBoard } from '../portal/PortalVentureBoard';
import { AdvisorLayout } from '../advisorConsole/AdvisorLayout';
import { AdvisorDashboard } from '../advisorConsole/AdvisorDashboard';
import { AdvisorAllStudents } from '../advisorConsole/AdvisorAllStudents';
import { AdvisorStudentShell } from '../advisorConsole/studentFile/AdvisorStudentShell';
import { Overview } from '../advisorConsole/studentFile/Overview';
import { AdvisorCoursePlanPage } from '../advisorConsole/studentFile/AdvisorCoursePlanPage';
import { AdvisorCurriculumPage } from '../advisorConsole/studentFile/AdvisorCurriculumPage';
import { AdvisorProbationHistoryPage } from '../advisorConsole/studentFile/AdvisorProbationHistoryPage';
import { AdvisorVentureBoard } from '../advisorConsole/venture/AdvisorVentureBoard';
import { AdvisorTransferRequests } from '../advisorConsole/AdvisorTransferRequests';
import { VpLayout } from '../vpConsole/VpLayout';
import { VpDashboard } from '../vpConsole/VpDashboard';
import { VpAdvisorDetail } from '../vpConsole/VpAdvisorDetail';
import { VpTransferRequests } from '../vpConsole/VpTransferRequests';
import { VpVentureBoard } from '../vpConsole/VpVentureBoard';
import { RequireAdvisor, RequireStudent, RequireVicePresident } from '../auth/RequireRole';

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    // Every route under here requires an advisor session (auth/RequireRole.tsx)
    // — a student or Vice President session is redirected to their own
    // pages instead. Rebuilt to match /UI Design Professor/*.pdf — see
    // advisorConsole/*. The advisor's own Venture Board manages ventures
    // directly (post/edit/review candidates) — there is no separate
    // professor login/Faculty Console anymore (see AuthContext.tsx).
    element: <RequireAdvisor />,
    children: [
      {
        path: '/',
        element: <AdvisorLayout />,
        children: [
          { index: true, element: <AdvisorDashboard /> },
          { path: 'students', element: <AdvisorAllStudents /> },
          {
            path: 'students/:id',
            element: <AdvisorStudentShell />,
            children: [
              { index: true, element: <Overview /> },
              { path: 'course-plan', element: <AdvisorCoursePlanPage /> },
              { path: 'curriculum', element: <AdvisorCurriculumPage /> },
              { path: 'probation-history', element: <AdvisorProbationHistoryPage /> },
              // Old §10 route names, kept as redirects in case anything has
              // them bookmarked/linked from before this redesign. The
              // Best-Fit Department Quiz was removed from the advisor
              // console entirely (product-owner decision — student-only
              // feature now) — redirects to Overview instead of 404ing.
              { path: 'quiz', element: <Navigate to=".." replace /> },
              { path: 'advise', element: <Navigate to="../course-plan?mode=probation" replace /> },
              { path: 'target-cgpa', element: <Navigate to="../course-plan?mode=target" replace /> },
              { path: 'proposals', element: <Navigate to="../course-plan?mode=proposals" replace /> },
            ],
          },
          // The advisor owns every venture directly — a single-page 3-pane
          // dashboard (My ventures / Pending approvals / candidate detail),
          // no per-professor sub-routes needed.
          { path: 'venture-board', element: <AdvisorVentureBoard /> },
          { path: 'transfer-requests', element: <AdvisorTransferRequests /> },
          { path: 'advisor-console', element: <Navigate to="/students" replace /> },
        ],
      },
    ],
  },
  {
    // Spec §15.1 — the student portal. RequireStudent (bound at this path
    // level, where `:id` is defined) enforces that a student session can
    // only ever land on THEIR OWN id — no other student's portal, no
    // advisor/Vice-President pages.
    path: '/portal/:id',
    element: <RequireStudent />,
    children: [
      {
        element: <PortalLayout />,
        children: [
          { index: true, element: <PortalHome /> },
          { path: 'course-plan', element: <PortalCoursePlan /> },
          { path: 'quiz', element: <PortalQuiz /> },
          { path: 'transcript', element: <PortalTranscript /> },
          { path: 'venture-board', element: <PortalVentureBoard /> },
          // Old §15.1 route names, kept as redirects in case anything has
          // them bookmarked/linked from before this redesign.
          { path: 'advise', element: <Navigate to="../course-plan?mode=probation" replace /> },
          { path: 'target-cgpa', element: <Navigate to="../course-plan?mode=target" replace /> },
          { path: 'recommendations', element: <Navigate to="../course-plan?mode=recommendations" replace /> },
          { path: 'curriculum', element: <Navigate to="../transcript?tab=curriculum" replace /> },
        ],
      },
    ],
  },
  {
    // Vice President portal — a single global identity overseeing all 5
    // advisors, so (like the advisor console above) no :id segment in the
    // URL; RequireVicePresident is a pure role check.
    path: '/vp',
    element: <RequireVicePresident />,
    children: [
      {
        element: <VpLayout />,
        children: [
          { index: true, element: <VpDashboard /> },
          { path: 'advisors/:advisorId', element: <VpAdvisorDetail /> },
          { path: 'transfer-requests', element: <VpTransferRequests /> },
          { path: 'venture-board', element: <VpVentureBoard /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
], {
  // In local dev this is just '/' (a no-op). A static deploy built with a
  // non-root --base (e.g. GitHub Pages serving from /academic-advisor/)
  // needs the router to know it isn't living at the domain root, or every
  // internal link/redirect resolves one level too high and 404s.
  basename: import.meta.env.BASE_URL,
});
