// Spec §16 — seed data for the Innovation & Venture Catalyst: professors,
// their venture projects, and the course→skill-tag mapping §3.5b's
// elective-performance signal reads. Deliberately small (a handful of
// projects across two professors), matching this build's existing "seed
// enough to demo every rule live, not a general university catalog"
// philosophy (see deptFitEngine.ts's seed data for the same approach).
import { ProfessorProfile, VentureProject } from '@advisor/shared';
import { CATALOG } from './seedCatalog';

/** Every `program_elective` in the seeded catalog is treated as an
 *  "elective" for §3.5b's elective-performance overlap — computed from the
 *  catalog itself rather than a hand-maintained duplicate list. */
export const ELECTIVE_COURSE_CODES: Set<string> = new Set(CATALOG.filter(c => c.category === 'program_elective').map(c => c.code));

/** Skill tags per course, feeding §3.5b's elective-performance overlap
 *  (only entries for `ELECTIVE_COURSE_CODES` are read for that signal) and
 *  used loosely elsewhere as a plausibility check when seeding project
 *  `requiredCourseCodes`/`preferredSkills` below. */
export const COURSE_SKILL_TAGS: Record<string, string[]> = {
  ECEEL1: ['machine_learning', 'data_science'],
  ECEEL2: ['embedded_systems', 'hardware'],
  ECEEL3: ['circuit_design', 'hardware'],
  ECEEL4: ['rf_communications', 'hardware'],
  ECEEL5: ['robotics', 'embedded_systems'],
  ECE413: ['rf_communications', 'embedded_systems'], // Digital Communications Systems
  ECE324: ['machine_learning', 'data_science'], // Digital Signal Processing
  ECE326: ['rf_communications'], // Communications Systems Fundamentals
};

export const PROFESSORS: ProfessorProfile[] = [
  {
    id: 'prof-kamel',
    facultyId: 'ENG',
    departmentId: 'ECE',
    name: 'Dr. Youssef Kamel',
    researchTags: ['embedded_systems', 'rf_communications', 'hardware'],
    acceptingUndergrads: true,
  },
  {
    id: 'prof-adel',
    facultyId: 'ENG',
    departmentId: 'CSE',
    name: 'Dr. Salma Adel',
    researchTags: ['machine_learning', 'data_science'],
    acceptingUndergrads: true,
  },
  // Per-advisor venture ownership (superseding the old "single shared
  // advisor account, one generic 'advisor-owned' attribution anchor for
  // ALL 5 advisors' postings" design — that was a real product bug once
  // 5 real advisor identities existed: every advisor's venture board
  // showed every OTHER advisor's postings too, with no way to tell whose
  // was whose). One ProfessorProfile per real advisor, SAME id as their
  // Advisor entity in seedAdvisors.ts — "every professor is also an
  // advisor" stays true, it's just a real id now instead of a shared
  // anonymous bucket. Each advisor's own venture board scopes to
  // `professorId === their own advisorId` (see server.ts's
  // /api/advisor/venture-projects); the VP's own board stays unscoped
  // (cross-advisor oversight is the VP's whole point elsewhere too).
  { id: 'advisor-nabil', facultyId: 'ENG', departmentId: 'ECE', name: 'Prof. Nabil Fathy', researchTags: [], acceptingUndergrads: true },
  { id: 'advisor-mervat', facultyId: 'ENG', departmentId: 'ECE', name: 'Prof. Mervat Aziz', researchTags: [], acceptingUndergrads: true },
  { id: 'advisor-tarek', facultyId: 'ENG', departmentId: 'ECE', name: 'Prof. Tarek Younis', researchTags: [], acceptingUndergrads: true },
  { id: 'advisor-hoda', facultyId: 'ENG', departmentId: 'ECE', name: 'Prof. Hoda Sami', researchTags: [], acceptingUndergrads: true },
  { id: 'advisor-waleed', facultyId: 'ENG', departmentId: 'ECE', name: 'Prof. Waleed Kassem', researchTags: [], acceptingUndergrads: true },
  // Real-department expansion — one ProfessorProfile per new non-ECE
  // advisor, same id/pattern as the 5 ECE ones above. Each starts with no
  // seeded venture projects of their own (a real, if quieter, venture board
  // — not every advisor has a project posted on day one).
  { id: 'advisor-heba', facultyId: 'ENG', departmentId: 'CSE', name: 'Prof. Heba Zaki', researchTags: [], acceptingUndergrads: true },
  { id: 'advisor-sherif', facultyId: 'ENG', departmentId: 'MIE', name: 'Prof. Sherif Adly', researchTags: [], acceptingUndergrads: true },
  { id: 'advisor-rania', facultyId: 'ENG', departmentId: 'EPE', name: 'Prof. Rania Gaber', researchTags: [], acceptingUndergrads: true },
  { id: 'advisor-mostafa', facultyId: 'ENG', departmentId: 'MTE', name: 'Prof. Mostafa Hegazy', researchTags: [], acceptingUndergrads: true },
  { id: 'advisor-dina', facultyId: 'ENG', departmentId: 'MSE', name: 'Prof. Dina Farouk', researchTags: [], acceptingUndergrads: true },
  { id: 'advisor-ayman', facultyId: 'ENG', departmentId: 'IME', name: 'Prof. Ayman Nabil', researchTags: [], acceptingUndergrads: true },
  // VP epic — the same attribution-anchor pattern the advisors used to all
  // share, kept for the VP specifically (a genuine singleton role, unlike
  // the 5 advisors) — projects the Vice President posts directly (their
  // own Venture Board tab reuses the advisor console's create-project UI).
  // Deliberately no login credential of its own (VP already logs in via
  // the VP role, not a "professor" one) and filtered from student-facing
  // "who hosts this" professor pickers.
  {
    id: 'vp-owned',
    facultyId: 'ENG',
    departmentId: 'ECE',
    name: 'Office of the Vice President',
    researchTags: [],
    acceptingUndergrads: true,
  },
];

export const VENTURE_PROJECTS: VentureProject[] = [
  {
    // §11 Scenario N's worked example project, verbatim title from the request.
    id: 'proj-lora',
    professorId: 'advisor-waleed',
    title: 'Object Detection for Small Objects in Wide Land Fields Using Injected LoRa',
    description:
      'Commercial spin-off building a low-power LoRa-networked sensor system for detecting small objects across large agricultural fields. Looking for hardware/software integration specialists comfortable with both embedded firmware and applied ML.',
    type: 'commercial_spinoff',
    requiredCourseCodes: ['ECE413', 'ECEEL1'],
    preferredSkills: ['embedded_systems', 'machine_learning', 'rf_communications'],
    capacity: 2,
    isActive: true,
    createdAt: '2026-01-15T00:00:00.000Z',
  },
  {
    id: 'proj-edge-ml',
    professorId: 'advisor-mervat',
    title: 'Low-Power Edge ML for Agricultural Sensors',
    description: 'Academic research project on running compact ML models on power-constrained microcontrollers for field sensing applications.',
    type: 'academic_research',
    requiredCourseCodes: ['CSE213', 'ECEEL1'],
    preferredSkills: ['machine_learning', 'data_science'],
    capacity: 3,
    isActive: true,
    createdAt: '2026-01-10T00:00:00.000Z',
  },
  {
    // §16.8 edge case fixture — capacity already full via seeded accepted
    // matches (wired in inMemoryDb.ts), so this must never appear in a
    // fresh matching run despite otherwise scoring well for some students.
    id: 'proj-rf-full',
    professorId: 'advisor-nabil',
    title: 'Compact RF Front-Ends for CubeSats',
    description: 'A fully-subscribed research slot — kept in the seed data specifically to demonstrate §16.8\'s capacity-exclusion rule.',
    type: 'academic_research',
    requiredCourseCodes: ['ECE326', 'ECEEL4'],
    preferredSkills: ['rf_communications', 'circuit_design'],
    capacity: 1,
    isActive: true,
    createdAt: '2026-01-05T00:00:00.000Z',
  },
  {
    // §16.8 edge case fixture — isActive:false must exclude it from
    // matching entirely, same as being at capacity.
    id: 'proj-archived',
    professorId: 'advisor-tarek',
    title: 'Archived: Legacy Sensor Fusion Prototype',
    description: 'No longer accepting applicants.',
    type: 'academic_research',
    requiredCourseCodes: ['ECEEL2'],
    preferredSkills: ['embedded_systems'],
    capacity: 2,
    isActive: false,
    createdAt: '2025-09-01T00:00:00.000Z',
  },
  // Graduation Project epic — `isGraduationProject` is orthogonal to
  // `type` (see the shared VentureProject type's own doc comment): a
  // student capstone can pursue either an academic-research outcome or a
  // commercial spin-off one. These two seed one of each track so the board
  // demos both without needing a live-created example.
  {
    id: 'proj-grad-federated',
    professorId: 'advisor-hoda',
    title: 'Graduation Project: Federated Learning for Cross-Campus Course Recommendation',
    description:
      'Academic-research-track graduation project extending the department\'s recommendation models to a federated setting across multiple campuses without centralizing student data. Intended to conclude in a thesis and a submitted paper.',
    type: 'academic_research',
    requiredCourseCodes: ['CSE213', 'ECEEL1'],
    preferredSkills: ['machine_learning', 'data_science'],
    capacity: 2,
    isActive: true,
    createdAt: '2026-02-01T00:00:00.000Z',
    isGraduationProject: true,
  },
  {
    id: 'proj-grad-fieldkit',
    professorId: 'advisor-waleed',
    title: 'Graduation Project: FieldKit — Deployable Agri-Sensor Starter Kits',
    description:
      'Commercial-spin-off-track graduation project turning the lab\'s LoRa sensor research into a sellable starter kit for smallholder farms. Looking for teammates who want to carry their capstone into an actual company after graduation.',
    type: 'commercial_spinoff',
    requiredCourseCodes: ['ECEEL2', 'ECE413'],
    preferredSkills: ['embedded_systems', 'hardware', 'rf_communications'],
    capacity: 3,
    isActive: true,
    createdAt: '2026-02-05T00:00:00.000Z',
    isGraduationProject: true,
  },
];
