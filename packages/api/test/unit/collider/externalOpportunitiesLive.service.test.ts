import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  extractTaxonomySkills,
  getLiveInternships,
  getLiveGrants,
  __clearLiveOpportunityCacheForTests,
} from '../../../src/modules/collider/externalOpportunitiesLive.service';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

describe('extractTaxonomySkills — pure, no network', () => {
  it('matches a direct taxonomy id (hyphenated) in text', () => {
    expect(extractTaxonomySkills('Looking for a machine-learning engineer')).toContain('machine-learning');
  });

  it('matches a taxonomy id written with a space instead of a hyphen', () => {
    expect(extractTaxonomySkills('computer vision internship')).toContain('computer-vision');
  });

  it('matches via the synonym map (e.g. "ML" -> machine-learning)', () => {
    expect(extractTaxonomySkills('Junior ML Intern')).toContain('machine-learning');
  });

  it('matches multiple distinct skills in one string, no duplicates', () => {
    const skills = extractTaxonomySkills('IoT and embedded systems robotics internship');
    expect(new Set(skills).size).toBe(skills.length);
    expect(skills).toEqual(expect.arrayContaining(['iot', 'embedded-systems', 'robotics']));
  });

  it('returns [] for text with no matchable taxonomy skill', () => {
    expect(extractTaxonomySkills('Executive assistant needed for a law firm')).toEqual([]);
  });

  it('is case-insensitive', () => {
    expect(extractTaxonomySkills('MACHINE LEARNING RESEARCH')).toContain('machine-learning');
  });
});

describe('getLiveInternships — real fetch, mocked', () => {
  beforeEach(() => {
    __clearLiveOpportunityCacheForTests();
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to curated data when the fetch throws (network/timeout failure)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unreachable')));
    const result = await getLiveInternships();
    expect(result.source).toBe('curated');
    expect(result.opportunities.every(o => o.kind === 'internship')).toBe(true);
    expect(result.opportunities.every(o => o.source === 'curated')).toBe(true);
  });

  it('falls back to curated data when the API responds non-200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, false, 503)));
    const result = await getLiveInternships();
    expect(result.source).toBe('curated');
  });

  it('parses a real-shaped RemoteOK response: keeps only intern-signal listings with matchable skills', async () => {
    const fakeFeed = [
      { last_updated: '123', legal: 'terms' }, // RemoteOK's own metadata row 0 — must be skipped
      { id: '1', position: 'Senior Staff Engineer', company: 'BigCo', tags: ['senior', 'backend'], url: 'https://x/1' }, // not intern-signal -> excluded
      { id: '2', position: 'Machine Learning Intern', company: 'AI Labs', tags: ['ml', 'python'], url: 'https://x/2' }, // intern-signal + matchable -> included
      { id: '3', position: 'HR Intern', company: 'AdCo', tags: [], url: 'https://x/3' }, // intern-signal but no matchable skill -> excluded
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(fakeFeed)));
    const result = await getLiveInternships();
    expect(result.source).toBe('live');
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0]).toMatchObject({ id: 'remoteok-2', title: 'Machine Learning Intern', source: 'live' });
    expect(result.opportunities[0].requiredSkills).toContain('machine-learning');
  });

  it('caches the result — a second call within the TTL does not re-fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([
      { id: '1', position: 'IoT Intern', company: 'Y', tags: ['iot'], url: 'https://x/1' },
    ]));
    vi.stubGlobal('fetch', fetchMock);
    await getLiveInternships();
    await getLiveInternships();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('getLiveGrants — real fetch, mocked', () => {
  beforeEach(() => {
    __clearLiveOpportunityCacheForTests();
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to curated data on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('DNS failure')));
    const result = await getLiveGrants();
    expect(result.source).toBe('curated');
    expect(result.opportunities.every(o => o.kind === 'grant')).toBe(true);
  });

  it('parses a real-shaped Grants.gov response, converts MM/DD/YYYY deadlines to ISO', async () => {
    const fakeBody = {
      errorcode: 0,
      data: {
        oppHits: [
          { id: '100', title: 'Robotics and Control Systems Research Grant', agency: 'NSF', closeDate: '12/31/2026', oppStatus: 'posted' },
          { id: '101', title: 'Unrelated Arts Funding Program', agency: 'NEA', closeDate: '', oppStatus: 'posted' }, // no matchable skill -> excluded
        ],
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(fakeBody)));
    const result = await getLiveGrants();
    expect(result.source).toBe('live');
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0]).toMatchObject({ id: 'grantsgov-100', deadline: '2026-12-31', url: 'https://www.grants.gov/search-results-detail/100' });
    expect(result.opportunities[0].requiredSkills).toEqual(expect.arrayContaining(['robotics', 'control-systems']));
  });

  it('falls back to curated data when the API returns a nonzero errorcode', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ errorcode: 1, msg: 'bad request' })));
    const result = await getLiveGrants();
    expect(result.source).toBe('curated');
  });
});
