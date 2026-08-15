// Spec §3.3 — multi-level dependency-chain value. A property of the course
// GRAPH, not the student, so it is memoized per catalog version rather than
// recomputed per request (spec §12 edge-case checklist item).
import { Course } from '@advisor/shared';
import weights from '../../config/predictionWeights.json';

const memo = new Map<string, number>();

export function clearChainUnlockCache() {
  memo.clear();
}

export function chainUnlockValue(
  code: string,
  catalog: Course[],
  depth: number = weights.chainUnlock.depth,
  decay: number = weights.chainUnlock.decay
): number {
  const cacheKey = `${code}:${depth}:${decay}`;
  if (memo.has(cacheKey)) return memo.get(cacheKey)!;

  const direct = catalog.filter(c => c.prereq.includes(code));
  let value = direct.length;

  if (depth > 1) {
    for (const d of direct) {
      value += decay * chainUnlockValue(d.code, catalog, depth - 1, decay);
    }
  }

  memo.set(cacheKey, value);
  return value;
}
