import { describe, it, expect } from 'vitest';
import {
  forecastCourseDemand,
  forecastDepartmentDemand,
  forecastAllDepartments,
} from '../../../src/modules/curriculumAnalytics/resourceForecast.service';
import { Course, CourseOffering } from '@advisor/shared';

function course(overrides: Partial<Course> & Pick<Course, 'code'>): Course {
  return {
    name: overrides.code,
    credits: 3,
    level: 1,
    semesterOrdinal: 3,
    category: 'program', // classSize 55 in CATEGORY_BASELINE
    isUR: false,
    isBasicScience: false,
    departmentId: 'ECE',
    prereq: [],
    coreq: [],
    transferable: true,
    ...overrides,
  };
}

function offeringsSeries(courseCode: string, enrolledSeries: number[]): CourseOffering[] {
  return enrolledSeries.map((enrolled, i) => ({
    courseCode,
    term: i % 2 === 0 ? 'Fall' : 'Spring',
    year: 2023 + Math.floor(i / 2),
    enrolled,
    passed: Math.round(enrolled * 0.8),
    meanPct: 74,
    stdDevPct: 8,
  }));
}

describe('forecastCourseDemand (Curriculum Analytics — Feature 1)', () => {
  it('a genuinely rising-enrollment course forecasts higher than its most recent real term', () => {
    const c = course({ code: 'RISE1' });
    const offerings = offeringsSeries('RISE1', [30, 34, 38, 42, 46, 50]); // steady real upward trend
    const result = forecastCourseDemand(c, offerings);
    expect(result.trendSlope).toBeGreaterThan(0);
    expect(result.nextTermEnrolled).toBeGreaterThan(50);
  });

  it('a genuinely declining-enrollment course forecasts lower than its most recent real term', () => {
    const c = course({ code: 'DECLINE1' });
    const offerings = offeringsSeries('DECLINE1', [50, 46, 42, 38, 34, 30]);
    const result = forecastCourseDemand(c, offerings);
    expect(result.trendSlope).toBeLessThan(0);
    expect(result.nextTermEnrolled).toBeLessThan(30);
  });

  it('a flat-enrollment course forecasts close to its own steady historical value', () => {
    const c = course({ code: 'FLAT1' });
    const offerings = offeringsSeries('FLAT1', [40, 40, 40, 40, 40, 40]);
    const result = forecastCourseDemand(c, offerings);
    expect(result.trendSlope).toBeCloseTo(0, 1);
    expect(result.nextTermEnrolled).toBe(40);
    expect(result.confidenceBand).toBe(0); // zero residual spread — the fit is exact
  });

  it('forecastedSections scales with forecasted enrollment relative to the course category\'s typical class size', () => {
    const c = course({ code: 'BIG1' });
    // category 'program' -> classSize 55; forecasted ~165 -> 3 sections
    const offerings = offeringsSeries('BIG1', [160, 162, 164, 166, 168, 170]);
    const result = forecastCourseDemand(c, offerings);
    expect(result.forecastedSections).toBeGreaterThanOrEqual(3);
    expect(result.forecastedInstructorLoad).toBe(result.forecastedSections);
  });

  it('a course with no offering history at all still returns a sane, non-crashing forecast', () => {
    const c = course({ code: 'NEW1' });
    const result = forecastCourseDemand(c, []);
    expect(Number.isFinite(result.nextTermEnrolled)).toBe(true);
    expect(result.history).toEqual([]);
    expect(result.forecastedSections).toBeGreaterThanOrEqual(1);
  });
});

describe('forecastDepartmentDemand / forecastAllDepartments — aggregation', () => {
  it('department totals are the exact sum of every course\'s own forecast', () => {
    const c1 = course({ code: 'A1' });
    const c2 = course({ code: 'A2' });
    const offeringsByCourse = {
      A1: offeringsSeries('A1', [30, 30, 30, 30, 30, 30]),
      A2: offeringsSeries('A2', [20, 20, 20, 20, 20, 20]),
    };
    const dept = forecastDepartmentDemand('ECE', [c1, c2], offeringsByCourse);
    expect(dept.courses).toHaveLength(2);
    expect(dept.totalNextTermEnrolled).toBe(dept.courses.reduce((s, c) => s + c.nextTermEnrolled, 0));
    expect(dept.totalForecastedSections).toBe(dept.courses.reduce((s, c) => s + c.forecastedSections, 0));
  });

  it('forecastAllDepartments produces one entry per department key, matching the input catalog map exactly', () => {
    const catalogByDepartment = {
      ECE: [course({ code: 'E1' })],
      CSE: [course({ code: 'C1', departmentId: 'CSE' })],
    };
    const offeringsByCourse = {
      E1: offeringsSeries('E1', [30, 30, 30, 30, 30, 30]),
      C1: offeringsSeries('C1', [40, 40, 40, 40, 40, 40]),
    };
    const all = forecastAllDepartments(catalogByDepartment, offeringsByCourse);
    expect(all.map(d => d.departmentId).sort()).toEqual(['CSE', 'ECE']);
  });
});
