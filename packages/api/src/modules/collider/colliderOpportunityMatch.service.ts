// AI Features Blueprint §1.2/§1.5 — advisor-level external-opportunity
// matching, trimmed scope. The blueprint's original §1.5 scored a
// weighted skill VECTOR (from NLP-derived term frequency) against a
// candidate's own weighted vector via cosine similarity — that machinery
// doesn't exist in this cut (no student-facing NLP intake, no
// StudentSkillProfile; see docs/AI_FEATURES_BLUEPRINT.md §5 and the
// scoping decision that trimmed this feature). What's left to match here
// is two unweighted skill-tag SETS (a seeded project's tags vs. a seeded
// opportunity's required tags) — Jaccard similarity (intersection over
// union) is the honest measure for that, not cosine similarity over
// vectors that don't exist.
import { Project, ExternalOpportunity, OpportunityMatch } from '@advisor/shared';

export function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter(s => setB.has(s)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

export function matchOpportunitiesForProject(
  project: Pick<Project, 'skills'>,
  opportunities: ExternalOpportunity[]
): OpportunityMatch[] {
  return opportunities
    .map(opportunity => ({ opportunity, matchScore: Math.round(jaccardSimilarity(project.skills, opportunity.requiredSkills) * 1000) / 1000 }))
    .filter(m => m.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore);
}
