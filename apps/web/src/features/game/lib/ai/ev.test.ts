import { describe, expect, test } from "bun:test";
import { SUCCESS_PROBABILITY } from "@pkg/shared/constants";
import { bestSubset, evCurve } from "./ev";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bruteForceBest(qs: number[], qPass: number): number {
  let best = -Infinity;
  const n = qs.length;
  const maxK = Math.min(5, n);
  // Enumerate all subsets via bitmask; n <= 8 in tests.
  for (let mask = 1; mask < 1 << n; mask++) {
    const subset = qs.filter((_, i) => mask & (1 << i));
    if (subset.length > maxK) continue;
    const probability = SUCCESS_PROBABILITY[subset.length];
    if (probability === undefined) continue;
    const mean = subset.reduce((a, b) => a + b, 0) / subset.length;
    best = Math.max(best, probability * mean + (1 - probability) * qPass);
  }
  return best;
}

describe("evCurve", () => {
  test("matches manual computation", () => {
    const curve = evCurve([0.8, 0.2, -0.1], -0.4);
    expect(curve[0]).toBeCloseTo(0.5 * 0.8 + 0.5 * -0.4, 12);
    expect(curve[1]).toBeCloseTo(0.6 * 0.5 + 0.4 * -0.4, 12);
    expect(curve[2]).toBeCloseTo(0.7 * (0.9 / 3) + 0.3 * -0.4, 12);
  });
});

describe("bestSubset", () => {
  test("matches brute force over all subsets", () => {
    for (let nCells = 1; nCells <= 8; nCells++) {
      for (let trial = 0; trial < 20; trial++) {
        const rng = mulberry32(nCells * 1000 + trial);
        const qs = Array.from({ length: nCells }, () => rng() * 2 - 1);
        const qPass = rng() * 2 - 1;
        const { order, ev } = bestSubset(qs, qPass);
        expect(order.length).toBeGreaterThanOrEqual(1);
        expect(order.length).toBeLessThanOrEqual(5);
        expect(ev).toBeCloseTo(bruteForceBest(qs, qPass), 12);
        // Chosen subset must be a top-k prefix by q.
        const chosen = order.map((i) => qs[i] as number).sort((a, b) => b - a);
        const top = [...qs].sort((a, b) => b - a).slice(0, order.length);
        for (let i = 0; i < chosen.length; i++) {
          expect(chosen[i]).toBeCloseTo(top[i] as number, 12);
        }
      }
    }
  });

  test("two immediate wins prefer two candidates", () => {
    const one = bestSubset([1, 0, 0], 0);
    const two = bestSubset([1, 1, 0], 0);
    expect(one.order.length).toBe(1);
    expect(two.order.length).toBe(2);
    expect(two.ev).toBeGreaterThan(one.ev);
  });
});
