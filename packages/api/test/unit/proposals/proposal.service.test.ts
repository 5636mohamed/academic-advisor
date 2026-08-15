// Covers spec §15.3.2's lifecycle state transitions.
import { describe, it, expect } from 'vitest';
import {
  buildProposalsFromPlan,
  approveProposal,
  declineProposal,
  buildAdvisorAlternate,
  chooseProposal,
} from '../../../src/modules/proposals/proposal.service';
import { CandidateCourseScore } from '@advisor/shared';

function candidate(overrides: Partial<CandidateCourseScore>): CandidateCourseScore {
  return {
    courseCode: 'ECE314',
    isRetake: false,
    oldPoints: null,
    expectedPct: 71,
    expectedLetter: 'C',
    expectedPoints: 2.3,
    deltaPts: null,
    chainUnlockValue: 2,
    passRate: 85,
    score: 50,
    mandatory: false,
    ...overrides,
  };
}

describe('buildProposalsFromPlan — §15.3.2 step 1', () => {
  it('excludes mandatory retakes, includes only the optional pool', () => {
    const plan = [candidate({ courseCode: 'PHY121', mandatory: true }), candidate({ courseCode: 'ECE314', mandatory: false })];
    const proposals = buildProposalsFromPlan('s1', plan, {});
    expect(proposals.map(p => p.courseCode)).toEqual(['ECE314']);
    expect(proposals[0].origin).toBe('system');
    expect(proposals[0].status).toBe('pending');
    expect(proposals[0].advisorApproved).toBe(false);
    expect(proposals[0].slotKey).toBe('ECE314');
  });

  it('attaches the given best-case fields, falling back to expected if missing', () => {
    const plan = [candidate({ courseCode: 'ECE314' })];
    const proposals = buildProposalsFromPlan('s1', plan, {
      ECE314: { bestCasePct: 92, bestCaseLetter: 'A', bestCasePoints: 4.0 },
    });
    expect(proposals[0].bestCasePct).toBe(92);
    const withoutBestCase = buildProposalsFromPlan('s1', plan, {});
    expect(withoutBestCase[0].bestCasePct).toBe(71); // falls back to expectedPct
  });
});

describe('approve / decline — §15.3.2 step 2(a)/(c)', () => {
  it('approve flips advisorApproved and status', () => {
    const [p] = buildProposalsFromPlan('s1', [candidate({})], {});
    const approved = approveProposal(p);
    expect(approved.advisorApproved).toBe(true);
    expect(approved.status).toBe('advisor_approved');
  });

  it('decline sets status to declined without touching advisorApproved', () => {
    const [p] = buildProposalsFromPlan('s1', [candidate({})], {});
    const declined = declineProposal(p);
    expect(declined.status).toBe('declined');
  });
});

describe('buildAdvisorAlternate — §15.3.2 step 2(b)', () => {
  it('is always created already advisor_approved, linked to the original slot', () => {
    const alt = buildAdvisorAlternate({
      studentId: 's1',
      slotKey: 'ECE314',
      courseCode: 'ECE322',
      expectedPct: 84,
      expectedLetter: 'B',
      expectedPoints: 3.0,
      bestCase: { bestCasePct: 95, bestCaseLetter: 'A+', bestCasePoints: 4.0 },
    });
    expect(alt.origin).toBe('advisor');
    expect(alt.advisorApproved).toBe(true);
    expect(alt.status).toBe('advisor_approved');
    expect(alt.replacesCourseCode).toBe('ECE314');
    expect(alt.slotKey).toBe('ECE314');
    expect(alt.courseCode).toBe('ECE322');
  });
});

describe('chooseProposal — §15.3.2 step 3', () => {
  it('registers immediately when the picked option is already advisor-approved', () => {
    const [p] = buildProposalsFromPlan('s1', [candidate({})], {});
    const approved = approveProposal(p);
    const result = chooseProposal(approved);
    expect(result.registered).toBe(true);
    expect(result.requiresAdvisorContact).toBe(false);
    expect(result.proposal.status).toBe('registered');
  });

  it('requires advisor contact when the picked option has not been advisor-approved (Example §15.6)', () => {
    const [p] = buildProposalsFromPlan('s1', [candidate({})], {}); // still 'pending', never reviewed
    const result = chooseProposal(p);
    expect(result.registered).toBe(false);
    expect(result.requiresAdvisorContact).toBe(true);
    expect(result.proposal.status).toBe('pending'); // unchanged
  });

  it('an advisor-authored alternate registers on pick, since it is self-approved', () => {
    const alt = buildAdvisorAlternate({
      studentId: 's1',
      slotKey: 'ECE314',
      courseCode: 'ECE322',
      expectedPct: 84,
      expectedLetter: 'B',
      expectedPoints: 3.0,
      bestCase: { bestCasePct: 95, bestCaseLetter: 'A+', bestCasePoints: 4.0 },
    });
    const result = chooseProposal(alt);
    expect(result.registered).toBe(true);
  });
});
