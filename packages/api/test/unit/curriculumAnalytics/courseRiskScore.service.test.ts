import { describe, it, expect } from 'vitest';
import { computeCourseRisk } from '../../../src/modules/curriculumAnalytics/courseRiskScore.service';
import { Course, CourseOffering } from '@advisor/shared';

function course(overrides: Partial<Course> & Pick<Course, 'code'>): Course {
  return {
    name: overrides.name ?? overrides.code,
    credits: 3,
    level: 1,
    semesterOrdinal: 3,
    category: 'program',
    isUR: false,
    isBasicScience: false,
    departmentId: 'ECE',
    prereq: [],
    coreq: [],
    transferable: true,
    ...overrides,
  };
}

function offering(enrolled: number, passed: number): CourseOffering {
  return { courseCode: 'X', term: 'Fall', year: 2025, enrolled, passed, meanPct: 70, stdDevPct: 8 };
}

describe('computeCourseRisk (Curriculum Analytics — shared risk primitive)', () => {
  it('a course with zero offering history falls back sanely (no divide-by-zero, no NaN)', () => {
    const c = course({ code: 'NEW101' });
    const result = computeCourseRisk({ course: c, offerings: [], catalog: [c], forecastedNextTermEnrolled: 40 });
    expect(Number.isFinite(result.failureRate)).toBe(true);
    expect(Number.isFinite(result.healthScore)).toBe(true);
    expect(result.failureRate).toBe(15); // passRateFromOfferings' own documented fallback (85% pass)
  });

  it('a leaf course with no dependents never carries cascading delay, no matter how bad its failure rate', () => {
    const leaf = course({ code: 'LEAF1' });
    // 90% failure rate — as bad as it gets — but nothing depends on this course.
    const offerings = [offering(100, 10)];
    const result = computeCourseRisk({ course: leaf, offerings, catalog: [leaf], forecastedNextTermEnrolled: 55 });
    expect(result.downstreamImpact).toBe(0);
    expect(result.cascadingDelaySemesters).toBe(0);
  });

  it('a course gating many others has real cascading delay that responds monotonically to failure rate', () => {
    // GATE blocks 4 direct downstream courses.
    const gate = course({ code: 'GATE1' });
    const downstream = ['D1', 'D2', 'D3', 'D4'].map(code => course({ code, prereq: ['GATE1'] }));
    const catalog = [gate, ...downstream];

    const lowFailure = computeCourseRisk({ course: gate, offerings: [offering(100, 90)], catalog, forecastedNextTermEnrolled: 55 }); // 10% fail
    const highFailure = computeCourseRisk({ course: gate, offerings: [offering(100, 40)], catalog, forecastedNextTermEnrolled: 55 }); // 60% fail

    expect(lowFailure.downstreamImpact).toBeGreaterThan(0);
    expect(highFailure.cascadingDelaySemesters).toBeGreaterThan(lowFailure.cascadingDelaySemesters);
    expect(highFailure.healthScore).toBeLessThan(lowFailure.healthScore);
  });

  it('a 100%-pass-rate course is never penalized by failure rate or cascading delay, only (mildly) by its own chain position', () => {
    const gate = course({ code: 'EASY1' });
    const downstream = ['D1', 'D2', 'D3'].map(code => course({ code, prereq: ['EASY1'] }));
    const catalog = [gate, ...downstream];
    const result = computeCourseRisk({ course: gate, offerings: [offering(100, 100)], catalog, forecastedNextTermEnrolled: 55 });
    expect(result.failureRate).toBe(0);
    expect(result.cascadingDelaySemesters).toBe(0); // failureRate factor is 0, zeroes the whole product
    // 3 direct dependents, chainWeight=25, depth=3 -> full chainWeight
    // deduction applies (100 - 25 = 75) even at a perfect pass rate — that
    // deduction is real and expected (a heavily-depended-on course still
    // deserves scrutiny), just bounded to chainWeight's own share, never
    // dragged down further by failure/delay since there are none here.
    expect(result.healthScore).toBeGreaterThanOrEqual(70);
    expect(result.healthScore).toBeLessThanOrEqual(80);
  });

  it('demandPressure interpolation: at/under/over the saturation threshold', () => {
    const c = course({ code: 'PROG1' }); // category 'program' -> classSize 55 (CATEGORY_BASELINE)
    const offerings = [offering(100, 70)]; // 30% failure, fixed across all three cases

    const underSaturation = computeCourseRisk({ course: c, offerings, catalog: [c], forecastedNextTermEnrolled: 55 }); // pressure = 1.0
    const atSaturation = computeCourseRisk({ course: c, offerings, catalog: [c], forecastedNextTermEnrolled: Math.round(55 * 1.3) }); // pressure = 1.3 (retakeWaitTermsFor's own saturationThreshold)
    const doubleCapacity = computeCourseRisk({ course: c, offerings, catalog: [c], forecastedNextTermEnrolled: 55 * 2 }); // pressure = 2.0 (healthScore's demandWeight cap point)
    const wayOverCapacity = computeCourseRisk({ course: c, offerings, catalog: [c], forecastedNextTermEnrolled: 55 * 4 }); // pressure = 4.0, absurdly oversubscribed

    expect(underSaturation.demandPressure).toBeCloseTo(1.0, 1);
    expect(atSaturation.demandPressure).toBeCloseTo(1.3, 1);
    expect(doubleCapacity.demandPressure).toBeCloseTo(2.0, 1);

    // downstreamImpact is 0 for all of these (no dependents seeded), so
    // cascadingDelaySemesters stays 0 regardless of demand pressure —
    // demand pressure's effect on healthScore is isolated to the
    // demandWeight term, which IS sensitive to it and strictly worsens as
    // pressure rises from 1.0 -> 1.3 -> 2.0 (its own saturation point).
    expect(underSaturation.healthScore).toBeGreaterThan(atSaturation.healthScore);
    expect(atSaturation.healthScore).toBeGreaterThan(doubleCapacity.healthScore);
    // But healthScore's demandWeight term is independently capped at
    // Math.min(max(pressure-1,0),1) — it saturates at pressure=2.0, a
    // DIFFERENT (and deliberately independent) threshold from
    // retakeWaitTermsFor's own saturationThreshold=1.3. Doubling pressure
    // again (2.0 -> 4.0) must NOT move healthScore any further — that's
    // the actual proof the Math.min(...,1) cap holds, not comparing 1.3
    // against 2.0 (two genuinely different, uncapped-vs-capped points).
    expect(doubleCapacity.healthScore).toBeCloseTo(wayOverCapacity.healthScore, 1);
  });

  it('healthScore is always clamped to [0, 100] even for a maximally bad course', () => {
    const gate = course({ code: 'WORST1' });
    const manyDownstream = Array.from({ length: 10 }, (_, i) => course({ code: `D${i}`, prereq: ['WORST1'] }));
    const catalog = [gate, ...manyDownstream];
    const result = computeCourseRisk({ course: gate, offerings: [offering(100, 5)], catalog, forecastedNextTermEnrolled: 55 * 3 });
    expect(result.healthScore).toBeGreaterThanOrEqual(0);
    expect(result.healthScore).toBeLessThanOrEqual(100);
  });
});
