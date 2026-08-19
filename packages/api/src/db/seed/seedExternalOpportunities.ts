// AI Features Blueprint §1.2/§1.4 — curated internships/grants/research
// fairs an advisor's Collider Board matches organic projects against. Same
// "curated, not live-scraped" honesty as seedVentureProjects.ts's own
// professor-posted openings — a real scraped feed is an explicit v1.2+
// item (see the blueprint's §5), not implied here.
import { ExternalOpportunity } from '@advisor/shared';

export const EXTERNAL_OPPORTUNITIES: ExternalOpportunity[] = [
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

export const OPPORTUNITIES_BY_ID: Record<string, ExternalOpportunity> = Object.fromEntries(EXTERNAL_OPPORTUNITIES.map(o => [o.id, o]));
