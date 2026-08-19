// VP epic — "VP also gets Venture Board access with the ability to post
// projects like any professor." Full reuse of the advisor console's own
// Venture Board component, with `viewAllAdvisors` so the VP's board stays
// unscoped — the advisor console's own board is now correctly scoped to
// each advisor's own postings only (a real fix; it used to show every
// advisor's ventures pooled together), but cross-advisor oversight is the
// VP's whole point here, same as everywhere else in this app. `professorId`
// stays 'vp-owned' — the single attribution anchor for whatever the VP
// posts directly (seedVentureProjects.ts).
import { AdvisorVentureBoard } from '../advisorConsole/venture/AdvisorVentureBoard';

export function VpVentureBoard() {
  return <AdvisorVentureBoard professorId="vp-owned" viewAllAdvisors />;
}
