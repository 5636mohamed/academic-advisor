// Spec §3.2 (knapsack) + §5.2 (mandatory F-retake reservation).
// 0/1 knapsack over the credit-hour cap, coreqs bundled as one unit,
// mandatory F-grade retakes reserved FIRST before the optimizer runs on
// whatever credit capacity remains.
import { PlanMode } from '@advisor/shared';
import { scoreCandidate, CandidateForScoring } from './candidateScore';

export interface Bundle {
  members: Array<CandidateForScoring & { courseCode: string; coreq: string[] }>;
  credits: number;
  score: number;
}

function bundleCandidates(
  candidates: Array<CandidateForScoring & { courseCode: string; coreq: string[] }>,
  mode: PlanMode
): Bundle[] {
  const bundles: Bundle[] = [];
  const used = new Set<string>();

  for (const cand of candidates) {
    if (used.has(cand.courseCode)) continue;
    const members = [cand];
    for (const coreqCode of cand.coreq) {
      const partner = candidates.find(x => x.courseCode === coreqCode);
      if (partner && !used.has(coreqCode)) {
        members.push(partner);
        used.add(coreqCode);
      }
    }
    used.add(cand.courseCode);
    const credits = members.reduce((s, m) => s + m.credits, 0);
    const score = members.reduce((s, m) => s + scoreCandidate(m, mode), 0);
    bundles.push({ members, credits, score });
  }
  return bundles;
}

/** Standard 0/1 knapsack DP over the bundle list, credit-hour capacity. */
function knapsack(bundles: Bundle[], cap: number): Bundle[] {
  const n = bundles.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(cap + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    const b = bundles[i - 1];
    for (let w = 0; w <= cap; w++) {
      dp[i][w] = dp[i - 1][w];
      if (b.credits <= w) {
        dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - b.credits] + b.score);
      }
    }
  }

  let w = cap;
  const chosen: Bundle[] = [];
  for (let i = n; i >= 1; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      chosen.push(bundles[i - 1]);
      w -= bundles[i - 1].credits;
    }
  }
  return chosen.reverse();
}

export interface PackPlanInput {
  mandatory: Array<CandidateForScoring & { courseCode: string; coreq: string[] }>; // §5.2 F-grade retakes
  pool: Array<CandidateForScoring & { courseCode: string; coreq: string[] }>;      // everything else, mode-scored
  cap: number;
  mode: PlanMode;
}

export interface PackPlanResult {
  mandatoryBundles: Bundle[];
  optimizedBundles: Bundle[];
  carriedToNextSemester: Bundle[]; // mandatory items that didn't fit even after prioritizing by chain value
  totalCredits: number;
}

export function packPlan(input: PackPlanInput): PackPlanResult {
  const { mandatory, pool, cap, mode } = input;

  // Reserve mandatory bundles first, prioritized by chainUnlockValue when they
  // don't all fit (spec §5.2 overflow rule / §11 Example M).
  const mandatoryBundles = bundleCandidates(mandatory, mode)
    .sort((a, b) => Math.max(...b.members.map(m => m.chainUnlockValue)) - Math.max(...a.members.map(m => m.chainUnlockValue)));

  const fitted: Bundle[] = [];
  const carried: Bundle[] = [];
  let reserved = 0;
  for (const b of mandatoryBundles) {
    if (reserved + b.credits <= cap) {
      fitted.push(b);
      reserved += b.credits;
    } else {
      carried.push(b);
    }
  }

  const remainingCap = cap - reserved;
  const optimizedBundles = remainingCap > 0 ? knapsack(bundleCandidates(pool, mode), remainingCap) : [];

  const totalCredits =
    fitted.reduce((s, b) => s + b.credits, 0) + optimizedBundles.reduce((s, b) => s + b.credits, 0);

  return { mandatoryBundles: fitted, optimizedBundles, carriedToNextSemester: carried, totalCredits };
}
