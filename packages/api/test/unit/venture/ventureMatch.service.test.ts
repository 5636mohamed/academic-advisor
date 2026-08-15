// Covers spec §16.2/§16.3's suggested/applied/accepted/declined lifecycle.
import { describe, it, expect } from 'vitest';
import { computeMatchesForStudent, topCardMatch, applyToMatch, setMatchStatus } from '../../../src/modules/venture/ventureMatch.service';
import { VentureProject, StudentVentureMatch } from '@advisor/shared';

function project(overrides: Partial<VentureProject>): VentureProject {
  return {
    id: 'proj-1',
    professorId: 'prof-1',
    title: 'Test Project',
    description: 'desc',
    type: 'academic_research',
    requiredCourseCodes: [],
    preferredSkills: [],
    capacity: 2,
    isActive: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

const strongFitInput = {
  transcript: {
    ECE413: { courseCode: 'ECE413', attemptNumber: 1, pct: 95, letter: 'A+', points: 4.0, isRetake: false, countsInCgpa: true, semesterOrdinal: 5 },
    ECEEL2: { courseCode: 'ECEEL2', attemptNumber: 1, pct: 90, letter: 'A', points: 3.7, isRetake: false, countsInCgpa: true, semesterOrdinal: 6 },
  },
  ventureInterestAnswers: { v1_domain: 'v1_embedded', v2_goal: 'v2_software', v3_role: 'v3_integrate' },
  courseSkillTags: { ECEEL2: ['embedded_systems'] },
  electiveCourseCodes: new Set<string>(['ECEEL2']),
  cgpa: 3.5,
  trendSlope: 0.05,
};

const weakFitInput = {
  transcript: {},
  ventureInterestAnswers: {},
  courseSkillTags: {},
  electiveCourseCodes: new Set<string>(),
  cgpa: 2.0,
  trendSlope: null,
};

describe('computeMatchesForStudent — §16.2/§16.3', () => {
  it('mints a new "suggested" match only when the score newly clears threshold', () => {
    const p = project({ requiredCourseCodes: ['ECE413'], preferredSkills: ['embedded_systems'] });
    const { results, newlySuggested } = computeMatchesForStudent('s1', strongFitInput, [p], []);
    expect(results[0].status).toBe('suggested');
    expect(results[0].matchId).not.toBeNull();
    expect(newlySuggested).toHaveLength(1);
  });

  it('a below-threshold score is included in results but never persisted', () => {
    const p = project({ requiredCourseCodes: ['ECE413'], preferredSkills: ['machine_learning'] });
    const { results, newlySuggested } = computeMatchesForStudent('s1', weakFitInput, [p], []);
    expect(results[0].status).toBe('unscored');
    expect(results[0].matchId).toBeNull();
    expect(newlySuggested).toHaveLength(0);
  });

  it('an existing persisted match is reused as-is, not recreated or rescored into a new row', () => {
    const p = project({ id: 'proj-existing' });
    const existing: StudentVentureMatch = { id: 'vmatch-1', studentId: 's1', ventureProjectId: 'proj-existing', matchScore: 0.9, status: 'accepted', createdAt: 'x' };
    const { results, newlySuggested } = computeMatchesForStudent('s1', weakFitInput, [p], [existing]);
    expect(results[0].matchId).toBe('vmatch-1');
    expect(results[0].status).toBe('accepted');
    expect(newlySuggested).toHaveLength(0);
  });

  it('results are sorted by score descending', () => {
    const strong = project({ id: 'strong', requiredCourseCodes: ['ECE413'], preferredSkills: ['embedded_systems'] });
    const weak = project({ id: 'weak', requiredCourseCodes: ['NEVER'], preferredSkills: ['circuit_design'] });
    const { results } = computeMatchesForStudent('s1', strongFitInput, [weak, strong], []);
    expect(results[0].project.id).toBe('strong');
  });
});

describe('topCardMatch — §16.4', () => {
  it('returns null when nothing clears the threshold (never render a card)', () => {
    const p = project({ requiredCourseCodes: ['NEVER'] });
    const { results } = computeMatchesForStudent('s1', weakFitInput, [p], []);
    expect(topCardMatch(results)).toBeNull();
  });

  it('returns the top result when it clears the threshold', () => {
    const p = project({ requiredCourseCodes: ['ECE413'], preferredSkills: ['embedded_systems'] });
    const { results } = computeMatchesForStudent('s1', strongFitInput, [p], []);
    expect(topCardMatch(results)?.project.id).toBe('proj-1');
  });
});

describe('applyToMatch / setMatchStatus — §16.3/§16.6', () => {
  it('applyToMatch only transitions from suggested', () => {
    const suggested: StudentVentureMatch = { id: 'm1', studentId: 's1', ventureProjectId: 'p1', matchScore: 0.9, status: 'suggested', createdAt: 'x' };
    expect(applyToMatch(suggested).status).toBe('applied');

    const alreadyAccepted: StudentVentureMatch = { ...suggested, status: 'accepted' };
    expect(applyToMatch(alreadyAccepted).status).toBe('accepted'); // no-op
  });

  it('setMatchStatus (professor action) sets accepted/declined', () => {
    const applied: StudentVentureMatch = { id: 'm1', studentId: 's1', ventureProjectId: 'p1', matchScore: 0.9, status: 'applied', createdAt: 'x' };
    expect(setMatchStatus(applied, 'accepted').status).toBe('accepted');
    expect(setMatchStatus(applied, 'declined').status).toBe('declined');
  });

  it('applyToMatch attaches a CV in the same action that transitions to applied', () => {
    const suggested: StudentVentureMatch = { id: 'm1', studentId: 's1', ventureProjectId: 'p1', matchScore: 0.9, status: 'suggested', createdAt: 'x' };
    const result = applyToMatch(suggested, { fileName: 'resume.pdf', dataUrl: 'data:application/pdf;base64,AAAA' });
    expect(result.status).toBe('applied');
    expect(result.cvFileName).toBe('resume.pdf');
    expect(result.cvDataUrl).toBe('data:application/pdf;base64,AAAA');
  });

  it('a CV can be attached/replaced on an already-applied match without changing its status', () => {
    const applied: StudentVentureMatch = { id: 'm1', studentId: 's1', ventureProjectId: 'p1', matchScore: 0.9, status: 'applied', createdAt: 'x' };
    const result = applyToMatch(applied, { fileName: 'v2-resume.pdf', dataUrl: 'data:application/pdf;base64,BBBB' });
    expect(result.status).toBe('applied');
    expect(result.cvFileName).toBe('v2-resume.pdf');
  });

  it('no CV is still a valid, complete expression of interest', () => {
    const suggested: StudentVentureMatch = { id: 'm1', studentId: 's1', ventureProjectId: 'p1', matchScore: 0.9, status: 'suggested', createdAt: 'x' };
    const result = applyToMatch(suggested);
    expect(result.status).toBe('applied');
    expect(result.cvFileName).toBeUndefined();
  });
});
