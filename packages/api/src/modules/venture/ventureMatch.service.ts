// Spec §16.2/§16.3 — turns raw ventureFitScore outputs into the
// suggested/applied/accepted/declined lifecycle. Pure functions, same
// hexagonal style as modules/proposals/proposal.service.ts — the in-memory
// store supplies ids/timestamps and persists the results.
import { StudentVentureMatch, VentureMatchResult, VentureMatchStatus, VentureProject, VentureFitBreakdown } from '@advisor/shared';
import { ventureFitScore, VentureFitStudentInput } from './ventureFitScore';
import weights from '../../config/predictionWeights.json';

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

export interface ComputeMatchesResult {
  results: VentureMatchResult[];
  newlySuggested: StudentVentureMatch[]; // rows to persist — score just crossed threshold, no prior row exists
}

/** §16.2/§16.3 — for every candidate project (already filtered by the
 *  caller to `isActive` and not-at-capacity, EXCEPT projects the student
 *  already has a persisted match against — those are always included so an
 *  existing `applied`/`accepted` row never disappears from under the
 *  student just because the project later filled up via other students),
 *  score it and either reuse the student's existing match row or — only if
 *  the score newly clears `matchThreshold` — mint a fresh `suggested` one.
 *  Below-threshold scores are still returned (so the Venture Board can show
 *  the full ranked list, §16.5) but are never persisted, per §16.2's "cheap
 *  to recompute, no need to store noise" rule. */
export function computeMatchesForStudent(
  studentId: string,
  fitInput: VentureFitStudentInput,
  candidateProjects: VentureProject[],
  existingMatches: StudentVentureMatch[]
): ComputeMatchesResult {
  const threshold = weights.ventureFit.matchThreshold;
  const byProjectId = new Map(existingMatches.map(m => [m.ventureProjectId, m]));
  const newlySuggested: StudentVentureMatch[] = [];

  const results: VentureMatchResult[] = candidateProjects.map(project => {
    const breakdown: VentureFitBreakdown = ventureFitScore(fitInput, project);
    const existing = byProjectId.get(project.id);

    if (existing) {
      return { project, matchId: existing.id, status: existing.status, ...breakdown };
    }
    if (breakdown.total >= threshold) {
      const match: StudentVentureMatch = {
        id: nextId('vmatch'),
        studentId,
        ventureProjectId: project.id,
        matchScore: breakdown.total,
        status: 'suggested',
        createdAt: new Date().toISOString(),
      };
      newlySuggested.push(match);
      return { project, matchId: match.id, status: 'suggested', ...breakdown };
    }
    return { project, matchId: null, status: 'unscored', ...breakdown };
  });

  results.sort((a, b) => b.total - a.total);
  return { results, newlySuggested };
}

/** §16.4 — the single card injected into the Plan Results screen: only the
 *  top-scoring persisted-or-qualifying match, and only if it clears the
 *  threshold. Returns null when nothing qualifies — callers must not
 *  render a card in that case (§16.4's "purely additive" rule). */
export function topCardMatch(results: VentureMatchResult[]): VentureMatchResult | null {
  const threshold = weights.ventureFit.matchThreshold;
  const top = results[0];
  if (!top || top.total < threshold) return null;
  return top;
}

export interface CvAttachment {
  fileName: string;
  dataUrl: string;
}

/** §16.4 — expressing interest optionally attaches a CV in the same step.
 *  A CV can also be attached/replaced later by calling this again while
 *  already `applied` (still a no-op on status, just updates the file) —
 *  only a `suggested` row actually transitions to `applied`. */
export function applyToMatch(match: StudentVentureMatch, cv?: CvAttachment): StudentVentureMatch {
  const withCv = cv ? { ...match, cvFileName: cv.fileName, cvDataUrl: cv.dataUrl } : match;
  if (withCv.status !== 'suggested') return withCv; // no-op on status if already applied/accepted/declined
  return { ...withCv, status: 'applied' };
}

export function setMatchStatus(match: StudentVentureMatch, status: Extract<VentureMatchStatus, 'accepted' | 'declined'>): StudentVentureMatch {
  return { ...match, status };
}

/** Product-owner follow-up to §16.4: a student can express interest (and
 *  attach a CV) in ANY project on their Venture Board — not only the ones
 *  that cleared `matchThreshold` and therefore already have a persisted
 *  `suggested` row. §16.2's "below-threshold scores are never persisted" is
 *  still true for the *automatic* suggestion pass — this only fires on an
 *  explicit student action, so it goes straight to `applied` rather than
 *  passing through `suggested` first (there's nothing to "suggest," the
 *  student already decided). */
export function createDirectApplication(studentId: string, projectId: string, matchScore: number, cv?: CvAttachment): StudentVentureMatch {
  const base: StudentVentureMatch = {
    id: nextId('vmatch'),
    studentId,
    ventureProjectId: projectId,
    matchScore,
    status: 'applied',
    createdAt: new Date().toISOString(),
  };
  return cv ? { ...base, cvFileName: cv.fileName, cvDataUrl: cv.dataUrl } : base;
}

export function nextVentureProjectId(): string {
  return nextId('vproj');
}
