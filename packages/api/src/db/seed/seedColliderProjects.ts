// AI Features Blueprint §1.2/§1.6 — seeded "organic" Collider project
// groups. No student-facing NLP intake or auto-matching in this cut (see
// docs/AI_FEATURES_BLUEPRINT.md §5 and the scoping decision that added
// this feature) — these are seeded directly, the same way
// seedVentureProjects.ts already seeds Venture Board postings, so the
// Advisor Collider Board and VP Innovation Topography have real data to
// aggregate and display.
//
// Deliberately mixes real ECE advisees (founders) with the lightweight
// cross-faculty ColliderCollaborator identities (seedColliderCollaborators.ts)
// so `facultyIdsRepresented`-style clustering is genuine, not simulated —
// and deliberately leaves some projects single-faculty (ECE-only), since
// organic teams forming within one faculty is the realistic majority case,
// not the exception.
import { Project, ProjectMember } from '@advisor/shared';
import { COLLABORATORS_BY_ID } from './seedColliderCollaborators';

const ECE = { facultyId: 'ENG', departmentId: 'ECE' };

function eceMember(studentId: string): ProjectMember {
  return { id: studentId, isCollaborator: false, ...ECE };
}
function collaboratorMember(collabId: string): ProjectMember {
  const c = COLLABORATORS_BY_ID[collabId];
  return { id: collabId, isCollaborator: true, facultyId: c.facultyId, departmentId: c.departmentId };
}

export const COLLIDER_PROJECTS: Project[] = [
  {
    id: 'cp-1',
    title: 'LoRa-based Campus Water Leak Detector',
    description: 'Low-power sensor nodes on campus water lines, reporting anomalies over LoRaWAN to a dashboard that flags likely leaks before they show up on a utility bill.',
    type: 'commercial_spinoff',
    skills: ['iot', 'lora', 'embedded-systems', 'data-science'],
    members: [eceMember('ahmed-1'), eceMember('karim-1'), collaboratorMember('collab-cse-1')],
    stage: 'active',
    advisorId: 'advisor-nabil',
    fundingAllocations: [],
    createdAt: '2026-02-10T09:00:00.000Z',
  },
  {
    id: 'cp-2',
    title: 'Real-Time Sign Language Interpreter',
    description: 'A camera-based model that translates Egyptian Sign Language gestures to captioned speech in real time, aimed at lecture-hall accessibility.',
    type: 'academic_research',
    skills: ['computer-vision', 'machine-learning'],
    members: [eceMember('sara-1'), collaboratorMember('collab-cse-2')],
    stage: 'forming_team',
    advisorId: 'advisor-nabil',
    fundingAllocations: [],
    createdAt: '2026-03-02T09:00:00.000Z',
  },
  {
    id: 'cp-3',
    title: 'Smart Irrigation Controller for Delta Smallholder Farms',
    description: 'Soil-moisture-driven valve controller with a solar supply, sized for a smallholder plot rather than an industrial farm — the gap most existing commercial systems ignore.',
    type: 'graduation_project',
    skills: ['iot', 'embedded-systems', 'power-electronics'],
    members: [eceMember('omar-1'), eceMember('mona-2'), collaboratorMember('collab-mce-2')],
    stage: 'active',
    advisorId: 'advisor-mervat',
    fundingAllocations: [{ amount: 3000, note: 'Sensor + solar prototype BOM', allocatedAt: '2026-04-01T09:00:00.000Z' }],
    createdAt: '2026-01-20T09:00:00.000Z',
  },
  {
    id: 'cp-4',
    title: 'Predictive Maintenance for Campus HVAC',
    description: 'Vibration + current-draw sensors on the engineering building\'s AC units, feeding a model that predicts compressor failure weeks before it happens.',
    type: 'academic_research',
    skills: ['machine-learning', 'embedded-systems', 'control-systems'],
    members: [eceMember('youssef-3'), collaboratorMember('collab-mce-1')],
    stage: 'active',
    advisorId: 'advisor-mervat',
    fundingAllocations: [],
    createdAt: '2026-02-18T09:00:00.000Z',
  },
  {
    id: 'cp-5',
    title: 'Peer-to-Peer Textbook Exchange App',
    description: 'A campus-scoped marketplace for used textbooks — mostly a web-dev/UX project, with a small recommendation model matching sellers to likely buyers by course schedule.',
    type: 'commercial_spinoff',
    skills: ['web-development', 'ui-ux-design', 'data-science'],
    members: [eceMember('laila-4'), collaboratorMember('collab-cse-3'), collaboratorMember('collab-mkt-2')],
    stage: 'matched_externally',
    advisorId: 'advisor-tarek',
    fundingAllocations: [{ amount: 1500, note: 'Hosting + initial marketing push', allocatedAt: '2026-03-15T09:00:00.000Z' }],
    createdAt: '2026-01-05T09:00:00.000Z',
  },
  {
    id: 'cp-6',
    title: 'Antenna Array for Rural Broadband Relay',
    description: 'A directional antenna array design aimed at cheaply extending a single fiber drop across a rural village\'s worth of households.',
    type: 'academic_research',
    skills: ['rf-design', 'wireless-communications'],
    members: [eceMember('salma-1'), eceMember('yara-1')],
    stage: 'idea',
    advisorId: 'advisor-tarek',
    fundingAllocations: [],
    createdAt: '2026-04-10T09:00:00.000Z',
  },
  {
    id: 'cp-7',
    title: 'Assistive Exoskeleton Grip Module',
    description: 'A lightweight, low-cost forearm module restoring basic grip force for stroke-recovery patients, built around a graduation project timeline.',
    type: 'graduation_project',
    skills: ['robotics', 'control-systems', 'embedded-systems'],
    members: [eceMember('hassan-1'), collaboratorMember('collab-mce-1'), collaboratorMember('collab-bis-1')],
    stage: 'active',
    advisorId: 'advisor-hoda',
    fundingAllocations: [{ amount: 4000, note: 'Actuator + motor-driver prototype run', allocatedAt: '2026-03-28T09:00:00.000Z' }],
    createdAt: '2026-02-01T09:00:00.000Z',
  },
  {
    id: 'cp-8',
    title: 'Micro-Investment App for University Students',
    description: 'A round-up-and-invest app scoped to a student allowance, with a small model flagging spending patterns worth flagging before overdraft.',
    type: 'commercial_spinoff',
    skills: ['finance', 'data-science', 'business-strategy'],
    members: [eceMember('fatma-1'), collaboratorMember('collab-acc-1'), collaboratorMember('collab-bis-2')],
    stage: 'forming_team',
    advisorId: 'advisor-waleed',
    fundingAllocations: [],
    createdAt: '2026-03-20T09:00:00.000Z',
  },
];

export const COLLIDER_PROJECTS_BY_ID: Record<string, Project> = Object.fromEntries(COLLIDER_PROJECTS.map(p => [p.id, p]));
