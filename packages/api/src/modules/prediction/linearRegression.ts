// Spec §3.1 / §3.4 — generic Ordinary Least Squares regression used by every
// trend-projection function in the system (cohort trend, student ability
// trend, CGPA trajectory trend). Kept dependency-free and pure for easy
// unit testing.

export interface OlsResult {
  a: number; // intercept
  b: number; // slope
}

/** Fits y = a + b*x over paired arrays of equal length (x typically a
 *  0-based term/semester index). Returns slope 0 / intercept = mean(y)
 *  when there's insufficient variance or <2 points, so callers never have
 *  to special-case degenerate inputs. */
export function ols(x: number[], y: number[]): OlsResult {
  const n = x.length;
  if (n === 0) return { a: 0, b: 0 };
  if (n === 1) return { a: y[0], b: 0 };

  const xBar = x.reduce((s, v) => s + v, 0) / n;
  const yBar = y.reduce((s, v) => s + v, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - xBar) * (y[i] - yBar);
    den += (x[i] - xBar) ** 2;
  }

  const b = den === 0 ? 0 : num / den;
  const a = yBar - b * xBar;
  return { a, b };
}

export function project(ols: OlsResult, xNext: number): number {
  return ols.a + ols.b * xNext;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
