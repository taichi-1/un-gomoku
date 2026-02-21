import { describe, expect, test } from "bun:test";
import type { Coordinate } from "@pkg/shared/schemas";
import {
  applyCandidateSelection,
  coordinateKey,
  hasDuplicateCandidates,
} from "./candidate";

const A: Coordinate = { x: 1, y: 1 };
const B: Coordinate = { x: 2, y: 2 };

describe("candidate helpers", () => {
  test("coordinateKey is stable", () => {
    expect(coordinateKey(A)).toBe("1:1");
  });

  test("applyCandidateSelection adds new coordinate", () => {
    expect(applyCandidateSelection([], A, true)).toEqual([A]);
  });

  test("applyCandidateSelection removes coordinate", () => {
    expect(applyCandidateSelection([A, B], A, false)).toEqual([B]);
  });

  test("hasDuplicateCandidates detects duplicates", () => {
    expect(hasDuplicateCandidates([A, B, A])).toBe(true);
    expect(hasDuplicateCandidates([A, B])).toBe(false);
  });
});
