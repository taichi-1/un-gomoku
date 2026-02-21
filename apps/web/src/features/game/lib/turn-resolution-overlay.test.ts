import { describe, expect, test } from "bun:test";
import type { TurnResultDTO } from "@pkg/shared/schemas";
import type { ActiveTurnResolutionFx } from "./turn-resolution-fx-controller";
import {
  getFinalOverlayCandidates,
  getPlacedCandidateIndex,
  getSequenceOverlayCandidates,
  shouldRenderOverlay,
} from "./turn-resolution-overlay";

function createResult(overrides?: Partial<TurnResultDTO>): TurnResultDTO {
  return {
    success: true,
    placedPosition: { x: 2, y: 2 },
    candidates: [
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ],
    player: "player1",
    gameOver: false,
    winner: null,
    ...overrides,
  };
}

function createFx(
  overrides?: Partial<ActiveTurnResolutionFx>,
): ActiveTurnResolutionFx {
  return {
    id: 1,
    result: createResult(),
    timeline: {
      totalMs: 1120,
      sequenceMs: 806,
      finalMs: 314,
      stepMs: 268,
    },
    reducedMotion: false,
    ...overrides,
  };
}

describe("turn-resolution-overlay", () => {
  test("keeps candidate order for sequence rendering", () => {
    const fx = createFx({
      result: createResult({
        candidates: [
          { x: 4, y: 4 },
          { x: 0, y: 0 },
          { x: 3, y: 3 },
        ],
      }),
    });

    const candidates = getSequenceOverlayCandidates(fx);

    expect(candidates).toEqual([
      { coord: { x: 4, y: 4 }, rank: 1 },
      { coord: { x: 0, y: 0 }, rank: 2 },
      { coord: { x: 3, y: 3 }, rank: 3 },
    ]);
  });

  test("success final shows only placed position", () => {
    const fx = createFx({
      result: createResult({
        success: true,
        placedPosition: { x: 3, y: 3 },
        candidates: [
          { x: 1, y: 1 },
          { x: 3, y: 3 },
          { x: 8, y: 8 },
        ],
      }),
    });

    const finalCandidates = getFinalOverlayCandidates(fx);

    expect(finalCandidates).toEqual([{ coord: { x: 3, y: 3 }, rank: 2 }]);
  });

  test("failure final shows markers for all candidates", () => {
    const fx = createFx({
      result: createResult({
        success: false,
        placedPosition: null,
        candidates: [
          { x: 5, y: 5 },
          { x: 6, y: 6 },
          { x: 7, y: 7 },
          { x: 8, y: 8 },
          { x: 9, y: 9 },
        ],
      }),
    });

    const finalCandidates = getFinalOverlayCandidates(fx);

    expect(finalCandidates).toEqual([
      { coord: { x: 5, y: 5 }, rank: 1 },
      { coord: { x: 6, y: 6 }, rank: 2 },
      { coord: { x: 7, y: 7 }, rank: 3 },
      { coord: { x: 8, y: 8 }, rank: 4 },
      { coord: { x: 9, y: 9 }, rank: 5 },
    ]);
  });

  test("returns placed candidate index when success", () => {
    const fx = createFx({
      result: createResult({
        success: true,
        placedPosition: { x: 3, y: 3 },
        candidates: [
          { x: 1, y: 1 },
          { x: 3, y: 3 },
          { x: 8, y: 8 },
        ],
      }),
    });

    expect(getPlacedCandidateIndex(fx)).toBe(1);
  });

  test("returns null placed candidate index when failure", () => {
    const fx = createFx({
      result: createResult({
        success: false,
        placedPosition: null,
      }),
    });

    expect(getPlacedCandidateIndex(fx)).toBeNull();
  });

  test("renders overlay only when phase is not idle", () => {
    expect(shouldRenderOverlay("idle")).toBe(false);
    expect(shouldRenderOverlay("sequence")).toBe(true);
    expect(shouldRenderOverlay("final")).toBe(true);
  });

  test("overlay implementation does not use requestAnimationFrame", async () => {
    const source = await Bun.file(
      "apps/web/src/features/game/components/turn-resolution-overlay.tsx",
    ).text();

    expect(source.includes("requestAnimationFrame")).toBe(false);
  });
});
