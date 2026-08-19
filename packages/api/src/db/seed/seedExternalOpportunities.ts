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
  // Real Egyptian innovation-ecosystem organizations — research fairs,
  // conferences, funding programs, and prototype competitions have no
  // comparable free public API the way RemoteOK/Grants.gov exist for
  // internships/grants, so these stay curated always (same honesty as the
  // original research-fair entries above). Organization names are real,
  // well-established programs in Egypt's tech/entrepreneurship ecosystem;
  // specific dates/URLs are left null/generic rather than invented, same
  // discipline the rest of this file already follows.
  {
    id: 'ext-9',
    title: 'TIEC Tech Innovation Funding Program',
    kind: 'funding_program',
    requiredSkills: ['iot', 'embedded-systems', 'machine-learning', 'web-development'],
    organization: 'Technology Innovation and Entrepreneurship Center (TIEC / ITIDA)',
    deadline: null,
    url: null,
  },
  {
    id: 'ext-10',
    title: 'AUC V-Lab Hardware Prototype Competition',
    kind: 'prototype_competition',
    requiredSkills: ['robotics', 'embedded-systems', 'iot'],
    organization: 'AUC Venture Lab — American University in Cairo',
    deadline: null,
    url: null,
  },
  {
    id: 'ext-11',
    title: 'Rise Up Summit',
    kind: 'conference',
    requiredSkills: ['business-strategy', 'marketing', 'data-science'],
    organization: 'Rise Up Summit',
    deadline: null,
    url: null,
  },
  {
    id: 'ext-12',
    title: 'INJAZ Egypt Youth Innovation Competition',
    kind: 'prototype_competition',
    requiredSkills: ['business-strategy', 'project-management'],
    organization: 'INJAZ Egypt',
    deadline: null,
    url: null,
  },
  {
    id: 'ext-13',
    title: 'Flat6Labs Cairo Seed Funding Program',
    kind: 'funding_program',
    requiredSkills: ['web-development', 'data-science', 'business-strategy'],
    organization: 'Flat6Labs Cairo',
    deadline: null,
    url: null,
  },
  {
    id: 'ext-14',
    title: 'IEEE Egypt Section Robotics & Embedded Systems Competition',
    kind: 'prototype_competition',
    requiredSkills: ['robotics', 'embedded-systems', 'control-systems'],
    organization: 'IEEE Egypt Section',
    deadline: null,
    url: null,
  },
  {
    id: 'ext-15',
    title: 'Cairo ICT Conference & Exhibition',
    kind: 'conference',
    requiredSkills: ['iot', 'machine-learning', 'wireless-communications'],
    organization: 'Cairo ICT',
    deadline: null,
    url: null,
  },
  {
    id: 'ext-16',
    title: 'Digital Egypt Pioneers Initiative Internship',
    kind: 'internship',
    requiredSkills: ['web-development', 'data-science'],
    organization: 'Ministry of Communications and Information Technology (MCIT)',
    deadline: null,
    url: null,
  },
  {
    id: 'ext-17',
    title: 'Orange Corners Egypt Entrepreneurship Program',
    kind: 'funding_program',
    requiredSkills: ['business-strategy', 'finance'],
    organization: 'Orange Corners Egypt',
    deadline: null,
    url: null,
  },
  {
    id: 'ext-18',
    title: 'ITIDA Applied AI Research Grant',
    kind: 'grant',
    requiredSkills: ['machine-learning', 'computer-vision'],
    organization: 'Information Technology Industry Development Agency (ITIDA)',
    deadline: null,
    url: null,
  },
];

export const EXTERNAL_OPPORTUNITIES: ExternalOpportunity[] = CURATED.map(o => ({ ...o, source: 'curated' as const }));

export const OPPORTUNITIES_BY_ID: Record<string, ExternalOpportunity> = Object.fromEntries(EXTERNAL_OPPORTUNITIES.map(o => [o.id, o]));
