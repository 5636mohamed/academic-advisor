// Spec §3.5 — ventureFitScore(student, project): the third weighted-sum use
// of the WS engine, same pattern as §6's fitScore, blending three 0-1
// signals: course competency (40%), skill/interest alignment (40%), and
// academic trajectory (20%). Weights read from predictionWeights.json's
// `ventureFit` block, per §12's "weighted-sum weights are configuration"
// rule (also cited by name in §3.5 itself).
import { EnrollmentRecord, VentureProject, VentureFitBreakdown } from '@advisor/shared';
import weights from '../../config/predictionWeights.json';
import { VENTURE_QUIZ, VentureQuizAnswers } from './ventureQuiz';

/** §3.5a — average pct across the project's required courses; a required
 *  course the student hasn't taken contributes 0, not undefined. */
export function courseCompetencyScore(transcript: Record<string, EnrollmentRecord>, requiredCourseCodes: string[]): number {
  if (requiredCourseCodes.length === 0) return 0;
  const scores = requiredCourseCodes.map(code => {
    const rec = transcript[code];
    return rec ? rec.pct / 100 : 0;
  });
  return scores.reduce((s, v) => s + v, 0) / scores.length;
}

/** The Venture Interest Form half of §3.5b — same traitMatchCount/
 *  totalAnswered normalization §6's quiz uses, just run against
 *  `preferredSkills` instead of a department's `traits[]`. */
export function ventureInterestOverlap(answers: VentureQuizAnswers, preferredSkills: string[]): number {
  const answeredCount = VENTURE_QUIZ.filter(q => answers[q.id]).length;
  if (answeredCount === 0) return 0;
  const skillSet = new Set(preferredSkills);
  let matched = 0;
  for (const q of VENTURE_QUIZ) {
    const chosenId = answers[q.id];
    if (!chosenId) continue;
    const option = q.options.find(o => o.id === chosenId);
    if (!option) continue;
    if (option.traitTags.some(t => skillSet.has(t))) matched += 1;
  }
  return matched / answeredCount;
}

/** The elective-grades half of §3.5b — "top-performing" is operationalized
 *  as points >= 3.0 (B or better), consistent with the B-or-better bar
 *  §3.5b's academic-trajectory bonus effectively uses too. */
export function electivePerformanceOverlap(
  transcript: Record<string, EnrollmentRecord>,
  courseSkillTags: Record<string, string[]>,
  electiveCourseCodes: Set<string>,
  preferredSkills: string[]
): number {
  if (preferredSkills.length === 0) return 0;
  const studentTags = new Set<string>();
  for (const [code, rec] of Object.entries(transcript)) {
    if (!electiveCourseCodes.has(code)) continue;
    if (rec.points < 3.0) continue;
    for (const tag of courseSkillTags[code] ?? []) studentTags.add(tag);
  }
  const matched = preferredSkills.filter(s => studentTags.has(s)).length;
  return matched / preferredSkills.length;
}

export function skillAlignmentScore(
  answers: VentureQuizAnswers,
  transcript: Record<string, EnrollmentRecord>,
  courseSkillTags: Record<string, string[]>,
  electiveCourseCodes: Set<string>,
  preferredSkills: string[]
): number {
  return 0.5 * ventureInterestOverlap(answers, preferredSkills) + 0.5 * electivePerformanceOverlap(transcript, courseSkillTags, electiveCourseCodes, preferredSkills);
}

export interface TrajectoryInput {
  cgpa: number;
  trendSlope: number | null;
}

/** §3.5c — continuous 0-1 signal: half from raw CGPA/4.0, half a bonus flag
 *  for an improving trend OR cgpa > 3.0. Never a step function on its own —
 *  composes cleanly with the other two WS terms. */
export function academicTrajectoryScore(input: TrajectoryInput): number {
  const bonusEligible = (input.trendSlope !== null && input.trendSlope > weights.trend.improvingSlopeThreshold) || input.cgpa > 3.0;
  const raw = 0.5 * (input.cgpa / 4.0) + 0.5 * (bonusEligible ? 1 : 0);
  return Math.max(0, Math.min(1, raw));
}

export interface VentureFitStudentInput {
  transcript: Record<string, EnrollmentRecord>;
  ventureInterestAnswers: VentureQuizAnswers;
  courseSkillTags: Record<string, string[]>;
  electiveCourseCodes: Set<string>;
  cgpa: number;
  trendSlope: number | null;
}

export function ventureFitScore(
  student: VentureFitStudentInput,
  project: Pick<VentureProject, 'requiredCourseCodes' | 'preferredSkills'>
): VentureFitBreakdown {
  const w = weights.ventureFit;
  const competency = courseCompetencyScore(student.transcript, project.requiredCourseCodes);
  const alignment = skillAlignmentScore(student.ventureInterestAnswers, student.transcript, student.courseSkillTags, student.electiveCourseCodes, project.preferredSkills);
  const trajectory = academicTrajectoryScore({ cgpa: student.cgpa, trendSlope: student.trendSlope });
  const total = w.courseCompetencyWeight * competency + w.skillAlignmentWeight * alignment + w.trajectoryWeight * trajectory;
  return {
    total: Math.round(total * 1000) / 1000,
    courseCompetencyScore: Math.round(competency * 1000) / 1000,
    skillAlignmentScore: Math.round(alignment * 1000) / 1000,
    academicTrajectoryScore: Math.round(trajectory * 1000) / 1000,
  };
}
