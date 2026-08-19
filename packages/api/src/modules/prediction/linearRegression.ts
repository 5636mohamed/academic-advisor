// Spec §3.1 / §3.4 — generic Ordinary Least Squares regression used by every
// trend-projection function in the system (cohort trend, student ability
// trend, CGPA trajectory trend). Kept dependency-free and pure for easy
// unit testing.

export interface OlsResult {
  a: number; // intercept
  b: number; // slope
}

/** Fits y = a + b*x over paired arrays of equal length (x typically a
 *  0-based term/semester index), optionally weighted (weighted least
 *  squares — see `recencyWeights` below for this system's actual use of
 *  it). Returns slope 0 / intercept = mean(y) when there's insufficient
 *  variance or <2 points, so callers never have to special-case degenerate
 *  inputs. Unweighted callers (the default — `weights` omitted) get back
 *  exactly the plain-OLS behavior this function always had; every weight
 *  equal to 1 reduces algebraically to the same formula. */
export function ols(x: number[], y: number[], weights?: number[]): OlsResult {
  const n = x.length;
  if (n === 0) return { a: 0, b: 0 };
  if (n === 1) return { a: y[0], b: 0 };

  const w = weights ?? x.map(() => 1);
  const wSum = w.reduce((s, v) => s + v, 0);
  const xBar = x.reduce((s, v, i) => s + v * w[i], 0) / wSum;
  const yBar = y.reduce((s, v, i) => s + v * w[i], 0) / wSum;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += w[i] * (x[i] - xBar) * (y[i] - yBar);
    den += w[i] * (x[i] - xBar) ** 2;
  }

  const b = den === 0 ? 0 : num / den;
  const a = yBar - b * xBar;
  return { a, b };
}

/** Exponential recency weights for a length-`n` chronological series (index
 *  0 = oldest, n-1 = most recent): the most recent point gets weight 1, and
 *  weight halves every `halfLife` steps further back. Plain OLS treats a
 *  grade/offering from years ago identically to last term's — for series
 *  that genuinely drift over time (a student's ability changing term to
 *  term, a course's difficulty creeping up or down), that wastes signal.
 *
 *  `halfLife = 5` is not a guess: it's the value that minimized leave-last-
 *  out mean absolute error in a backtest against this system's own seeded
 *  student transcripts (125 series) and course-offering histories (82
 *  series) — see PROGRESS.md's regression-tuning note for the full sweep.
 *  It cut student-trend MAE by ~10% and cohort-trend MAE by ~1% versus
 *  unweighted OLS; more aggressive weighting (halfLife too low) overfits
 *  to the single latest point and did measurably worse than plain OLS. */
export function recencyWeights(n: number, halfLife = 5): number[] {
  if (n <= 0) return [];
  const decay = Math.pow(0.5, 1 / halfLife);
  return Array.from({ length: n }, (_, i) => Math.pow(decay, n - 1 - i));
}

export function project(ols: OlsResult, xNext: number): number {
  return ols.a + ols.b * xNext;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
