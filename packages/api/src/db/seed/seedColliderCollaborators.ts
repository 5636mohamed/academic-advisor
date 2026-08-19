// AI Features Blueprint §1.2 / collider.ts's header — lightweight
// cross-faculty identities for Collider project membership. NOT full
// advisees: no CGPA, no transcript, no advisor. The real-department
// expansion (see seedCatalog.ts's CATALOG_BY_DEPARTMENT) means CSE and MTE
// now have real seeded students/catalogs too — these lightweight
// collaborator entries just predate that and are kept for their existing
// Collider project-membership fixtures; the BUS-faculty ones (BIS/ACC/MKT)
// remain genuinely synthetic placeholders (no real catalog exists for that
// faculty yet — see deptFitEngine.ts's OTHER_FACULTY_DEPARTMENTS comment).
import { ColliderCollaborator } from '@advisor/shared';

export const COLLIDER_COLLABORATORS: ColliderCollaborator[] = [
  { id: 'collab-cse-1', name: 'Nadine Farouk', facultyId: 'ENG', departmentId: 'CSE', skills: ['machine-learning', 'data-science', 'web-development'] },
  { id: 'collab-cse-2', name: 'Omar Hegazy', facultyId: 'ENG', departmentId: 'CSE', skills: ['computer-vision', 'machine-learning'] },
  { id: 'collab-cse-3', name: 'Rana Selim', facultyId: 'ENG', departmentId: 'CSE', skills: ['web-development', 'data-science', 'ui-ux-design'] },
  { id: 'collab-mce-1', name: 'Yousef Amer', facultyId: 'ENG', departmentId: 'MTE', skills: ['robotics', 'control-systems', 'embedded-systems'] },
  { id: 'collab-mce-2', name: 'Dina Kabary', facultyId: 'ENG', departmentId: 'MTE', skills: ['robotics', 'power-electronics'] },
  { id: 'collab-bis-1', name: 'Malak Osman', facultyId: 'BUS', departmentId: 'BIS', skills: ['business-strategy', 'data-science', 'project-management'] },
  { id: 'collab-bis-2', name: 'Ziad Shokry', facultyId: 'BUS', departmentId: 'BIS', skills: ['business-strategy', 'project-management'] },
  { id: 'collab-acc-1', name: 'Farida Nassar', facultyId: 'BUS', departmentId: 'ACC', skills: ['finance', 'business-strategy'] },
  { id: 'collab-mkt-1', name: 'Kareem Basyouni', facultyId: 'BUS', departmentId: 'MKT', skills: ['marketing', 'ui-ux-design', 'business-strategy'] },
  { id: 'collab-mkt-2', name: 'Salma Deif', facultyId: 'BUS', departmentId: 'MKT', skills: ['marketing', 'business-strategy'] },
];

export const COLLABORATORS_BY_ID: Record<string, ColliderCollaborator> = Object.fromEntries(
  COLLIDER_COLLABORATORS.map(c => [c.id, c])
);
