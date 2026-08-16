// "Risk level" (Low / Medium / High / Very High) — All-Students.pdf and
// dashboard-advisor.pdf's own column. Derived entirely from real data (the
// same probation warning counter and cgpa every other screen in this app
// already uses) — never a separate/fabricated score. The real ladder is
// 0-6 warnings (§4.1), not the mockup's inconsistent "/8" — same call the
// student portal's ProbationTrack already made.
export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Very High';

export function riskLevelFor(cgpa: number, probationCount: number): RiskLevel {
  if (probationCount >= 5) return 'Very High';
  if (probationCount >= 3) return 'High';
  if (probationCount >= 1) return 'Medium';
  if (cgpa < 2.0) return 'Medium'; // heading toward probation even before the counter has armed
  return 'Low';
}

export const RISK_TONE: Record<RiskLevel, string> = {
  Low: 'ok',
  Medium: 'warn',
  High: 'danger',
  'Very High': 'danger',
};
