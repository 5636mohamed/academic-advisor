import { describe, it, expect } from 'vitest';
import { buildHealthMonitor } from '../../../src/modules/curriculumAnalytics/curriculumHealthMonitor.service';
import { Course, CourseOffering } from '@advisor/shared';

function course(overrides: Partial<Course> & Pick<Course, 'code'>): Course {
  return {
    name: overrides.code,
    credits: 3,
    level: 1,
    semesterOrdinal: 1,
    category: 'program',
    isUR: false,
    isBasicScience: false,
    departmentId: null,
    prereq: [],
    coreq: [],
    transferable: true,
    ...overrides,
  };
}

function flatOfferings(courseCode: string, enrolled: number, passRate: number): CourseOffering[] {
  return [{ courseCode, term: 'Fall', year: 2025, enrolled, passed: Math.round(enrolled * passRate), meanPct: 70, stdDevPct: 8 }];
}

describe('buildHealthMonitor (Curriculum Analytics — Feature 2)', () => {
  it('a shared (departmentId: null) course used by multiple departments\' catalogs is counted exactly ONCE in the VP\'s all-department view', () => {
    // Real seed shape: a shared course like MTH111 appears as an actual
    // member of EVERY department's own catalog array (ECE_CATALOG,
    // CSE_CATALOG, ...), not just once globally — see seedCatalog.ts's
    // CATALOG_BY_DEPARTMENT. If buildHealthMonitor ever re-flattened
    // catalogByDepartment for the VP's unscoped view instead of using the
    // already-deduplicated `catalog` param, this course would be counted
    // once per department it appears in.
    const shared = course({ code: 'SHARED1', departmentId: null });
    const eceOnly = course({ code: 'ECE_ONLY', departmentId: 'ECE' });
    const catalogByDepartment = {
      ECE: [shared, eceOnly],
      CSE: [shared, course({ code: 'CSE_ONLY', departmentId: 'CSE' })],
    };
    const dedupedCatalog = [shared, eceOnly, catalogByDepartment.CSE[1]]; // what seedCatalog.ts's real dedupeByCode would produce
    const offeringsByCourse = {
      SHARED1: flatOfferings('SHARED1', 100, 0.8),
      ECE_ONLY: flatOfferings('ECE_ONLY', 50, 0.8),
      CSE_ONLY: flatOfferings('CSE_ONLY', 50, 0.8),
    };

    const vpReport = buildHealthMonitor(null, catalogByDepartment, dedupedCatalog, offeringsByCourse);
    expect(vpReport.totalCourses).toBe(3); // not 4 — SHARED1 counted once, not twice
    expect(vpReport.allCourses.filter(c => c.courseCode === 'SHARED1')).toHaveLength(1);
  });

  it('single-department mode scopes to exactly that department\'s own catalog, including its own shared courses', () => {
    const shared = course({ code: 'SHARED1', departmentId: null });
    const eceOnly = course({ code: 'ECE_ONLY', departmentId: 'ECE' });
    const catalogByDepartment = { ECE: [shared, eceOnly], CSE: [shared] };
    const offeringsByCourse = {
      SHARED1: flatOfferings('SHARED1', 100, 0.8),
      ECE_ONLY: flatOfferings('ECE_ONLY', 50, 0.8),
    };
    const eceReport = buildHealthMonitor('ECE', catalogByDepartment, [shared, eceOnly], offeringsByCourse);
    expect(eceReport.totalCourses).toBe(2);
    expect(eceReport.allCourses.map(c => c.courseCode).sort()).toEqual(['ECE_ONLY', 'SHARED1']);
  });

  it('worstCourses is sorted ascending by healthScore (worst first)', () => {
    const good = course({ code: 'GOOD1' });
    const bad = course({ code: 'BAD1' });
    const mediocre = course({ code: 'MED1' });
    const catalogByDepartment = { ECE: [good, bad, mediocre] };
    const catalog = [good, bad, mediocre];
    const offeringsByCourse = {
      GOOD1: flatOfferings('GOOD1', 50, 0.98),
      BAD1: flatOfferings('BAD1', 50, 0.3),
      MED1: flatOfferings('MED1', 50, 0.7),
    };
    const report = buildHealthMonitor('ECE', catalogByDepartment, catalog, offeringsByCourse);
    const scores = report.worstCourses.map(c => c.healthScore);
    expect(scores).toEqual([...scores].sort((a, b) => a - b));
    expect(report.worstCourses[0].courseCode).toBe('BAD1');
  });

  it('coursesAtRisk matches a manual count against the configured atRiskThreshold', () => {
    const good = course({ code: 'GOOD1' });
    const bad = course({ code: 'BAD1' });
    const catalogByDepartment = { ECE: [good, bad] };
    const catalog = [good, bad];
    const offeringsByCourse = {
      GOOD1: flatOfferings('GOOD1', 50, 0.98),
      BAD1: flatOfferings('BAD1', 50, 0.2),
    };
    const report = buildHealthMonitor('ECE', catalogByDepartment, catalog, offeringsByCourse);
    const manualCount = report.allCourses.filter(c => c.healthScore < 55).length; // predictionWeights.json's atRiskThreshold
    expect(report.coursesAtRisk).toBe(manualCount);
  });

  it('an empty department (no courses seeded) returns a well-formed, non-crashing empty report', () => {
    const report = buildHealthMonitor('GHOST', {}, [], {});
    expect(report.totalCourses).toBe(0);
    expect(report.averageHealthScore).toBe(100);
    expect(report.worstCourses).toEqual([]);
  });
});
