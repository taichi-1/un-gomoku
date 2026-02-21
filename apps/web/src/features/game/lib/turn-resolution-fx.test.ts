import { describe, expect, test } from "bun:test";
import type { TurnResultDTO } from "@pkg/shared/schemas";
import {
  createTurnResolutionFxRuntime,
  createTurnResolutionTimeline,
  decideTurnHistoryFx,
  getTurnResolutionFxState,
  isTurnResolutionInteractionLocked,
} from "./turn-resolution-fx";

const successResult: TurnResultDTO = {
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
};

const failureResult: TurnResultDTO = {
  success: false,
  placedPosition: null,
  candidates: [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 2 },
    { x: 3, y: 3 },
    { x: 4, y: 4 },
  ],
  player: "player2",
  gameOver: false,
  winner: null,
};

describe("turn resolution fx timeline", () => {
  test("respects 1.0s lower bound even with one candidate", () => {
    const timeline = createTurnResolutionTimeline(1);

    expect(timeline.totalMs).toBe(1000);
    expect(timeline.sequenceMs).toBe(720);
    expect(timeline.finalMs).toBe(280);
  });

  test("success: candidates light in order and finish with only final phase", () => {
    const runtime = createTurnResolutionFxRuntime(successResult, 0);

    const startState = getTurnResolutionFxState(runtime, 0);
    expect(startState?.phase).toBe("sequence");
    expect(startState?.sequenceVisibleCount).toBe(1);
    expect(startState?.sequenceActiveIndex).toBe(0);

    const midState = getTurnResolutionFxState(
      runtime,
      runtime.timeline.stepMs + 1,
    );
    expect(midState?.phase).toBe("sequence");
    expect(midState?.sequenceVisibleCount).toBe(2);
    expect(midState?.sequenceActiveIndex).toBe(1);

    const finalState = getTurnResolutionFxState(
      runtime,
      runtime.timeline.sequenceMs + 1,
    );
    expect(finalState?.phase).toBe("final");
    expect(finalState?.showFailureMarkers).toBe(false);
    expect(finalState?.showBoardMissFlash).toBe(false);

    const endedState = getTurnResolutionFxState(
      runtime,
      runtime.timeline.totalMs,
    );
    expect(endedState).toBeNull();
  });

  test("failure: final phase shows failure markers for all candidates", () => {
    const runtime = createTurnResolutionFxRuntime(failureResult, 0);

    const finalState = getTurnResolutionFxState(
      runtime,
      runtime.timeline.sequenceMs + 1,
    );

    expect(finalState?.phase).toBe("final");
    expect(finalState?.sequenceVisibleCount).toBe(
      failureResult.candidates.length,
    );
    expect(finalState?.showFailureMarkers).toBe(true);
    expect(finalState?.showBoardMissFlash).toBe(true);
  });
});

describe("turn history trigger decision", () => {
  test("does not replay on first mount", () => {
    expect(
      decideTurnHistoryFx({
        isInitialized: false,
        previousLength: 5,
        currentLength: 6,
      }),
    ).toBe("none");
  });

  test("skips animation when multiple turns arrive at once", () => {
    expect(
      decideTurnHistoryFx({
        isInitialized: true,
        previousLength: 1,
        currentLength: 3,
      }),
    ).toBe("skip_multiple");
  });

  test("interaction lock is true during fx and false after end", () => {
    const runtime = createTurnResolutionFxRuntime(successResult, 0);

    const activeState = getTurnResolutionFxState(runtime, 10);
    expect(isTurnResolutionInteractionLocked(activeState)).toBe(true);

    const endedState = getTurnResolutionFxState(
      runtime,
      runtime.timeline.totalMs,
    );
    expect(isTurnResolutionInteractionLocked(endedState)).toBe(false);
  });
});
