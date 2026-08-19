// AI Features Blueprint §1.2/§1.4, extended — real external opportunity
// data instead of only a curated seed. Two genuinely public, keyless APIs:
//   - RemoteOK (https://remoteok.com/api) for internships — filtered to
//     listings that actually read as entry-level/internship (RemoteOK is
//     mostly senior remote roles; mislabeling those as "internships" would
//     be dishonest, so a day with no real intern-shaped listing in the
//     feed correctly falls back rather than forcing a bad match).
//   - Grants.gov's public search API (https://api.grants.gov/v1/api/search2)
//     for grants — the real US federal grants database.
// Research fairs stay curated (seedExternalOpportunities.ts) — no
// comparable free public API exists for those.
//
// This is the app's first outbound network call to a third party. Real
// consequences that follow from that, handled explicitly rather than
// assumed away: a request timeout (6s, AbortController), a non-200 or
// malformed response, or a live feed that happens to have nothing
// skill-matchable that day, all fall back to the curated seed for that
// kind — never a thrown error surfacing as a broken page. Results are
// cached in-memory for 30 minutes so a burst of advisor requests doesn't
// hammer either API on every click.
import { ExternalOpportunity, SkillTag } from '@advisor/shared';
import { SKILL_TAXONOMY } from '../../db/seed/seedSkillTaxonomy';
import { EXTERNAL_OPPORTUNITIES } from '../../db/seed/seedExternalOpportunities';

const CACHE_TTL_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 6000;

// Natural-language variants a real job/grant title uses that don't
// literally spell out the taxonomy's own hyphenated id — mapped onto the
// SAME closed vocabulary the rest of Collider matches against (project
// skills, collaborator skills), so a live listing's derived tags are
// directly comparable via jaccardSimilarity, not a second parallel
// vocabulary. Deliberately short and reviewable, same spirit as
// seedSkillTaxonomy.ts itself — not a general NLP model.
const SYNONYMS: Record<string, SkillTag> = {
  'ml': 'machine-learning', 'ai': 'machine-learning', 'machine learning': 'machine-learning', 'deep learning': 'machine-learning',
  'computer vision': 'computer-vision', 'cv': 'computer-vision',
  'embedded': 'embedded-systems', 'firmware': 'embedded-systems',
  'lorawan': 'lora',
  'rf': 'rf-design', 'radio frequency': 'rf-design',
  'dsp': 'digital-signal-processing', 'signal processing': 'digital-signal-processing',
  'robotics': 'robotics', 'robot': 'robotics',
  'power electronics': 'power-electronics',
  'controls': 'control-systems', 'control systems': 'control-systems', 'plc': 'control-systems',
  'vlsi': 'vlsi-design', 'asic': 'vlsi-design', 'chip design': 'vlsi-design',
  'wireless': 'wireless-communications', 'telecom': 'wireless-communications', '5g': 'wireless-communications',
  'web developer': 'web-development', 'web dev': 'web-development', 'frontend': 'web-development', 'backend': 'web-development', 'full stack': 'web-development', 'full-stack': 'web-development',
  'data science': 'data-science', 'data scientist': 'data-science', 'data analyst': 'data-science', 'analytics': 'data-science',
  'strategy': 'business-strategy', 'business development': 'business-strategy',
  'financial': 'finance', 'fintech': 'finance',
  'marketing': 'marketing', 'growth': 'marketing',
  'ux': 'ui-ux-design', 'ui': 'ui-ux-design', 'product design': 'ui-ux-design',
  'project manager': 'project-management', 'pm': 'project-management', 'scrum': 'project-management',
};

function normalize(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ')} `;
}

/** Matches a listing's title/tags against the closed taxonomy — direct
 *  taxonomy-id hits first (e.g. a tag literally says "machine-learning"),
 *  then the synonym map above. Bounded to the same vocabulary the rest of
 *  Collider uses, so an external listing's derived skills are meaningful
 *  input to jaccardSimilarity, not noise. */
export function extractTaxonomySkills(text: string): SkillTag[] {
  const hay = normalize(text);
  const found = new Set<SkillTag>();
  for (const tag of SKILL_TAXONOMY) {
    if (hay.includes(` ${tag.replace(/-/g, ' ')} `) || hay.includes(` ${tag} `)) found.add(tag);
  }
  for (const [phrase, tag] of Object.entries(SYNONYMS)) {
    if (hay.includes(` ${phrase} `)) found.add(tag);
  }
  return [...found];
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export interface LiveOpportunityResult {
  opportunities: ExternalOpportunity[];
  source: 'live' | 'curated';
  fetchedAt: string;
}

function curatedFallback(kind: ExternalOpportunity['kind']): LiveOpportunityResult {
  return { opportunities: EXTERNAL_OPPORTUNITIES.filter(o => o.kind === kind), source: 'curated', fetchedAt: new Date().toISOString() };
}

interface RemoteOkListing {
  id?: string;
  position?: string;
  company?: string;
  tags?: string[];
  url?: string;
  date?: string;
}

/** RemoteOK's feed is mostly senior/mid-level remote roles — only listings
 *  that actually read as entry-level/internship get through, so labeling
 *  them "internship" stays honest even though the source skews senior.
 *
 *  Checked ONLY against the listing's title (`position`), not its `tags`
 *  array — verified live (not assumed) that RemoteOK's tags are largely a
 *  generic, near-identical ~35-entry category bucket repeated across
 *  totally unrelated postings ("Valet Driver" and "Aviation Maintenance
 *  Technician" both carried "junior" among their tags), not real
 *  per-listing keywords. Using them here would have mislabeled unrelated
 *  senior/service roles as tech internships. The title is the one
 *  reliably listing-specific signal this feed actually provides. */
const INTERNSHIP_SIGNAL = /\b(intern(ship)?|graduate programme?|junior|entry.level|new grad)\b/i;

async function fetchLiveInternshipsUncached(): Promise<LiveOpportunityResult> {
  const res = await fetchWithTimeout('https://remoteok.com/api', { headers: { 'User-Agent': 'AEGIS-academic-advisor-demo/1.0' } });
  if (!res.ok) throw new Error(`RemoteOK responded ${res.status}`);
  const raw = (await res.json()) as RemoteOkListing[];
  const listings = raw.filter((l): l is Required<Pick<RemoteOkListing, 'id' | 'position' | 'company' | 'url'>> & RemoteOkListing => Boolean(l.id && l.position));
  const internshipLike = listings.filter(l => INTERNSHIP_SIGNAL.test(l.position!));

  const opportunities: ExternalOpportunity[] = internshipLike.slice(0, 15).map(l => ({
    id: `remoteok-${l.id}`,
    title: l.position!,
    kind: 'internship' as const,
    requiredSkills: extractTaxonomySkills(l.position!),
    organization: l.company ?? 'Unknown organization',
    deadline: null, // RemoteOK listings don't carry an application deadline
    url: l.url ?? null,
    source: 'live' as const,
  })).filter(o => o.requiredSkills.length > 0); // no matchable skills = not useful to rank against a project

  if (opportunities.length === 0) throw new Error('no skill-matchable internship-like listings in current RemoteOK feed');
  return { opportunities, source: 'live', fetchedAt: new Date().toISOString() };
}

interface GrantsGovHit {
  id?: string;
  title?: string;
  agency?: string;
  closeDate?: string; // "MM/DD/YYYY" or ""
  oppStatus?: string;
}

function parseGrantsGovDate(d: string | undefined): string | null {
  if (!d) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d);
  if (!m) return null;
  return `${m[3]}-${m[1]}-${m[2]}`;
}

async function fetchLiveGrantsUncached(): Promise<LiveOpportunityResult> {
  // A broad, engineering/tech-skewed keyword query — this catalog's real
  // domain (ECE + the cross-faculty collaborator set) — rather than one
  // query per skill tag, which would multiply outbound calls 19x for
  // little benefit given the taxonomy's real overlap with grant titles.
  const res = await fetchWithTimeout('https://api.grants.gov/v1/api/search2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows: 40, keyword: 'engineering technology research', oppStatuses: 'forecasted|posted' }),
  });
  if (!res.ok) throw new Error(`Grants.gov responded ${res.status}`);
  const body = (await res.json()) as { errorcode?: number; data?: { oppHits?: GrantsGovHit[] } };
  if (body.errorcode) throw new Error(`Grants.gov errorcode ${body.errorcode}`);
  const hits = body.data?.oppHits ?? [];

  const opportunities: ExternalOpportunity[] = hits
    .filter(h => h.id && h.title)
    .map(h => ({
      id: `grantsgov-${h.id}`,
      title: h.title!,
      kind: 'grant' as const,
      requiredSkills: extractTaxonomySkills(h.title!),
      organization: h.agency ?? 'U.S. federal agency',
      deadline: parseGrantsGovDate(h.closeDate),
      url: `https://www.grants.gov/search-results-detail/${h.id}`,
      source: 'live' as const,
    }))
    .filter(o => o.requiredSkills.length > 0);

  if (opportunities.length === 0) throw new Error('no skill-matchable grants in current Grants.gov query');
  return { opportunities, source: 'live', fetchedAt: new Date().toISOString() };
}

let internshipsCache: LiveOpportunityResult | null = null;
let grantsCache: LiveOpportunityResult | null = null;

function isFresh(cache: LiveOpportunityResult | null): cache is LiveOpportunityResult {
  return cache !== null && Date.now() - new Date(cache.fetchedAt).getTime() < CACHE_TTL_MS;
}

export async function getLiveInternships(): Promise<LiveOpportunityResult> {
  if (isFresh(internshipsCache)) return internshipsCache;
  try {
    internshipsCache = await fetchLiveInternshipsUncached();
  } catch {
    internshipsCache = curatedFallback('internship');
  }
  return internshipsCache;
}

export async function getLiveGrants(): Promise<LiveOpportunityResult> {
  if (isFresh(grantsCache)) return grantsCache;
  try {
    grantsCache = await fetchLiveGrantsUncached();
  } catch {
    grantsCache = curatedFallback('grant');
  }
  return grantsCache;
}

/** The full opportunity table an advisor's Collider Board matches
 *  against: live-or-fallback internships + live-or-fallback grants +
 *  always-curated everything else (research fairs, conferences, funding
 *  programs, prototype competitions — real named Egyptian organizations
 *  and programs, see seedExternalOpportunities.ts, but no comparable free
 *  public API exists for any of these the way RemoteOK/Grants.gov do for
 *  internships/grants, so they're never live-fetched). */
export async function getAllOpportunities(): Promise<ExternalOpportunity[]> {
  const [internships, grants] = await Promise.all([getLiveInternships(), getLiveGrants()]);
  const alwaysCurated = EXTERNAL_OPPORTUNITIES.filter(o => o.kind !== 'internship' && o.kind !== 'grant');
  return [...internships.opportunities, ...grants.opportunities, ...alwaysCurated];
}

/** Test-only: clears the module-level cache so a test doesn't see a
 *  previous test's fetch result. */
export function __clearLiveOpportunityCacheForTests(): void {
  internshipsCache = null;
  grantsCache = null;
}
