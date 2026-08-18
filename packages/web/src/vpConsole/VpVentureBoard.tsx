// VP epic — "VP also gets Venture Board access with the ability to post
// projects like any professor." Full reuse of the advisor console's own
// Venture Board: /api/advisor/venture-projects already returns every
// project across every professor (global, not per-advisor-scoped), so the
// only thing that actually differs for the VP is which attribution anchor
// a NEW project gets created under — 'vp-owned' instead of 'advisor-owned'
// (seedVentureProjects.ts). Everything else (pending-approvals queue,
// candidate review, "manage all ventures", the research-portal fields) is
// already global and comes along for free.
import { AdvisorVentureBoard } from '../advisorConsole/venture/AdvisorVentureBoard';

export function VpVentureBoard() {
  return <AdvisorVentureBoard professorId="vp-owned" />;
}
