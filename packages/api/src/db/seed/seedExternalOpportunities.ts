// AI Features Blueprint §1.2/§1.4 — curated fallback opportunities an
// advisor's Collider Board matches organic projects against. Internships
// and grants are now genuinely LIVE-fetched from real external APIs (see
// externalOpportunitiesLive.service.ts — RemoteOK for internships,
// Grants.gov for grants) — this file is what's used when that live fetch
// fails or comes back with nothing skill-matchable that day, plus research
// fairs, which stay curated always (no good free public API exists for
// those). Every entry here is explicitly source: 'curated' so the UI never
// silently claims a fallback is live data.
import { ExternalOpportunity } from '@advisor/shared';

const CURATED: Omit<ExternalOpportunity, 'source'>[] = [
  {
    id: 'ext-1',
    title: 'IoT Systems Internship',
    kind: 'internship',
    requiredSkills: ['iot', 'embedded-systems', 'lora'],
    organization: 'NileTech Industries',
    deadline: '2026-09-15',
    url: null,
  },
  {
    id: 'ext-2',
    title: 'Applied Computer Vision Research Grant',
    kind: 'grant',
    requiredSkills: ['computer-vision', 'machine-learning'],
    organization: 'E-JUST Research Fund',
    deadline: '2026-10-01',
    url: null,
  },
  {
    id: 'ext-3',
    title: 'AgriTech Innovation Fair',
    kind: 'research_fair',
    requiredSkills: ['iot', 'power-electronics', 'embedded-systems'],
    organization: 'Ministry of Agriculture Innovation Office',
    deadline: '2026-11-20',
    url: null,
  },
  {
    id: 'ext-4',
    title: 'RF & Wireless Systems Internship',
    kind: 'internship',
    requiredSkills: ['rf-design', 'wireless-communications'],
    organization: 'Orange Egypt Labs',
    deadline: '2026-09-30',
    url: null,
  },
  {
    id: 'ext-5',
    title: 'Assistive Robotics Grant',
    kind: 'grant',
    requiredSkills: ['robotics', 'control-systems'],
    organization: 'Egyptian Academy of Scientific Research',
    deadline: '2026-10-15',
    url: null,
  },
  {
    id: 'ext-6',
    title: 'Student Fintech Startup Fair',
    kind: 'research_fair',
    requiredSkills: ['finance', 'data-science', 'business-strategy'],
    organization: 'Falak Startups',
    deadline: '2026-12-01',
    url: null,
  },
  {
    id: 'ext-7',
    title: 'Full-Stack Web Internship',
    kind: 'internship',
    requiredSkills: ['web-development', 'ui-ux-design'],
    organization: 'Vodafone Egypt Digital',
    deadline: '2026-09-20',
    url: null,
  },
  {
    id: 'ext-8',
    title: 'Predictive Maintenance & ML Research Grant',
    kind: 'grant',
    requiredSkills: ['machine-learning', 'embedded-systems'],
    organization: 'E-JUST Research Fund',
    deadline: '2026-11-05',
    url: null,
  },
];

export const EXTERNAL_OPPORTUNITIES: ExternalOpportunity[] = CURATED.map(o => ({ ...o, source: 'curated' as const }));

export const OPPORTUNITIES_BY_ID: Record<string, ExternalOpportunity> = Object.fromEntries(EXTERNAL_OPPORTUNITIES.map(o => [o.id, o]));
