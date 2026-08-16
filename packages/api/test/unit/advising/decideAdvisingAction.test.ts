// Covers spec §11 Examples A, H, I, J and the §4.2.1 anti-loop guard.
// `decideAdvisingAction` is pure — no ports/DB needed — so these fixtures
// hand-construct the trend/fit inputs the orchestrator would normally
// gather from `AdvisingCyclePorts`.
import { describe, it, expect } from 'vitest';
import { decideAdvisingAction, DeptFitResult } from '../../../src/modules/advising/advisingCycle.service';

const emptyPlan: any[] = [];

const cse: DeptFitResult = { id: 'cse', name: 'CSE', total: 0.81, quizScore: 0.8, gwScore: 0.85, alumScore: 0.75 };
const commerce: DeptFitResult = { id: 'commerce', name: 'Business Informatics', total: 0.74, quizScore: 0.7, gwScore: 0.7, alumScore: 0.85 };

describe('decideAdvisingAction — §4.2', () => {
  it('Example A — improving plan and positive trend → SHOW_PLAN', () => {
    const result = decideAdvisingAction({
      currentCgpa: 3.1,
      plan: emptyPlan,
      projectedCGPA: 3.24,
      trend: { slope: 0.05, reading: 'improving' },
      bestInternalDept: null,
      simulateBestInternal: null,
      alreadyTransferredInternallyOnce: false,
      facultyFit: [],
    });
    expect(result.action).toBe('SHOW_PLAN');
    expect(result.explain).toBe('plan_projected_to_raise_cgpa');
  });

  it('Example H — CGPA >= 2.00 but declining trend, better in-faculty dept improves it → RECOMMEND_INTERNAL_TRANSFER', () => {
    const result = decideAdvisingAction({
      currentCgpa: 2.15,
      plan: emptyPlan,
      projectedCGPA: 2.16, // plan alone barely moves the needle -> not "improving" per isImprovingCase w/ declining trend
      trend: { slope: -0.02, reading: 'declining' },
      bestInternalDept: cse,
      simulateBestInternal: { projectedCGPA: 2.4, trend: { slope: 0.03, reading: 'improving' } },
      alreadyTransferredInternallyOnce: false,
      facultyFit: [],
    });
    expect(result.action).toBe('RECOMMEND_INTERNAL_TRANSFER');
    expect(result.suggestedDepartmentId).toBe('cse');
  });

  it('Example I — CGPA below 2.00, no in-faculty dept helps → RECOMMEND_FACULTY_TRANSFER with cgpa_remains_below_2 explain', () => {
    const result = decideAdvisingAction({
      currentCgpa: 1.75,
      plan: emptyPlan,
      projectedCGPA: 1.78,
      trend: { slope: -0.03, reading: 'declining' },
      bestInternalDept: null, // no department in-faculty projects an improving trend
      simulateBestInternal: null,
      alreadyTransferredInternallyOnce: false,
      facultyFit: [commerce],
    });
    expect(result.action).toBe('RECOMMEND_FACULTY_TRANSFER');
    expect(result.explain).toBe('cgpa_remains_below_2_after_projection');
    expect(result.suggestedFaculties).toEqual([commerce]);
  });

  it('Example I variant — CGPA below 2.00 even though a dept fit exists, tier-2 gate requires currentCgpa >= 2.00 → still faculty transfer', () => {
    const result = decideAdvisingAction({
      currentCgpa: 1.75,
      plan: emptyPlan,
      projectedCGPA: 1.9,
      trend: { slope: -0.03, reading: 'declining' },
      bestInternalDept: cse, // even if a dept LOOKS better-fitting, §4.2's tier-2 branch requires cgpa >= 2.00
      simulateBestInternal: { projectedCGPA: 2.1, trend: { slope: 0.02, reading: 'improving' } },
      alreadyTransferredInternallyOnce: false,
      facultyFit: [commerce],
    });
    expect(result.action).toBe('RECOMMEND_FACULTY_TRANSFER');
  });

  it('Example J — already transferred internally once → skip tier 2, go straight to faculty transfer', () => {
    const result = decideAdvisingAction({
      currentCgpa: 2.2,
      plan: emptyPlan,
      projectedCGPA: 2.21,
      trend: { slope: -0.015, reading: 'declining' },
      bestInternalDept: cse,
      simulateBestInternal: { projectedCGPA: 2.5, trend: { slope: 0.04, reading: 'improving' } },
      alreadyTransferredInternallyOnce: true, // §4.2.1 guard
      facultyFit: [commerce],
    });
    expect(result.action).toBe('RECOMMEND_FACULTY_TRANSFER');
    expect(result.explain).toBe('no_departmental_alternative_improves_trend');
  });

  it('tier 2 requires the internal simulation trend slope > -0.01, not just a higher projected CGPA', () => {
    const result = decideAdvisingAction({
      currentCgpa: 2.15,
      plan: emptyPlan,
      projectedCGPA: 2.16,
      trend: { slope: -0.02, reading: 'declining' },
      bestInternalDept: cse,
      simulateBestInternal: { projectedCGPA: 2.3, trend: { slope: -0.02, reading: 'declining' } }, // still declining
      alreadyTransferredInternallyOnce: false,
      facultyFit: [commerce],
    });
    expect(result.action).toBe('RECOMMEND_FACULTY_TRANSFER');
  });

  // Product-owner refinement: the original Tier 2 (§4.2) branch only ever
  // required currentCgpa >= 2.00 — no UPPER bound — so a student doing
  // genuinely well overall (cgpa > 3.0) but with a recently flat/declining
  // trend (e.g. right after a department switch) could still get pushed
  // into an internal transfer recommendation. That's exactly the case this
  // covers: a comfortably-above-3.0 student never gets a transfer pushed,
  // regardless of trend or how much better a different department scores.
  it('a student with cgpa > 3.0 and a declining trend (e.g. right after joining a new department) still gets SHOW_PLAN, not a transfer', () => {
    const result = decideAdvisingAction({
      currentCgpa: 3.4,
      plan: emptyPlan,
      projectedCGPA: 3.41,
      trend: { slope: -0.05, reading: 'declining' }, // a real, large post-transfer dip
      bestInternalDept: cse,
      simulateBestInternal: { projectedCGPA: 3.6, trend: { slope: 0.05, reading: 'improving' } },
      alreadyTransferredInternallyOnce: false,
      facultyFit: [commerce],
    });
    expect(result.action).toBe('SHOW_PLAN');
    expect(result.explain).toBe('cgpa_comfortably_above_3_no_transfer_needed');
  });

  it('Example L — insufficient trend history defaults to SHOW_PLAN when the plan itself improves', () => {
    const result = decideAdvisingAction({
      currentCgpa: 2.6,
      plan: emptyPlan,
      projectedCGPA: 2.7,
      trend: { slope: null, reading: 'insufficient_history' },
      bestInternalDept: cse,
      simulateBestInternal: { projectedCGPA: 2.9, trend: { slope: 0.05, reading: 'improving' } },
      alreadyTransferredInternallyOnce: false,
      facultyFit: [],
    });
    expect(result.action).toBe('SHOW_PLAN');
  });
});
