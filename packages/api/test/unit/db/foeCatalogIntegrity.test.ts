// Real-department expansion — sanity checks over every seeded FoE program
// catalog (`CATALOG_BY_DEPARTMENT`, sourced from `FOE Handbook.pdf`). Not
// testing any one program's specific content (that's just transcription),
// but the structural invariants every catalog must hold for the rest of
// the app (prereq graph, milestone generator, advising cycle) to work
// against it safely.
import { describe, it, expect } from 'vitest';
import { CATALOG, CATALOG_BY_CODE, CATALOG_BY_DEPARTMENT } from '../../../src/db/seed/seedCatalog';

describe('FoE catalog integrity — every real department', () => {
  it('every seeded department has a non-empty catalog', () => {
    const departmentIds = Object.keys(CATALOG_BY_DEPARTMENT);
    expect(departmentIds.length).toBeGreaterThan(0);
    for (const id of departmentIds) {
      expect(CATALOG_BY_DEPARTMENT[id].length).toBeGreaterThan(30); // shared sem 1-3 alone is ~30
    }
  });

  it('every department catalog has no internally-duplicated course code', () => {
    for (const [deptId, courses] of Object.entries(CATALOG_BY_DEPARTMENT)) {
      const codes = courses.map(c => c.code);
      expect(new Set(codes).size, `duplicate code within ${deptId}'s own catalog`).toBe(codes.length);
    }
  });

  it('every course has plausible credits/semester/level values', () => {
    for (const course of CATALOG) {
      expect(course.credits, course.code).toBeGreaterThan(0);
      expect(course.credits, course.code).toBeLessThanOrEqual(10); // grad project (2) is the outlier at 7
      expect(course.semesterOrdinal, course.code).toBeGreaterThanOrEqual(1);
      expect(course.semesterOrdinal, course.code).toBeLessThanOrEqual(9);
      expect(course.level, course.code).toBeGreaterThanOrEqual(1);
      expect(course.level, course.code).toBeLessThanOrEqual(5);
    }
  });

  it('every prereq/coreq code resolves to a real course in the global catalog (no dangling reference)', () => {
    const missing: string[] = [];
    for (const course of CATALOG) {
      for (const code of [...course.prereq, ...course.coreq]) {
        if (!CATALOG_BY_CODE[code]) missing.push(`${course.code} -> ${code}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('a prereq is never scheduled at a later semester than the course that requires it (no forward-reference)', () => {
    const violations: string[] = [];
    for (const course of CATALOG) {
      for (const code of course.prereq) {
        const prereqCourse = CATALOG_BY_CODE[code];
        if (prereqCourse && prereqCourse.semesterOrdinal > course.semesterOrdinal) {
          violations.push(`${course.code} (sem ${course.semesterOrdinal}) requires ${code} (sem ${prereqCourse.semesterOrdinal})`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('CATALOG_BY_CODE has no fewer entries than the union of every department catalog\'s distinct codes (dedup, not data loss)', () => {
    const allCodes = new Set(Object.values(CATALOG_BY_DEPARTMENT).flat().map(c => c.code));
    expect(Object.keys(CATALOG_BY_CODE).length).toBe(allCodes.size);
  });
});
