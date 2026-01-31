import { describe, expect, test } from "bun:test";
import type { Coordinate } from "@pkg/shared";
import {
  calculateSuccess,
  generateRoomId,
  selectRandomCandidate,
} from "./index";

describe("generateRoomId", () => {
  test("should generate a 6-character room ID", () => {
    const roomId = generateRoomId();
    expect(roomId.length).toBe(6);
  });

  test("should only contain uppercase letters and digits", () => {
    const roomId = generateRoomId();
    expect(roomId).toMatch(/^[A-Z0-9]{6}$/);
  });

  test("should generate unique IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateRoomId());
    }
    // Should have generated mostly unique IDs (allowing some collision)
    expect(ids.size).toBeGreaterThan(90);
  });
});

describe("calculateSuccess", () => {
  test("should return boolean", () => {
    const result = calculateSuccess(1);
    expect(typeof result).toBe("boolean");
  });

  test("should return false for invalid candidate count", () => {
    expect(calculateSuccess(0)).toBe(false);
    expect(calculateSuccess(6)).toBe(false);
  });

  test("should return values based on probability (statistical test)", () => {
    // Run many iterations to test probability
    const iterations = 1000;
    let successes = 0;

    for (let i = 0; i < iterations; i++) {
      if (calculateSuccess(5)) {
        successes++;
      }
    }

    // For 5 candidates (90% success), expect roughly 900 successes
    // Allow 10% margin for random variation
    expect(successes).toBeGreaterThan(800);
    expect(successes).toBeLessThan(980);
  });
});

describe("selectRandomCandidate", () => {
  test("should select a candidate from the array", () => {
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

  test("should return the only candidate when array has one element", () => {
    const candidates: Coordinate[] = [{ x: 5, y: 5 }];
    const selected = selectRandomCandidate(candidates);

    expect(selected.x).toBe(5);
    expect(selected.y).toBe(5);
  });

  test("should select different candidates over many iterations", () => {
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

    // Should have selected at least 2 different candidates
    expect(selections.size).toBeGreaterThanOrEqual(2);
  });
});
