// Covers spec §3.5 — ventureFitScore's three sub-scores and their blend.
import { describe, it, expect } from 'vitest';
import {
  courseCompetencyScore,
  ventureInterestOverlap,
  electivePerformanceOverlap,
  academicTrajectoryScore,
  ventureFitScore,
} from '../../../src/modules/venture/ventureFitScore';
import { EnrollmentRecord } from '@advisor/shared';

function rec(courseCode: string, pct: number, points: number): EnrollmentRecord {
  return { courseCode, attemptNumber: 1, pct, letter: 'x', points, isRetake: false, countsInCgpa: true, semesterOrdinal: 5 };
}

describe('courseCompetencyScore — §3.5a', () => {
  it('averages pct/100 across required courses', () => {
    const transcript = { ECE413: rec('ECE413', 90, 3.7), ECEEL1: rec('ECEEL1', 80, 3.0) };
    expect(courseCompetencyScore(transcript, ['ECE413', 'ECEEL1'])).toBeCloseTo(0.85, 5);
  });

  it('a required course never taken contributes 0, not excluded from the average', () => {
    const transcript = { ECE413: rec('ECE413', 90, 3.7) };
    // one taken at 0.90, one never taken (0) -> mean 0.45, not 0.90
    expect(courseCompetencyScore(transcript, ['ECE413', 'NEVER_TAKEN'])).toBeCloseTo(0.45, 5);
  });

  it('empty requiredCourseCodes returns 0, never NaN/crash', () => {
    expect(courseCompetencyScore({}, [])).toBe(0);
  });
});

describe('ventureInterestOverlap — §3.5b (form half)', () => {
  it('counts a question as matched if ANY of its chosen option traits intersect preferredSkills', () => {
    const answers = { v1_domain: 'v1_embedded', v2_goal: 'v2_startup' }; // 2 of 3 questions answered
    const overlap = ventureInterestOverlap(answers, ['embedded_systems']);
    expect(overlap).toBeCloseTo(0.5, 5); // 1 of 2 answered questions matched
  });

  it('no answers -> 0, never NaN', () => {
    expect(ventureInterestOverlap({}, ['machine_learning'])).toBe(0);
  });
});

describe('electivePerformanceOverlap — §3.5b (grades half)', () => {
  const courseSkillTags = { ECEEL1: ['machine_learning'], ECEEL2: ['embedded_systems'] };
  const electives = new Set(['ECEEL1', 'ECEEL2']);

  it('only counts electives with points >= 3.0 ("top-performing")', () => {
    const transcript = { ECEEL1: rec('ECEEL1', 90, 3.7), ECEEL2: rec('ECEEL2', 65, 2.0) }; // ECEEL2 below bar
    const overlap = electivePerformanceOverlap(transcript, courseSkillTags, electives, ['machine_learning', 'embedded_systems']);
    expect(overlap).toBeCloseTo(0.5, 5); // only machine_learning matched
  });

  it('empty preferredSkills returns 0, never divide-by-zero', () => {
    expect(electivePerformanceOverlap({}, courseSkillTags, electives, [])).toBe(0);
  });
});

describe('academicTrajectoryScore — §3.5c', () => {
  it('CGPA > 3.0 alone grants the bonus even with a flat/unknown trend', () => {
    const score = academicTrajectoryScore({ cgpa: 3.4, trendSlope: null });
    expect(score).toBeCloseTo(0.5 * (3.4 / 4) + 0.5, 5);
  });

  it('an improving trend alone grants the bonus even below 3.0 CGPA', () => {
    const score = academicTrajectoryScore({ cgpa: 2.2, trendSlope: 0.05 });
    expect(score).toBeCloseTo(0.5 * (2.2 / 4) + 0.5, 5);
  });

  it('neither condition -> no bonus, just the raw CGPA component', () => {
    const score = academicTrajectoryScore({ cgpa: 2.2, trendSlope: -0.02 });
    expect(score).toBeCloseTo(0.5 * (2.2 / 4), 5);
  });

  it('is always clamped to [0,1]', () => {
    expect(academicTrajectoryScore({ cgpa: 4.0, trendSlope: 0.5 })).toBeLessThanOrEqual(1);
  });
});

describe('ventureFitScore — full blend, §11 Scenario N shape', () => {
  it('a strong, well-aligned, high-CGPA student clears the 0.80 display threshold', () => {
    const transcript = {
      ECE413: rec('ECE413', 93, 4.0),
      ECEEL1: rec('ECEEL1', 90, 3.7),
      ECEEL2: rec('ECEEL2', 88, 3.3),
    };
    const result = ventureFitScore(
      {
        transcript,
        ventureInterestAnswers: { v1_domain: 'v1_embedded', v2_goal: 'v2_software', v3_role: 'v3_integrate' },
        courseSkillTags: { ECEEL1: ['machine_learning'], ECEEL2: ['embedded_systems'] },
        electiveCourseCodes: new Set(['ECEEL1', 'ECEEL2']),
        cgpa: 3.4,
        trendSlope: 0.03,
      },
      { requiredCourseCodes: ['ECE413', 'ECEEL1'], preferredSkills: ['embedded_systems', 'machine_learning', 'rf_communications'] }
    );
    expect(result.total).toBeGreaterThan(0.8);
    expect(result.courseCompetencyScore).toBeGreaterThan(0.9);
  });

  it('a student with zero relevant coursework or interest scores low, not undefined/NaN', () => {
    const result = ventureFitScore(
      {
        transcript: {},
        ventureInterestAnswers: {},
        courseSkillTags: {},
        electiveCourseCodes: new Set(),
        cgpa: 2.0,
        trendSlope: null,
      },
      { requiredCourseCodes: ['ECE413'], preferredSkills: ['machine_learning'] }
    );
    expect(result.total).toBeLessThan(0.5);
    expect(Number.isNaN(result.total)).toBe(false);
  });
});
