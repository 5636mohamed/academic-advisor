// AI Features Blueprint (docs/AI_FEATURES_BLUEPRINT.md) — Project Collider &
// Innovation Topography, advisor/VP-facing only (no student-side NLP intake
// or auto-teammate-matching in this cut — see the blueprint's §5 and the
// scoping decision in the epic that added this file for why).
//
// Every real seeded student in this app belongs to a single department
// (ECE) in a single faculty (ENG) — there's no second course catalog for
// CSE/MCE/BUS (see deptFitEngine.ts's OTHER_FACULTY_DEPARTMENTS comment).
// So a genuinely cross-faculty project needs teammates who aren't full
// advisees — ColliderCollaborator (seedColliderCollaborators.ts) is that:
// a lightweight identity (name + faculty/department + skills, no CGPA/
// transcript) for exactly this purpose, clearly flagged as synthetic
// rather than silently presented as more real students.

export type SkillTag = string; // canonical id from seedSkillTaxonomy.ts, e.g. 'machine-learning', 'iot', 'lora'

export type ProjectType = 'academic_research' | 'commercial_spinoff' | 'graduation_project';
export type ProjectStage = 'idea' | 'forming_team' | 'active' | 'matched_externally' | 'archived';

export interface ColliderCollaborator {
  id: string;
  name: string;
  facultyId: string;
  departmentId: string;
  skills: SkillTag[];
}

export interface ProjectMember {
  /** Either a real advisee's Student.id, or a ColliderCollaborator.id —
   *  disambiguated by isCollaborator, since the two live in separate
   *  stores (students are the full advising roster; collaborators are the
   *  lightweight cross-faculty identities above). */
  id: string;
  isCollaborator: boolean;
  facultyId: string;
  departmentId: string;
}

export interface FundingAllocation {
  amount: number;
  note: string;
  allocatedAt: string;
  /** Whether this allocation is the university's own money or an external
   *  grant/award being recorded against the project (e.g. one of the
   *  live-fetched Grants.gov matches actually being won) — the VP PDF
   *  export (§ Innovation Topography report) needs this distinction
   *  spelled out per allocation, not just a total. */
  source: 'university' | 'external_grant';
  /** Only meaningful when source is 'external_grant' — the awarding body
   *  (e.g. "NSF", "Grants.gov: NIOSH Robotics..."). Optional even then —
   *  a VP recording a grant win by hand isn't forced to fill it in. */
  grantName?: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  type: ProjectType;
  skills: SkillTag[];
  members: ProjectMember[];
  stage: ProjectStage;
  /** Advisor whose roster this project is monitored under — the founder's
   *  advisor, for AdvisorColliderBoard.tsx's scoping (same ?advisorId=
   *  shape as everywhere else in this app). */
  advisorId: string;
  fundingAllocations: FundingAllocation[];
  createdAt: string;
}

export interface ExternalOpportunity {
  id: string;
  title: string;
  kind: 'internship' | 'grant' | 'research_fair';
  requiredSkills: SkillTag[];
  organization: string;
  deadline: string | null;
  url: string | null;
  /** 'live' = fetched just now from a real external API (RemoteOK for
   *  internships, Grants.gov for grants — see
   *  externalOpportunitiesLive.service.ts); 'curated' = this app's own
   *  hand-picked seed (research fairs always are — no good free public API
   *  exists for those; internships/grants fall back here too if the live
   *  fetch fails or that day's feed has nothing skill-matchable). Shown in
   *  the UI so "live" isn't silently claimed when it's actually a
   *  fallback. */
  source: 'live' | 'curated';
}

export interface OpportunityMatch {
  opportunity: ExternalOpportunity;
  matchScore: number; // Jaccard similarity (intersection/union) of the two skill-tag sets
}

export interface TopographyCell {
  facultyId: string;
  skill: SkillTag;
  projectCount: number;
  crossFacultyProjectCount: number;
}
