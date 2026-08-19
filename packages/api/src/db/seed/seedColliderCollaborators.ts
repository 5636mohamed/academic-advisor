// AI Features Blueprint §1.2 / collider.ts's header — lightweight
// cross-faculty identities for Collider project membership. NOT full
// advisees: no CGPA, no transcript, no advisor. They exist purely because
// every real seeded student is ECE/ENG (this demo only has one course
// catalog — see deptFitEngine.ts's OTHER_FACULTY_DEPARTMENTS comment), so
// without something like this, "cross-faculty project" would be
// impossible to represent at all with real data. Explicitly flagged as
// synthetic, same house style as OTHER_FACULTY_DEPARTMENTS itself.
import { ColliderCollaborator } from '@advisor/shared';

export const COLLIDER_COLLABORATORS: ColliderCollaborator[] = [
  { id: 'collab-cse-1', name: 'Nadine Farouk', facultyId: 'ENG', departmentId: 'CSE', skills: ['machine-learning', 'data-science', 'web-development'] },
  { id: 'collab-cse-2', name: 'Omar Hegazy', facultyId: 'ENG', departmentId: 'CSE', skills: ['computer-vision', 'machine-learning'] },
  { id: 'collab-cse-3', name: 'Rana Selim', facultyId: 'ENG', departmentId: 'CSE', skills: ['web-development', 'data-science', 'ui-ux-design'] },
  { id: 'collab-mce-1', name: 'Yousef Amer', facultyId: 'ENG', departmentId: 'MCE', skills: ['robotics', 'control-systems', 'embedded-systems'] },
  { id: 'collab-mce-2', name: 'Dina Kabary', facultyId: 'ENG', departmentId: 'MCE', skills: ['robotics', 'power-electronics'] },
  { id: 'collab-bis-1', name: 'Malak Osman', facultyId: 'BUS', departmentId: 'BIS', skills: ['business-strategy', 'data-science', 'project-management'] },
  { id: 'collab-bis-2', name: 'Ziad Shokry', facultyId: 'BUS', departmentId: 'BIS', skills: ['business-strategy', 'project-management'] },
  { id: 'collab-acc-1', name: 'Farida Nassar', facultyId: 'BUS', departmentId: 'ACC', skills: ['finance', 'business-strategy'] },
  { id: 'collab-mkt-1', name: 'Kareem Basyouni', facultyId: 'BUS', departmentId: 'MKT', skills: ['marketing', 'ui-ux-design', 'business-strategy'] },
  { id: 'collab-mkt-2', name: 'Salma Deif', facultyId: 'BUS', departmentId: 'MKT', skills: ['marketing', 'business-strategy'] },
];

export const COLLABORATORS_BY_ID: Record<string, ColliderCollaborator> = Object.fromEntries(
  COLLIDER_COLLABORATORS.map(c => [c.id, c])
);
