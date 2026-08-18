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
  // Product decision: every professor is also an academic
  // advisor, and there's a single shared advisor account (no per-advisor
  // identity — see auth/AuthContext.tsx). This entry is the attribution
  // anchor for ventures the advisor posts directly through the advisor
  // console's own Venture Board (advisorConsole/venture/*) — it deliberately
  // does NOT get a login credential (docs/LOGIN_CREDENTIALS.md) and is
  // filtered out of the student-facing "who hosts this" labels, since the
  // advisor console's venture board is explicitly "my ventures" (§ the
  // advisor manages everything directly, not a directory of other
  // professors) rather than a person a student would ever see named.
  {
    id: 'advisor-owned',
    facultyId: 'ENG',
    departmentId: 'ECE',
    name: 'AEGIS Academic Advising',
    researchTags: [],
    acceptingUndergrads: true,
  },
  // VP epic — the same attribution-anchor pattern as 'advisor-owned' above,
  // for projects the Vice President posts directly (their own Venture
  // Board tab reuses the advisor console's create-project UI). Also
  // deliberately no login credential and filtered from student-facing
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
    professorId: 'prof-kamel',
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
    professorId: 'prof-adel',
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
    professorId: 'prof-kamel',
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
    professorId: 'prof-adel',
    title: 'Archived: Legacy Sensor Fusion Prototype',
    description: 'No longer accepting applicants.',
    type: 'academic_research',
    requiredCourseCodes: ['ECEEL2'],
    preferredSkills: ['embedded_systems'],
    capacity: 2,
    isActive: false,
    createdAt: '2025-09-01T00:00:00.000Z',
  },
];
