// Real prediction-engine epic (live report: "some students with high
// grades... why low expected grades") — a genuine per-letter grade
// distribution, deterministically discretized from a course offering's
// real mean/stdDev (seedCourseOfferings.ts), so a course's "modal grade"
// is a real computed quantity, not an invented number. The seed data only
// ever stores an aggregate mean/stdDev per term (no individual per-student
// records exist for the synthetic cohort) — a normal-distribution
// discretization is the standard, honest way to turn "mean X, stdDev Y,
// N students" into a real per-band headcount without fabricating
// individual records: no Math.random anywhere in this file, the exact
// same mean/stdDev/enrolled always produce the exact same distribution.
import { GradeBand, ENG_SCALE, UR_SCALE } from '@advisor/shared';

/** Abramowitz & Stegun 7.1.26 approximation, max absolute error ~1.5e-7 —
 *  plenty precise for turning a headcount into an integer bucket count,
 *  and keeps this dependency-free (no stats library) like every other
 *  module in this file's neighborhood. */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

function normalCdf(x: number, mean: number, std: number): number {
  if (std <= 0) return x < mean ? 0 : 1; // degenerate — everyone got exactly `mean`
  return 0.5 * (1 + erf((x - mean) / (std * Math.SQRT2)));
}

/** `scale` bands are stored high-to-low (`min` descending) — this needs
 *  them low-to-high to walk consecutive [min, nextMin) windows. */
function ascendingBands(scale: GradeBand[]): GradeBand[] {
  return [...scale].sort((a, b) => a.min - b.min);
}

/** Deterministically turns "mean X, stdDev Y, N enrolled" into a real
 *  per-letter headcount summing to exactly N — the probability mass each
 *  grade band captures under a Normal(mean, std) model, rounded to whole
 *  students, with any rounding remainder reconciled onto the single
 *  highest-probability band (the modal one) rather than left to drift the
 *  total off N. */
export function deterministicGradeDistribution(meanPct: number, stdDevPct: number, enrolled: number, isUR: boolean): Record<string, number> {
  const bands = ascendingBands(isUR ? UR_SCALE : ENG_SCALE);
  const raw = bands.map((band, i) => {
    const upper = i + 1 < bands.length ? bands[i + 1].min : 100.0001; // top band's upper edge — just past 100, so it's fully captured
    const mass = normalCdf(upper, meanPct, stdDevPct) - normalCdf(band.min, meanPct, stdDevPct);
    return { letter: band.letter, count: mass * enrolled };
  });

  const rounded = raw.map(r => ({ letter: r.letter, count: Math.round(r.count) }));
  const roundedTotal = rounded.reduce((s, r) => s + r.count, 0);
  const remainder = enrolled - roundedTotal;
  if (remainder !== 0) {
    const biggest = raw.reduce((best, r) => (r.count > best.count ? r : best), raw[0]);
    const target = rounded.find(r => r.letter === biggest.letter)!;
    target.count = Math.max(0, target.count + remainder);
  }

  return Object.fromEntries(rounded.map(r => [r.letter, r.count]));
}

/** Sums per-letter headcounts across several terms — e.g. combining a
 *  course's 3-year (6-term) offering history into one distribution before
 *  reading its overall modal grade, the same way a plain sum would combine
 *  several histograms of the same bins. */
export function combineDistributions(distributions: Array<Record<string, number>>): Record<string, number> {
  const combined: Record<string, number> = {};
  for (const dist of distributions) {
    for (const [letter, count] of Object.entries(dist)) {
      combined[letter] = (combined[letter] ?? 0) + count;
    }
  }
  return combined;
}

/** Modal letter by DENSITY (headcount ÷ band width), not raw headcount —
 *  the correct comparison for a distribution DISCRETIZED across bands of
 *  unequal width. Real bug caught before shipping: the grade bands are
 *  wildly unequal (F alone spans 60 points, 0-59; D spans 5, 60-64) — a
 *  raw-count comparison (`modalLetter` below) lets F win purely by being
 *  a wide catch-all bucket even when a course's real mean sits
 *  comfortably in the D/D+ range (confirmed live: ECE312, mean 63.1%,
 *  raw-count comparison called its cohort "mode" an F). Dividing by each
 *  band's own width normalizes for that before comparing, so the band
 *  actually containing the distribution's real peak wins instead of
 *  whichever band happens to be widest. This is the right tool for a
 *  MODELED continuous distribution (cohortTrend.ts's cohort side);
 *  `modalLetter` (raw count) stays correct for real discrete per-attempt
 *  data (studentStats.ts's student side), where there's no continuous
 *  density to normalize against — each attempt is one real, equally-
 *  weighted event regardless of which band it lands in. */
export function modalLetterByDensity(distribution: Record<string, number>, scale: GradeBand[]): string | null {
  const ascending = ascendingBands(scale);
  const entries = ascending
    .map((band, i) => {
      const upper = i + 1 < ascending.length ? ascending[i + 1].min : 100.0001;
      const width = Math.max(upper - band.min, 0.1);
      const count = distribution[band.letter] ?? 0;
      return { letter: band.letter, density: count / width, pts: band.pts };
    })
    .filter(e => e.density > 0);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b.density - a.density || b.pts - a.pts);
  return entries[0].letter;
}

/** The letter with the highest headcount. Ties broken toward the higher
 *  grade point (matching `scale`'s own band order — a tie between two
 *  equally-likely outcomes is more useful reported as "could be a B+" than
 *  arbitrarily "whichever letter iterated first") — documented, not silent. */
export function modalLetter(distribution: Record<string, number>, scale: GradeBand[]): string | null {
  const entries = Object.entries(distribution).filter(([, count]) => count > 0);
  if (entries.length === 0) return null;
  const bandByLetter = new Map(scale.map(b => [b.letter, b]));
  entries.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]; // higher count first
    return (bandByLetter.get(b[0])?.pts ?? 0) - (bandByLetter.get(a[0])?.pts ?? 0); // tie -> higher grade point first
  });
  return entries[0][0];
}

/** A band's own `min` as its representative point value — e.g. a modal
 *  grade of 'B' (80-84 band) represents as 80. Used wherever a letter-mode
 *  needs to re-enter a numeric blend alongside a mean percentage. */
export function pctForLetter(letter: string, isUR: boolean): number | null {
  const scale = isUR ? UR_SCALE : ENG_SCALE;
  return scale.find(b => b.letter === letter)?.min ?? null;
}
