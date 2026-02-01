import { describe, expect, test } from "bun:test";
import type { Coordinate } from "@pkg/shared/schemas";
import { calculateSuccess, selectRandomCandidate } from "./random";

describe("calculateSuccess", () => {
  test("returns true when random < probability", () => {
    expect(calculateSuccess(1, () => 0.4)).toBe(true);
    expect(calculateSuccess(1, () => 0.49)).toBe(true);
  });

  test("returns false when random >= probability", () => {
    expect(calculateSuccess(1, () => 0.5)).toBe(false);
    expect(calculateSuccess(1, () => 0.6)).toBe(false);
  });

  test("returns false for invalid candidate count", () => {
    expect(calculateSuccess(0, () => 0)).toBe(false);
    expect(calculateSuccess(6, () => 1)).toBe(false);
  });

  test("respects probability for each candidate count (deterministic)", () => {
    // 5 candidates = 90% = 0.9 threshold
    expect(calculateSuccess(5, () => 0.89)).toBe(true);
    expect(calculateSuccess(5, () => 0.9)).toBe(false);
    // 1 candidate = 50% = 0.5 threshold
    expect(calculateSuccess(1, () => 0.4)).toBe(true);
    expect(calculateSuccess(1, () => 0.6)).toBe(false);
  });

  test("returns boolean (statistical)", () => {
    const result = calculateSuccess(1);
    expect(typeof result).toBe("boolean");
  });

  test("probability distribution over many iterations", () => {
    let successes = 0;
    for (let i = 0; i < 1000; i++) {
      if (calculateSuccess(5)) successes++;
    }
    expect(successes).toBeGreaterThan(800);
    expect(successes).toBeLessThan(980);
  });
});

describe("selectRandomCandidate", () => {
  test("returns fixed index when random is deterministic", () => {
    const candidates: Coordinate[] = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ];
    expect(selectRandomCandidate(candidates, () => 0)).toEqual({
      x: 0,
      y: 0,
    });
    expect(selectRandomCandidate(candidates, () => 0.5)).toEqual({
      x: 1,
      y: 1,
    });
    expect(selectRandomCandidate(candidates, () => 0.99)).toEqual({
      x: 2,
      y: 2,
    });
  });

  test("returns the only candidate when array has one element", () => {
    const candidates: Coordinate[] = [{ x: 5, y: 5 }];
    expect(selectRandomCandidate(candidates)).toEqual({ x: 5, y: 5 });
  });

  test("throws when candidates array is empty", () => {
    expect(() => selectRandomCandidate([])).toThrow("No candidates available");
  });

  test("selects from array (statistical)", () => {
    const candidates: Coordinate[] = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ];
    const selected = selectRandomCandidate(candidates);
    const found = candidates.some(
      (c) => c.x === selected.x && c.y === selected.y,
    );
    expect(found).toBe(true);
  });

  test("selects different candidates over many iterations", () => {
    const candidates: Coordinate[] = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ];
    const selections = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const selected = selectRandomCandidate(candidates);
      selections.add(`${selected.x},${selected.y}`);
    }
    expect(selections.size).toBeGreaterThanOrEqual(2);
  });
});
