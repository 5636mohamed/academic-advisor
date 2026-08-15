// AMENDMENT 1 (see advisingCycle.service.ts's file header) — validates the
// warning-ladder-driven tier escalation requested directly by the product
// owner: 1st/2nd warning = normal recommendation, 3rd = internal transfer,
// 4th (and 5th) = faculty transfer. Deliberately separate from
// decideAdvisingAction.test.ts (which still covers the ORIGINAL §11
// trend-based examples, unmodified, proving warningCount=0 preserves them
// exactly).
import { describe, it, expect } from 'vitest';
import { decideAdvisingAction, DeptFitResult } from '../../../src/modules/advising/advisingCycle.service';

const flatTrend = { slope: -0.02 as number | null, reading: 'declining' as const };
const emptyPlan: any[] = [];

const cseDept: DeptFitResult = { id: 'CSE', name: 'Computer Science', total: 0.9, quizScore: 1, gwScore: 0.9, alumScore: 0.8 };
const facultyFit: DeptFitResult[] = [{ id: 'BUS', name: 'Business Informatics', total: 0.7, quizScore: 0.8, gwScore: 0.6, alumScore: 0.7 }];

function baseParams(overrides: Partial<Parameters<typeof decideAdvisingAction>[0]> = {}) {
  return {
    currentCgpa: 1.85,
    plan: emptyPlan,
    projectedCGPA: 1.90,
    trend: flatTrend,
    bestInternalDept: cseDept,
    simulateBestInternal: { projectedCGPA: 2.4, trend: { slope: 0.05, reading: 'improving' as const } },
    alreadyTransferredInternallyOnce: false,
    facultyFit,
    ...overrides,
  };
}

describe('AMENDMENT 1 — warning-ladder tier escalation', () => {
  it('warningCount = 1 -> SHOW_PLAN ("normal recommendation"), even though the trend is declining', () => {
    const result = decideAdvisingAction(baseParams({ warningCount: 1 }));
    expect(result.action).toBe('SHOW_PLAN');
    expect(result.explain).toBe('probation_warning_1_or_2_normal_recommendation');
  });

  it('warningCount = 2 -> SHOW_PLAN ("normal recommendation")', () => {
    const result = decideAdvisingAction(baseParams({ warningCount: 2 }));
    expect(result.action).toBe('SHOW_PLAN');
    expect(result.explain).toBe('probation_warning_1_or_2_normal_recommendation');
  });

  it('warningCount = 3 -> RECOMMEND_INTERNAL_TRANSFER with the best-fit department', () => {
    const result = decideAdvisingAction(baseParams({ warningCount: 3 }));
    expect(result.action).toBe('RECOMMEND_INTERNAL_TRANSFER');
    expect(result.explain).toBe('probation_warning_3_internal_transfer_recommended');
    expect(result.suggestedDepartmentId).toBe('CSE');
  });

  it('warningCount = 3 but the student already used their one internal-transfer hop -> escalates straight to RECOMMEND_FACULTY_TRANSFER (§4.2.1 guard still applies)', () => {
    const result = decideAdvisingAction(baseParams({ warningCount: 3, alreadyTransferredInternallyOnce: true }));
    expect(result.action).toBe('RECOMMEND_FACULTY_TRANSFER');
    expect(result.explain).toBe('probation_warning_3_internal_transfer_already_used_escalating_to_faculty');
    expect(result.suggestedFaculties).toEqual(facultyFit);
  });

  it('warningCount = 3 with no internal department candidate at all -> also escalates to faculty transfer', () => {
    const result = decideAdvisingAction(baseParams({ warningCount: 3, bestInternalDept: null }));
    expect(result.action).toBe('RECOMMEND_FACULTY_TRANSFER');
  });

  it('warningCount = 4 -> RECOMMEND_FACULTY_TRANSFER', () => {
    const result = decideAdvisingAction(baseParams({ warningCount: 4 }));
    expect(result.action).toBe('RECOMMEND_FACULTY_TRANSFER');
    expect(result.explain).toBe('probation_warning_4_plus_faculty_transfer_recommended');
    expect(result.suggestedFaculties).toEqual(facultyFit);
  });

  it('warningCount = 5 -> still RECOMMEND_FACULTY_TRANSFER (does not regress to a weaker tier before dismissal at 6)', () => {
    const result = decideAdvisingAction(baseParams({ warningCount: 5 }));
    expect(result.action).toBe('RECOMMEND_FACULTY_TRANSFER');
  });

  // Product-owner refinement: a student who has recovered to a clearly
  // healthy CURRENT cgpa (> 3.0) should never be pushed into a transfer
  // recommendation just because of a stale warning-ladder count.
  it('warningCount = 3 but currentCgpa has recovered above 3.0 -> SHOW_PLAN, not a transfer', () => {
    const result = decideAdvisingAction(baseParams({ warningCount: 3, currentCgpa: 3.2 }));
    expect(result.action).toBe('SHOW_PLAN');
    expect(result.explain).toBe('warning_ladder_overridden_by_recovered_cgpa');
  });

  it('warningCount = 4 but currentCgpa has recovered above 3.0 -> SHOW_PLAN, not a transfer', () => {
    const result = decideAdvisingAction(baseParams({ warningCount: 4, currentCgpa: 3.5 }));
    expect(result.action).toBe('SHOW_PLAN');
    expect(result.explain).toBe('warning_ladder_overridden_by_recovered_cgpa');
  });

  it('warningCount = 3 with currentCgpa AT exactly 3.0 (not above) still escalates — the recovery bar is > 3.0, not >=', () => {
    const result = decideAdvisingAction(baseParams({ warningCount: 3, currentCgpa: 3.0 }));
    expect(result.action).toBe('RECOMMEND_INTERNAL_TRANSFER');
  });

  it('warningCount = 0 (default, omitted entirely) falls back to the ORIGINAL trend-based tiering — unaffected by this amendment', () => {
    // Same inputs as the warningCount>=1 cases above, but omitting warningCount
    // entirely (defaults to 0): with a declining trend and CGPA still < 2.00,
    // the ORIGINAL tier-3 logic fires (currentCgpa < 2.0 explain reason),
    // NOT any of the new probation_warning_* explain strings.
    const { warningCount, ...withoutWarningCount } = baseParams({ warningCount: 3 });
    const result = decideAdvisingAction(withoutWarningCount);
    expect(result.action).toBe('RECOMMEND_FACULTY_TRANSFER');
    expect(result.explain).toBe('cgpa_remains_below_2_after_projection'); // the OLD explain string, not the new ladder-driven one
  });

  it('warningCount = 0 with a genuinely improving plan+trend still returns the original SHOW_PLAN tier-1 result', () => {
    const result = decideAdvisingAction(
      baseParams({ warningCount: 0, currentCgpa: 3.0, projectedCGPA: 3.2, trend: { slope: 0.05, reading: 'improving' } })
    );
    expect(result.action).toBe('SHOW_PLAN');
    expect(result.explain).toBe('plan_projected_to_raise_cgpa'); // original explain string, unchanged by the amendment
  });
});
