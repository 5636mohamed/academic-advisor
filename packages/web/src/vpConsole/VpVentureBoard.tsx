// VP epic — "VP also gets Venture Board access with the ability to post
// projects like any professor." Full reuse of the advisor console's own
// Venture Board component, scoped to 'vp-owned' only. Per explicit
// request, this no longer cross-views every advisor's ventures — the VP's
// own board now behaves exactly like any advisor's own board (see
// AdvisorVentureBoard.tsx's own header comment): post/manage/review
// candidates for the VP's OWN postings only. Cross-advisor funding
// oversight lives on the VP's Innovation Topography page instead
// (VpInnovationTopography.tsx's "Venture Grant Requests" section).
import { AdvisorVentureBoard } from '../advisorConsole/venture/AdvisorVentureBoard';

export function VpVentureBoard() {
  return <AdvisorVentureBoard professorId="vp-owned" />;
}
