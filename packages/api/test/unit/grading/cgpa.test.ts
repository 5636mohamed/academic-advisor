// Spec §2.2 — CGPA computation (replacement rule, base-snapshot aware).
import { describe, it, expect } from 'vitest';
import { EnrollmentRecord, Course } from '@advisor/shared';
import { computeCGPA, latestAttemptPerCourse } from '../../../src/modules/grading/cgpa';

const courseByCode: Record<string, Pick<Course, 'credits'>> = {
  MTH111: { credits: 3 },
  PHY121: { credits: 4 },
  CSE211: { credits: 3 },
  ECE314: { credits: 3 },
  HUM101: { credits: 2 },
};

function rec(partial: Partial<EnrollmentRecord> & Pick<EnrollmentRecord, 'courseCode' | 'points' | 'letter'>): EnrollmentRecord {
  return {
    attemptNumber: 1,
    pct: 0,
    isRetake: false,
    countsInCgpa: true,
    semesterOrdinal: 1,
    ...partial,
  };
}

describe('computeCGPA (§2.2)', () => {
  it('hand-computed: 3 courses, straightforward weighted average', () => {
    // MTH111 (3cr, A=4.0), PHY121 (4cr, B=3.0), CSE211 (3cr, C=2.0)
    // totalPts = 3*4 + 4*3 + 3*2 = 12 + 12 + 6 = 30; totalCr = 10 -> 3.00
    const latestAttempts: EnrollmentRecord[] = [
      rec({ courseCode: 'MTH111', points: 4.0, letter: 'A' }),
      rec({ courseCode: 'PHY121', points: 3.0, letter: 'B' }),
      rec({ courseCode: 'CSE211', points: 2.0, letter: 'C' }),
    ];
    expect(computeCGPA({ latestAttempts, courseByCode })).toBe(3.0);
  });

  it('excludes withdrawals (letter=W) entirely from both totals', () => {
    const latestAttempts: EnrollmentRecord[] = [
      rec({ courseCode: 'MTH111', points: 4.0, letter: 'A' }),
      rec({ courseCode: 'HUM101', points: 0, letter: 'W' }), // withdrawn — must not count
    ];
    // Only MTH111 counts: 3*4 / 3 = 4.00, not diluted by HUM101's credits.
    expect(computeCGPA({ latestAttempts, courseByCode })).toBe(4.0);
  });

  it('rounds to 2 decimals (Math.round(x*100)/100 convention)', () => {
    // MTH111 (3cr, 3.7) + PHY121 (4cr, 2.7): (11.1 + 10.8)/7 = 3.1285714... -> 3.13
    const latestAttempts: EnrollmentRecord[] = [
      rec({ courseCode: 'MTH111', points: 3.7, letter: 'A-' }),
      rec({ courseCode: 'PHY121', points: 2.7, letter: 'B-' }),
    ];
    expect(computeCGPA({ latestAttempts, courseByCode })).toBe(3.13);
  });

  it('§7.2.3 — sinceSemesterOrdinal excludes old-faculty history (post-transfer CGPA anchoring)', () => {
    // Old-faculty courses at ordinals 1-4 (bad grades), Transfer Semester at
    // ordinal 5 onward (good grades). Only ordinal >= 5 should count once the
    // active base snapshot anchors the student to the Transfer Semester.
    const latestAttempts: EnrollmentRecord[] = [
      rec({ courseCode: 'MTH111', points: 1.0, letter: 'D', semesterOrdinal: 2 }), // old faculty, excluded
      rec({ courseCode: 'PHY121', points: 0.7, letter: 'D-', semesterOrdinal: 4 }), // old faculty, excluded
      rec({ courseCode: 'CSE211', points: 3.7, letter: 'A-', semesterOrdinal: 5 }), // Transfer Semester, included
      rec({ courseCode: 'ECE314', points: 3.3, letter: 'B+', semesterOrdinal: 6 }), // new faculty, included
    ];
    // Without the anchor: all 4 courses would pull the CGPA down substantially.
    const unanchored = computeCGPA({ latestAttempts, courseByCode });
    expect(unanchored).toBeLessThan(2.5);

    // With sinceSemesterOrdinal=5: only CSE211 (3cr, 3.7) + ECE314 (3cr, 3.3)
    // count -> (11.1 + 9.9)/6 = 3.50
    const anchored = computeCGPA({ latestAttempts, courseByCode, sinceSemesterOrdinal: 5 });
    expect(anchored).toBe(3.5);
  });

  it('returns 0 when there are no countable credits (edge case, avoid divide-by-zero)', () => {
    expect(computeCGPA({ latestAttempts: [], courseByCode })).toBe(0);
  });

  it('skips enrollment rows whose course is not in courseByCode (defensive)', () => {
    const latestAttempts: EnrollmentRecord[] = [
      rec({ courseCode: 'MTH111', points: 4.0, letter: 'A' }),
      rec({ courseCode: 'UNKNOWN404', points: 0.0, letter: 'F' }),
    ];
    expect(computeCGPA({ latestAttempts, courseByCode })).toBe(4.0);
  });
});

describe('latestAttemptPerCourse (§2.2 replacement rule at the data layer)', () => {
  it('keeps only the highest attemptNumber per course code (grade replacement, never averaged)', () => {
    const all: EnrollmentRecord[] = [
      rec({ courseCode: 'ECE314', points: 1.3, letter: 'D+', attemptNumber: 1 }),
      rec({ courseCode: 'ECE314', points: 3.0, letter: 'B', attemptNumber: 2 }), // retake replaces, not averages
      rec({ courseCode: 'MTH111', points: 4.0, letter: 'A', attemptNumber: 1 }),
    ];
    const latest = latestAttemptPerCourse(all);
    expect(latest).toHaveLength(2);
    const ece = latest.find(r => r.courseCode === 'ECE314');
    expect(ece?.points).toBe(3.0);
    expect(ece?.attemptNumber).toBe(2);
  });

  it('excludes rows with countsInCgpa=false (e.g. a superseded/void attempt) from selection entirely', () => {
    const all: EnrollmentRecord[] = [
      rec({ courseCode: 'ECE314', points: 1.3, letter: 'D+', attemptNumber: 1, countsInCgpa: true }),
      rec({ courseCode: 'ECE314', points: 0, letter: 'W', attemptNumber: 2, countsInCgpa: false }),
    ];
    const latest = latestAttemptPerCourse(all);
    expect(latest).toHaveLength(1);
    expect(latest[0].attemptNumber).toBe(1);
  });
});
