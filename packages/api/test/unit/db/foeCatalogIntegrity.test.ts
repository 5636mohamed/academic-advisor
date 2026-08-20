// Real-department expansion — sanity checks over every seeded FoE program
// catalog (`CATALOG_BY_DEPARTMENT`, sourced from `FOE Handbook.pdf`). Not
// testing any one program's specific content (that's just transcription),
// but the structural invariants every catalog must hold for the rest of
// the app (prereq graph, milestone generator, advising cycle) to work
// against it safely.
import { describe, it, expect, beforeEach } from 'vitest';
import { CATALOG, CATALOG_BY_CODE, CATALOG_BY_DEPARTMENT } from '../../../src/db/seed/seedCatalog';
import * as db from '../../../src/db/memory/inMemoryDb';
import { ADVISORS } from '../../../src/db/seed/seedAdvisors';

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

describe('student-facing course views are department-scoped, not the global 10-program union', () => {
  beforeEach(() => {
    db.__resetForTests();
  });

  it('getCurriculum only ever shows a student courses from their OWN department\'s real catalog — real-department expansion now assigns advisors a random cross-department roster, so this is keyed off the student\'s own departmentId, never their advisor\'s', () => {
    for (const deptId of Object.keys(CATALOG_BY_DEPARTMENT)) {
      const student = db.listStudents().find(s => s.departmentId === deptId);
      expect(student, deptId).toBeDefined();
      const view = db.getCurriculum(student!.id);
      const ownDeptCodes = new Set(CATALOG_BY_DEPARTMENT[deptId].map(c => c.code));
      const foreignCodes = view.map(v => v.course.code).filter(code => !ownDeptCodes.has(code));
      expect(foreignCodes, `student ${student!.id} (${deptId}) saw foreign codes`).toEqual([]);
      // and it's not vacuously small — a real department's own catalog, not nothing
      expect(view.length).toBe(ownDeptCodes.size);
    }
  });

  it('getEligibleCourses never recommends a course from a different department than the STUDENT\'s own (not their randomly-assigned advisor\'s)', () => {
    for (const deptId of Object.keys(CATALOG_BY_DEPARTMENT)) {
      const student = db.listStudents().find(s => s.departmentId === deptId);
      const eligible = db.getEligibleCourses(student!.id);
      const ownDeptCodes = new Set(CATALOG_BY_DEPARTMENT[deptId].map(c => c.code));
      const foreign = eligible.filter(e => !ownDeptCodes.has(e.course.code));
      expect(foreign, `student ${student!.id} (${deptId}) had foreign-department eligible courses`).toEqual([]);
    }
  });

  it('an advisor\'s own roster can genuinely span multiple departments, and every one of those students still only ever sees their own department\'s courses', () => {
    const mixedAdvisor = ADVISORS.find(a => {
      const depts = new Set(db.listStudents().filter(s => s.advisorId === a.id).map(s => s.departmentId));
      return depts.size > 1;
    });
    expect(mixedAdvisor, 'expected at least one advisor with a genuinely mixed-department roster').toBeDefined();
    const roster = db.listStudents().filter(s => s.advisorId === mixedAdvisor!.id);
    for (const student of roster) {
      const ownDeptCodes = new Set(CATALOG_BY_DEPARTMENT[student.departmentId].map(c => c.code));
      const view = db.getCurriculum(student.id);
      expect(view.every(v => ownDeptCodes.has(v.course.code)), `${student.id} (${student.departmentId}) under advisor ${mixedAdvisor!.id}`).toBe(true);
    }
  });

  it('a student externally transferred to a department with NO seeded catalog (a BUS-faculty placeholder) never sees the full cross-department union either — real bug caught by code review, not just a hypothetical', () => {
    // hassan-1 is the §11 Examples I/K external-transfer persona.
    db.executeExternalTransferForStudent('hassan-1', 'BUS', 'BIS');
    expect(db.getStudent('hassan-1')!.departmentId).toBe('BIS'); // confirm the transfer really landed here
    expect(CATALOG_BY_DEPARTMENT['BIS']).toBeUndefined(); // confirm BIS genuinely has no real seeded catalog

    const view = db.getCurriculum('hassan-1');
    const eligible = db.getEligibleCourses('hassan-1');
    // Neither view may include a 'program'-category course (every real
    // department's own named required courses) — those only belong to a
    // department with a real seeded catalog. Only shared/UR courses (and
    // BIS's own tiny gateway-course signal) are a safe fallback.
    for (const v of view) {
      expect(v.course.category, `getCurriculum leaked ${v.course.code}`).not.toBe('program');
    }
    for (const e of eligible) {
      expect(e.course.category, `getEligibleCourses leaked ${e.course.code}`).not.toBe('program');
    }
  });
});
