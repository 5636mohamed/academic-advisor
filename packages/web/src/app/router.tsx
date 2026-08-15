import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Layout } from './Layout';
import { StudentFile } from '../pages/Dashboard/StudentFile';
import { Curriculum } from '../pages/Curriculum/Curriculum';
import { AdviseFlow } from '../pages/AdviseFlow/AdviseFlow';
import { TargetCgpaPlanner } from '../pages/TargetCgpaPlanner/TargetCgpaPlanner';
import { DepartmentFitQuiz } from '../pages/DepartmentFitQuiz/DepartmentFitQuiz';
import { ProbationHistory } from '../pages/ProbationHistory/ProbationHistory';
import { ProposalReview } from '../pages/Proposals/ProposalReview';
import { AdvisorConsole } from '../pages/AdvisorConsole/AdvisorConsole';
import { Home } from '../pages/Home';
import { Login } from '../pages/Login/Login';
import { PortalLayout } from '../portal/PortalLayout';
import { PortalHome } from '../portal/PortalHome';
import { PortalCoursePlan } from '../portal/PortalCoursePlan';
import { PortalQuiz } from '../portal/PortalQuiz';
import { PortalTranscript } from '../portal/PortalTranscript';
import { PortalVentureBoard } from '../portal/PortalVentureBoard';
import { FacultyLayout } from '../faculty/FacultyLayout';
import { FacultyProjects } from '../faculty/FacultyProjects';
import { FacultyProjectCandidates } from '../faculty/FacultyProjectCandidates';
import { RequireAdvisor, RequireStudent, RequireProfessor } from '../auth/RequireRole';

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    // Every route under here requires an advisor session (auth/RequireRole.tsx)
    // — a student or professor session is redirected to their own pages instead.
    element: <RequireAdvisor />,
    children: [
      {
        path: '/',
        element: <Layout />,
        children: [
          { index: true, element: <Home /> },
          { path: 'students/:id', element: <StudentFile /> },
          { path: 'students/:id/curriculum', element: <Curriculum /> },
          { path: 'students/:id/advise', element: <AdviseFlow /> },
          { path: 'students/:id/target-cgpa', element: <TargetCgpaPlanner /> },
          { path: 'students/:id/quiz', element: <DepartmentFitQuiz /> },
          { path: 'students/:id/probation-history', element: <ProbationHistory /> },
          { path: 'students/:id/proposals', element: <ProposalReview /> },
          { path: 'advisor-console', element: <AdvisorConsole /> },
        ],
      },
    ],
  },
  {
    // Spec §15.1 — the student portal. RequireStudent (bound at this path
    // level, where `:id` is defined) enforces that a student session can
    // only ever land on THEIR OWN id — no other student's portal, no
    // advisor/professor pages.
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
    // Spec §16.6 — the Faculty Console. Same own-id-only shape as the
    // student portal — a professor can only ever land on their own console.
    path: '/faculty/:id',
    element: <RequireProfessor />,
    children: [
      {
        element: <FacultyLayout />,
        children: [
          { index: true, element: <FacultyProjects /> },
          { path: ':projectId', element: <FacultyProjectCandidates /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
