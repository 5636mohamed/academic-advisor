import { describe, it, expect } from 'vitest';
import { jaccardSimilarity, matchOpportunitiesForProject } from '../../../src/modules/collider/colliderOpportunityMatch.service';
import { ExternalOpportunity } from '@advisor/shared';

describe('jaccardSimilarity', () => {
  it('is 1 for identical sets', () => {
    expect(jaccardSimilarity(['iot', 'lora'], ['iot', 'lora'])).toBe(1);
  });
  it('is 0 for disjoint sets', () => {
    expect(jaccardSimilarity(['iot'], ['finance'])).toBe(0);
  });
  it('is 0 for two empty sets (no divide-by-zero NaN)', () => {
    expect(jaccardSimilarity([], [])).toBe(0);
  });
  it('computes intersection/union for a partial overlap', () => {
    // {iot, lora, embedded} vs {iot, rf} -> intersection {iot}=1, union {iot,lora,embedded,rf}=4
    expect(jaccardSimilarity(['iot', 'lora', 'embedded-systems'], ['iot', 'rf-design'])).toBeCloseTo(1 / 4, 5);
  });
});

describe('matchOpportunitiesForProject', () => {
  const opportunities: ExternalOpportunity[] = [
    { id: 'o1', title: 'IoT internship', kind: 'internship', requiredSkills: ['iot', 'lora'], organization: 'X', deadline: null, url: null, source: 'curated' },
    { id: 'o2', title: 'Finance fair', kind: 'research_fair', requiredSkills: ['finance'], organization: 'Y', deadline: null, url: null, source: 'curated' },
  ];

  it('ranks matches highest-score-first and drops zero-score matches', () => {
    const results = matchOpportunitiesForProject({ skills: ['iot', 'lora', 'embedded-systems'] }, opportunities);
    expect(results).toHaveLength(1);
    expect(results[0].opportunity.id).toBe('o1');
  });

  it('returns an empty array when nothing matches at all', () => {
    const results = matchOpportunitiesForProject({ skills: ['marketing'] }, opportunities);
    expect(results).toEqual([]);
  });
});
