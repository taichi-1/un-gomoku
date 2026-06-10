/**
 * Expected-value rule over candidate subsets.
 *
 * EV(S) = p(|S|) * mean_{c in S} Q(c) + (1 - p(|S|)) * Q_pass
 *
 * Because the placed cell is uniform over S, the optimal subset of size k is
 * exactly the k cells with the highest Q, so move choice reduces to comparing
 * top-k prefixes for k = 1..5. Line-for-line mirror of ml mcts/ev.py.
 */

import { MAX_CANDIDATES, SUCCESS_PROBABILITY } from "@pkg/shared/constants";

export interface SubsetChoice {
  /** Indices into the q array, best-first. */
  order: number[];
  ev: number;
}

/** EV of the top-k prefix for k = 1..min(maxK, q.length); q must be sorted descending. */
export function evCurve(
  qSortedDesc: number[],
  qPass: number,
  maxK: number = MAX_CANDIDATES,
): number[] {
  const limit = Math.min(maxK, qSortedDesc.length, MAX_CANDIDATES);
  const curve: number[] = [];
  let sum = 0;
  for (let k = 1; k <= limit; k++) {
    const q = qSortedDesc[k - 1];
    const probability = SUCCESS_PROBABILITY[k];
    if (q === undefined || probability === undefined) break;
    sum += q;
    curve.push(probability * (sum / k) + (1 - probability) * qPass);
  }
  return curve;
}

/** Returns the optimal subset (indices into qValues, best-first) and its EV. */
export function bestSubset(
  qValues: number[],
  qPass: number,
  maxK: number = MAX_CANDIDATES,
): SubsetChoice {
  if (qValues.length === 0) {
    throw new Error("bestSubset needs at least one q value");
  }
  const order = qValues
    .map((q, index) => ({ q, index }))
    .sort((a, b) => b.q - a.q || a.index - b.index)
    .map((entry) => entry.index);
  const sorted = order.map((index) => qValues[index] as number);
  const curve = evCurve(sorted, qPass, maxK);
  let bestK = 1;
  let bestEv = -Infinity;
  for (let k = 1; k <= curve.length; k++) {
    const ev = curve[k - 1];
    if (ev !== undefined && ev > bestEv) {
      bestEv = ev;
      bestK = k;
    }
  }
  return { order: order.slice(0, bestK), ev: bestEv };
}
