// Spec §6 — Best-Fit Department / Faculty Engine (weighted sum).
//
// NOTE ON PROVENANCE: PROGRESS.md's item 2 says to "port the prototype's
// QUIZ, DEPARTMENTS, ALUMNI, recommendDepartments almost directly (see
// test.html lines ~680-756 in the original upload)". That original
// prototype HTML file is NOT present in this session's upload (only the
// already-scaffolded `academic-advisor` project and the build spec were
// provided) — so this is a from-scratch implementation written to be
// faithful to §6's formula and the worked examples in §11 (H, I, J, K),
// not a literal line-for-line port. If the real prototype file turns up
// later, diff its QUIZ/DEPARTMENTS/ALUMNI constants against these and
// prefer the original's seed data verbatim; the *engine functions*
// (fitScore/recommendDepartments/rankFacultiesByFit) should not need to
// change either way since they only depend on the shapes below.
import { Transcript } from '@advisor/shared';
import weights from '../../config/predictionWeights.json';

/** One quiz question. A student picks exactly one option; each option is
 *  tagged with the traits it signals (§6's "quiz+grades+alumni engine"). */
export interface QuizOption {
  id: string;
  label: string;
  traitTags: string[];
}

export interface QuizQuestion {
  id: string;
  text: string;
  options: QuizOption[];
}

/** studentId keys are not needed here — a quiz run is one option-id per
 *  question, keyed by questionId. */
export type QuizAnswers = Record<string, string>; // questionId -> optionId

export interface DepartmentProfile {
  id: string;
  name: string;
  facultyId: string;
  /** Trait tags this department is strong-signal for (matched against the
   *  student's selected quiz-option trait tags). */
  traits: string[];
  /** Courses used as the "how are you actually doing in subjects like
   *  this?" signal — §6's `gwScore`. */
  gatewayCourseCodes: string[];
}

export interface FacultyProfile {
  id: string;
  name: string;
  /** University-wide "basic science" gateway courses used for the
   *  faculty-level gwScore (§6: "Gateway signal here uses the
   *  university-wide basic science shared courses... since those are what
   *  a faculty-transfer candidate will actually have grades in"). */
  basicScienceGatewayCodes: string[];
}

export interface AlumniStats {
  employmentRate: number; // 0-100
  satisfaction: number; // 0-5
}

export interface DeptFitResult {
  id: string;
  name: string;
  total: number;
  quizScore: number;
  gwScore: number;
  alumScore: number;
}

// ---------------------------------------------------------------------
// Seed data — Faculty of Engineering (the seeded ECE catalog's home
// faculty, id 'ENG') plus one alternate faculty (Business Informatics,
// id 'BUS') so the §4.2 tier-3 faculty-transfer branch (§11 Examples I/K)
// has somewhere real to point to. Extend this list as more faculties are
// onboarded — it is intentionally small rather than exhaustive.
// ---------------------------------------------------------------------

export const QUIZ: QuizQuestion[] = [
  {
    id: 'q1_problem_style',
    text: 'When you tackle a hard problem, you gravitate toward…',
    options: [
      { id: 'q1_math', label: 'Working through the math/derivation first', traitTags: ['analytical', 'math_heavy', 'theory'] },
      { id: 'q1_build', label: 'Building/prototyping something and iterating', traitTags: ['hands_on', 'systems', 'engineering'] },
      { id: 'q1_data', label: 'Finding patterns in data or logic', traitTags: ['analytical', 'software', 'algorithmic'] },
      { id: 'q1_people', label: 'Talking it through with people affected by it', traitTags: ['communication', 'business', 'people_facing'] },
    ],
  },
  {
    id: 'q2_favorite_subject',
    text: 'Which of these have you enjoyed most so far?',
    options: [
      { id: 'q2_signals', label: 'Signals/circuits/hardware', traitTags: ['hardware', 'engineering', 'systems'] },
      { id: 'q2_programming', label: 'Programming/algorithms', traitTags: ['software', 'algorithmic', 'analytical'] },
      { id: 'q2_math', label: 'Pure math/physics', traitTags: ['math_heavy', 'theory', 'analytical'] },
      { id: 'q2_econ', label: 'Economics/management', traitTags: ['business', 'people_facing', 'communication'] },
    ],
  },
  {
    id: 'q3_project_role',
    text: 'On a team project you usually end up…',
    options: [
      { id: 'q3_architect', label: 'Designing the overall system/architecture', traitTags: ['systems', 'engineering', 'analytical'] },
      { id: 'q3_coder', label: 'Writing/debugging the code', traitTags: ['software', 'algorithmic'] },
      { id: 'q3_lead', label: 'Coordinating people and deadlines', traitTags: ['business', 'people_facing', 'communication'] },
      { id: 'q3_theory', label: 'Working out the underlying theory/model', traitTags: ['theory', 'math_heavy', 'analytical'] },
    ],
  },
  {
    id: 'q4_ideal_job',
    text: 'Your ideal first job after graduating looks like…',
    options: [
      { id: 'q4_hw', label: 'Hardware/embedded/RF engineer', traitTags: ['hardware', 'engineering', 'systems'] },
      { id: 'q4_swe', label: 'Software engineer/data scientist', traitTags: ['software', 'algorithmic', 'analytical'] },
      { id: 'q4_analyst', label: 'Business/financial analyst', traitTags: ['business', 'people_facing', 'communication'] },
      { id: 'q4_researcher', label: 'Research/grad school', traitTags: ['theory', 'math_heavy', 'analytical'] },
    ],
  },
];

// The 10 real FoE programs (`FOE Handbook.pdf`'s Table 2 "FoE Schools and
// Programs") — real course-code gateways drawn from each program's own
// early differentiator courses (see the matching seed<Program>Catalog.ts
// files). Superseded the earlier ECE/CSE/MCE placeholder set once real
// catalogs existed for every FoE program to point a gateway at — 'MCE'
// never matched the handbook's own department code anyway (it's 'MTR',
// program code 'MTE').
export const DEPARTMENTS: DepartmentProfile[] = [
  {
    id: 'ECE',
    name: 'Electronics & Communications Engineering',
    facultyId: 'ENG',
    traits: ['hardware', 'engineering', 'systems', 'math_heavy'],
    gatewayCourseCodes: ['ECE314', 'ECE317', 'ECE221'],
  },
  {
    id: 'CSE',
    name: 'Computer Science & Engineering',
    facultyId: 'ENG',
    traits: ['software', 'algorithmic', 'analytical'],
    gatewayCourseCodes: ['CSE311', 'CSE317'],
  },
  {
    id: 'MIE',
    name: 'Biomedical & Bioinformatics Engineering',
    facultyId: 'ENG',
    traits: ['analytical', 'systems', 'hardware'],
    gatewayCourseCodes: ['MIE314', 'MIE211'],
  },
  {
    id: 'EPE',
    name: 'Electrical Power Engineering',
    facultyId: 'ENG',
    traits: ['hardware', 'engineering', 'systems', 'math_heavy'],
    gatewayCourseCodes: ['EPE321', 'ECE312'],
  },
  {
    id: 'MTE',
    name: 'Mechatronics Engineering',
    facultyId: 'ENG',
    traits: ['hands_on', 'engineering', 'systems'],
    gatewayCourseCodes: ['MTE322', 'MTE323'],
  },
  {
    id: 'MSE',
    name: 'Materials Science & Engineering',
    facultyId: 'ENG',
    traits: ['analytical', 'engineering', 'hands_on'],
    gatewayCourseCodes: ['MSE311', 'MSE322'],
  },
  {
    id: 'IME',
    name: 'Industrial & Manufacturing Engineering',
    facultyId: 'ENG',
    traits: ['business', 'engineering', 'analytical'],
    gatewayCourseCodes: ['IME312', 'IME316'],
  },
  {
    id: 'ERE',
    name: 'Energy Resources Engineering',
    facultyId: 'ENG',
    traits: ['engineering', 'systems', 'analytical'],
    gatewayCourseCodes: ['ERE312', 'ERE313'],
  },
  {
    id: 'ENV',
    name: 'Environmental Engineering',
    facultyId: 'ENG',
    traits: ['analytical', 'engineering', 'systems'],
    gatewayCourseCodes: ['ENV312', 'ENV314'],
  },
  {
    id: 'CPE',
    name: 'Chemical & Petrochemical Engineering',
    facultyId: 'ENG',
    traits: ['analytical', 'engineering', 'math_heavy'],
    gatewayCourseCodes: ['CPE312', 'CPE315'],
  },
];

export const FACULTIES: FacultyProfile[] = [
  {
    id: 'ENG',
    name: 'Faculty of Engineering',
    basicScienceGatewayCodes: ['MTH111', 'MTH121', 'PHY111', 'PHY121', 'CSE211'],
  },
  {
    id: 'BUS',
    name: 'Faculty of Business Informatics',
    basicScienceGatewayCodes: ['MTH111', 'MTH121', 'CSE211'],
  },
];

/** Sub-departments inside faculties other than 'ENG', used only to compute
 *  the "mean of top-3 departments in that faculty" component of
 *  `rankFacultiesByFit`. These are synthetic placeholders (no course
 *  catalog exists for them yet in this seed) — flagged, not a gap in the
 *  engine logic itself. */
export const OTHER_FACULTY_DEPARTMENTS: DepartmentProfile[] = [
  { id: 'BIS', name: 'Business Informatics', facultyId: 'BUS', traits: ['business', 'analytical', 'communication'], gatewayCourseCodes: ['CSE211'] },
  { id: 'ACC', name: 'Accounting & Finance', facultyId: 'BUS', traits: ['business', 'analytical'], gatewayCourseCodes: ['MTH111'] },
  { id: 'MKT', name: 'Marketing', facultyId: 'BUS', traits: ['business', 'people_facing', 'communication'], gatewayCourseCodes: [] },
];

const ALUMNI_BY_DEPARTMENT: Record<string, AlumniStats> = {
  ECE: { employmentRate: 82, satisfaction: 3.9 },
  CSE: { employmentRate: 91, satisfaction: 4.2 },
  MIE: { employmentRate: 80, satisfaction: 3.9 },
  EPE: { employmentRate: 83, satisfaction: 3.8 },
  MTE: { employmentRate: 79, satisfaction: 3.8 },
  MSE: { employmentRate: 76, satisfaction: 3.6 },
  IME: { employmentRate: 85, satisfaction: 3.9 },
  ERE: { employmentRate: 81, satisfaction: 3.7 },
  ENV: { employmentRate: 77, satisfaction: 3.7 },
  CPE: { employmentRate: 80, satisfaction: 3.7 },
  BIS: { employmentRate: 85, satisfaction: 4.0 },
  ACC: { employmentRate: 88, satisfaction: 3.8 },
  MKT: { employmentRate: 80, satisfaction: 3.6 },
};

const ALUMNI_BY_FACULTY: Record<string, AlumniStats> = {
  ENG: { employmentRate: 84, satisfaction: 3.9 },
  BUS: { employmentRate: 86, satisfaction: 3.9 },
};

// ---------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------

/** §6's `traitMatches(target.traits, answers)` — how many of the answered
 *  questions signaled at least one trait this target is strong-signal for.
 *  Returns a raw count in [0, answers.length]; callers divide by the
 *  number of questions to normalize to [0, 1]. */
function traitMatchCount(targetTraits: string[], answers: QuizAnswers, quiz: QuizQuestion[] = QUIZ): number {
  const traitSet = new Set(targetTraits);
  let matched = 0;
  for (const q of quiz) {
    const chosenId = answers[q.id];
    if (!chosenId) continue;
    const option = q.options.find(o => o.id === chosenId);
    if (!option) continue;
    if (option.traitTags.some(t => traitSet.has(t))) matched += 1;
  }
  return matched;
}

function quizScoreFor(targetTraits: string[], answers: QuizAnswers, quiz: QuizQuestion[] = QUIZ): number {
  const answeredCount = quiz.filter(q => answers[q.id]).length;
  if (answeredCount === 0) return 0;
  return traitMatchCount(targetTraits, answers, quiz) / answeredCount;
}

/** Mean of transcript points/4 across the given gateway course codes; the
 *  student's active-transcript entries are looked up by course code. Falls
 *  back to the configured neutral prior (default 0.6) when the student has
 *  no grades yet in any of the gateway courses — e.g. a first-year student
 *  taking the quiz before any relevant course, or a faculty whose gateway
 *  courses genuinely don't overlap with their current program. */
function gatewayScoreFor(gatewayCourseCodes: string[], transcript: Transcript): number {
  const points: number[] = [];
  for (const code of gatewayCourseCodes) {
    const rec = transcript[code];
    if (rec) points.push(rec.points / 4);
  }
  if (points.length === 0) return weights.deptFit.neutralGatewayPrior;
  return points.reduce((s, p) => s + p, 0) / points.length;
}

function alumniScoreFor(stats: AlumniStats): number {
  return 0.5 * (stats.employmentRate / 100) + 0.5 * (stats.satisfaction / 5);
}

/** §6's `fitScore(target, student, answers)` — the core weighted-sum
 *  formula, shared by both the department-level and faculty-level callers
 *  below. `target` here is anything with `traits` + `gatewayCourseCodes`
 *  (a `DepartmentProfile`) plus its alumni stats supplied separately, so
 *  the same function serves both `recommendDepartments` and the
 *  per-department half of `rankFacultiesByFit`. */
export function fitScore(
  target: Pick<DepartmentProfile, 'id' | 'name' | 'traits' | 'gatewayCourseCodes'>,
  transcript: Transcript,
  answers: QuizAnswers,
  alumni: AlumniStats
): DeptFitResult {
  const quizScore = quizScoreFor(target.traits, answers);
  const gwScore = gatewayScoreFor(target.gatewayCourseCodes, transcript);
  const alumScore = alumniScoreFor(alumni);
  const w = weights.deptFit;
  const total = w.quizWeight * quizScore + w.gatewayGradeWeight * gwScore + w.alumniWeight * alumScore;
  return { id: target.id, name: target.name, total: Math.round(total * 1000) / 1000, quizScore, gwScore, alumScore };
}

/** §4.2 tier-2 input — restricted to departments within `student.facultyId`,
 *  sorted best-fit first. */
export function recommendDepartments(facultyId: string, transcript: Transcript, answers: QuizAnswers): DeptFitResult[] {
  const candidates = [...DEPARTMENTS, ...OTHER_FACULTY_DEPARTMENTS].filter(d => d.facultyId === facultyId);
  return candidates
    .map(d => fitScore(d, transcript, answers, ALUMNI_BY_DEPARTMENT[d.id] ?? { employmentRate: 75, satisfaction: 3.5 }))
    .sort((a, b) => b.total - a.total);
}

/** §4.2 tier-3 input — faculty-level aggregate: mean of the top-N
 *  (default 3, configurable) department scores in that faculty, plus a
 *  faculty-wide gateway signal computed off the university-wide
 *  "basic science" shared courses (not any one department's electives —
 *  see the module-level note above), plus faculty-wide alumni stats.
 *  Never recommends the student's OWN current faculty. */
export function rankFacultiesByFit(currentFacultyId: string, transcript: Transcript, answers: QuizAnswers): DeptFitResult[] {
  const topN = weights.deptFit.topDepartmentsForFacultyAggregate;
  const w = weights.deptFit;

  return FACULTIES.filter(f => f.id !== currentFacultyId)
    .map(f => {
      const deptsInFaculty = [...DEPARTMENTS, ...OTHER_FACULTY_DEPARTMENTS].filter(d => d.facultyId === f.id);
      const deptScores = deptsInFaculty
        .map(d => quizScoreFor(d.traits, answers))
        .sort((a, b) => b - a)
        .slice(0, topN);
      const quizScore = deptScores.length > 0 ? deptScores.reduce((s, v) => s + v, 0) / deptScores.length : 0;

      const gwScore = gatewayScoreFor(f.basicScienceGatewayCodes, transcript);
      const alumStats = ALUMNI_BY_FACULTY[f.id] ?? { employmentRate: 75, satisfaction: 3.5 };
      const alumScore = alumniScoreFor(alumStats);

      const total = w.quizWeight * quizScore + w.gatewayGradeWeight * gwScore + w.alumniWeight * alumScore;
      return { id: f.id, name: f.name, total: Math.round(total * 1000) / 1000, quizScore, gwScore, alumScore };
    })
    .sort((a, b) => b.total - a.total);
}
