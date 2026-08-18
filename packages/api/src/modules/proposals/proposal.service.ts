// Spec §15.3 — the course proposal / dual-approval registration workflow.
// Pure state-transition functions, no DB access, same hexagonal style as
// the rest of modules/* — the in-memory store (or, later, a real
// repository) supplies ids/timestamps and persists the results.
import { CourseProposal, CandidateCourseScore } from '@advisor/shared';

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

export interface BestCaseFields {
  bestCasePct: number;
  bestCaseLetter: string;
  bestCasePoints: number;
}

/** §15.3.2 step 1 — turns the optimizer-chosen (non-mandatory) part of an
 *  already-computed plan into pending system proposals, one per slot.
 *  Mandatory F-grade retakes (§5.2) are deliberately excluded — they are
 *  compulsory regardless of anyone's approval. */
export function buildProposalsFromPlan(
  studentId: string,
  plan: CandidateCourseScore[],
  bestCaseByCode: Record<string, BestCaseFields>
): CourseProposal[] {
  const now = new Date().toISOString();
  return plan
    .filter(c => !c.mandatory)
    .map(c => {
      const bc = bestCaseByCode[c.courseCode] ?? {
        bestCasePct: c.expectedPct,
        bestCaseLetter: c.expectedLetter,
        bestCasePoints: c.expectedPoints,
      };
      return {
        id: nextId('prop'),
        studentId,
        slotKey: c.courseCode,
        courseCode: c.courseCode,
        origin: 'system' as const,
        expectedPct: c.expectedPct,
        expectedLetter: c.expectedLetter,
        expectedPoints: c.expectedPoints,
        bestCasePct: bc.bestCasePct,
        bestCaseLetter: bc.bestCaseLetter,
        bestCasePoints: bc.bestCasePoints,
        advisorApproved: false,
        status: 'pending' as const,
        createdAt: now,
      };
    });
}

/** §15.3.2 step 2(a) — advisor approves the system's proposal as-is. */
export function approveProposal(proposal: CourseProposal): CourseProposal {
  return { ...proposal, advisorApproved: true, status: 'advisor_approved' };
}

/** §15.3.2 step 2(c). */
export function declineProposal(proposal: CourseProposal): CourseProposal {
  return { ...proposal, status: 'declined' };
}

export interface AlternateScoreInput {
  studentId: string;
  slotKey: string;
  courseCode: string;
  expectedPct: number;
  expectedLetter: string;
  expectedPoints: number;
  bestCase: BestCaseFields;
  /** Advisor-responsibility epic — set by the caller (inMemoryDb.ts) by
   *  comparing against the slot's live system proposal; true means this
   *  alternate's expected grade is worse-or-equal, which is what the
   *  frontend's confirmation modal gates on. */
  belowOrEqualSystemGrade?: boolean;
  /** Only meaningful (and only ever provided) when belowOrEqualSystemGrade
   *  is true — the advisor's typed name from that confirmation modal. */
  acknowledgedByAdvisorName?: string;
}

/** §15.3.2 step 2(b) — an advisor-authored alternate for a slot. Always
 *  created already `advisor_approved`: the advisor is directly proposing
 *  it, there's no one else left to sign off on the advisor's own pick. */
export function buildAdvisorAlternate(input: AlternateScoreInput): CourseProposal {
  return {
    id: nextId('prop'),
    studentId: input.studentId,
    slotKey: input.slotKey,
    courseCode: input.courseCode,
    origin: 'advisor',
    replacesCourseCode: input.slotKey,
    expectedPct: input.expectedPct,
    expectedLetter: input.expectedLetter,
    expectedPoints: input.expectedPoints,
    bestCasePct: input.bestCase.bestCasePct,
    bestCaseLetter: input.bestCase.bestCaseLetter,
    bestCasePoints: input.bestCase.bestCasePoints,
    advisorApproved: true,
    status: 'advisor_approved',
    createdAt: new Date().toISOString(),
    belowOrEqualSystemGrade: input.belowOrEqualSystemGrade,
    acknowledgedByAdvisorName: input.acknowledgedByAdvisorName,
  };
}

export interface ChooseProposalResult {
  proposal: CourseProposal;
  registered: boolean;
  requiresAdvisorContact: boolean;
}

/** §15.3.2 step 3 — the student picks one option for a slot. Registering
 *  requires the picked option to already be advisor-approved; picking a
 *  not-yet-approved option (including a plain, never-reviewed system
 *  suggestion) never silently registers — it always routes to the
 *  contact-your-advisor prompt instead. */
export function chooseProposal(proposal: CourseProposal): ChooseProposalResult {
  if (proposal.advisorApproved) {
    return { proposal: { ...proposal, status: 'registered' }, registered: true, requiresAdvisorContact: false };
  }
  return { proposal, registered: false, requiresAdvisorContact: true };
}
