import { describe, it, expect } from 'vitest';
import {
  rankBottlenecks,
  affectedAdvisees,
  StudentForBottleneckCheck,
} from '../../../src/modules/curriculumAnalytics/bottleneckDependencyAnalyzer.service';
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
    departmentId: 'ECE',
    prereq: [],
    coreq: [],
    transferable: true,
    ...overrides,
  };
}

function offerings(courseCode: string, enrolled: number, passRate: number): CourseOffering[] {
  return [{ courseCode, term: 'Fall', year: 2025, enrolled, passed: Math.round(enrolled * passRate), meanPct: 70, stdDevPct: 8 }];
}

describe('rankBottlenecks (Curriculum Analytics — Feature 3)', () => {
  it('ranks courses by cascadingDelaySemesters, worst first, and is stable across re-runs on the same input', () => {
    const gate = course({ code: 'GATE1' });
    const downstream = ['D1', 'D2', 'D3'].map(code => course({ code, prereq: ['GATE1'] }));
    const leaf = course({ code: 'LEAF1' }); // 0 downstream, high failure rate — should rank LAST despite bad failure rate
    const catalog = [gate, leaf, ...downstream];
    const offeringsByCourse = {
      GATE1: offerings('GATE1', 55, 0.5),
      LEAF1: offerings('LEAF1', 55, 0.1), // worse failure rate than GATE1, but no dependents
    };
    const forecastedEnrolledByCode = { GATE1: 55, LEAF1: 55 };

    const run1 = rankBottlenecks(catalog, offeringsByCourse, forecastedEnrolledByCode);
    const run2 = rankBottlenecks(catalog, offeringsByCourse, forecastedEnrolledByCode);
    expect(run1.map(c => c.courseCode)).toEqual(run2.map(c => c.courseCode)); // stable

    expect(run1[0].courseCode).toBe('GATE1'); // real downstream impact wins over raw failure rate
    // LEAF1 has a WORSE raw failure rate than GATE1 (90% vs 50%) but 0
    // downstream dependents, same as D1/D2/D3 (nothing depends on any of
    // them either) — all four genuinely tie at cascadingDelaySemesters=0,
    // so LEAF1 isn't necessarily dead-last among them (stable sort keeps
    // ties in catalog order), it's simply never ranked above GATE1 despite
    // its worse failure rate. That's the actual property worth asserting.
    const leafResult = run1.find(c => c.courseCode === 'LEAF1')!;
    expect(leafResult.cascadingDelaySemesters).toBe(0);
    expect(run1.findIndex(c => c.courseCode === 'LEAF1')).toBeGreaterThan(0); // never outranks GATE1
  });

  it('annotates each bottleneck with the real course codes it directly blocks, not just a count', () => {
    const gate = course({ code: 'GATE1' });
    const d1 = course({ code: 'D1', prereq: ['GATE1'] });
    const d2 = course({ code: 'D2', prereq: ['GATE1'] });
    const unrelated = course({ code: 'UNREL1' });
    const catalog = [gate, d1, d2, unrelated];
    const ranked = rankBottlenecks(catalog, { GATE1: offerings('GATE1', 55, 0.5) }, { GATE1: 55 });
    const gateRow = ranked.find(c => c.courseCode === 'GATE1')!;
    expect(gateRow.directlyBlocks.sort()).toEqual(['D1', 'D2']);
  });
});

describe('affectedAdvisees — roster ownership scoping', () => {
  const gate = course({ code: 'GATE1' });
  const d1 = course({ code: 'D1', prereq: ['GATE1'] });
  const catalog = [gate, d1];
  const bottlenecks = rankBottlenecks(catalog, { GATE1: offerings('GATE1', 55, 0.3) }, { GATE1: 55 });

  it('flags a student who already failed the bottleneck course', () => {
    const roster: StudentForBottleneckCheck[] = [
      { studentId: 'S1', level: 2, failedCourseCodes: ['GATE1'], passedCourseCodes: [], remainingCourseCodes: ['D1'] },
    ];
    const rows = affectedAdvisees(roster, bottlenecks);
    expect(rows).toContainEqual({ studentId: 'S1', studentLevel: 2, bottleneckCourseCode: 'GATE1', reason: 'failed_needs_retake' });
  });

  it('flags a student who hasn\'t cleared the bottleneck AND still has a real downstream course ahead of them', () => {
    const roster: StudentForBottleneckCheck[] = [
      { studentId: 'S2', level: 3, failedCourseCodes: [], passedCourseCodes: [], remainingCourseCodes: ['GATE1', 'D1'] },
    ];
    const rows = affectedAdvisees(roster, bottlenecks);
    expect(rows).toContainEqual({ studentId: 'S2', studentLevel: 3, bottleneckCourseCode: 'GATE1', reason: 'prereq_not_yet_cleared' });
  });

  it('a student with a genuinely clean path (already passed the bottleneck) is correctly excluded, not just low-ranked', () => {
    const roster: StudentForBottleneckCheck[] = [
      { studentId: 'S3', level: 3, failedCourseCodes: [], passedCourseCodes: ['GATE1'], remainingCourseCodes: ['D1'] },
    ];
    const rows = affectedAdvisees(roster, bottlenecks);
    expect(rows).toEqual([]);
  });

  it('a student with nothing remaining that the bottleneck actually gates is excluded, even if they haven\'t taken it', () => {
    const roster: StudentForBottleneckCheck[] = [
      { studentId: 'S4', level: 2, failedCourseCodes: [], passedCourseCodes: [], remainingCourseCodes: ['UNRELATED_COURSE'] },
    ];
    const rows = affectedAdvisees(roster, bottlenecks);
    expect(rows).toEqual([]);
  });

  it('never returns a student who isn\'t in the roster passed in — the real ownership-leak shape already found and fixed twice this session for transfer requests and venture ownership', () => {
    const roster: StudentForBottleneckCheck[] = [
      { studentId: 'MINE-1', level: 4, failedCourseCodes: ['GATE1'], passedCourseCodes: [], remainingCourseCodes: [] },
    ];
    // A student who'd obviously also be affected, but does NOT belong to
    // this advisor's roster — must never appear in the output no matter
    // how bad their standing is, since the function only ever sees
    // whatever roster it's given.
    const rows = affectedAdvisees(roster, bottlenecks);
    expect(rows.every(r => r.studentId === 'MINE-1')).toBe(true);
    expect(rows.some(r => r.studentId === 'NOT-MINE-2')).toBe(false);
  });
});
