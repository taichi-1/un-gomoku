import { describe, expect, test } from "bun:test";
import type { TurnResultDTO } from "@pkg/shared/schemas";
import {
  createInitialTurnResolutionFxControllerState,
  reducePhaseCompletion,
  reduceTurnHistoryUpdate,
} from "./turn-resolution-fx-controller";

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

describe("turn-resolution-fx-controller", () => {
  test("does not replay on initial mount", () => {
    const initial = createInitialTurnResolutionFxControllerState();

    const next = reduceTurnHistoryUpdate(initial, {
      turnHistory: [createResult()],
      prefersReducedMotion: false,
    });

    expect(next.isInitialized).toBe(true);
    expect(next.previousLength).toBe(1);
    expect(next.phase).toBe("idle");
    expect(next.activeFx).toBeNull();
  });

  test("starts sequence when exactly one turn is appended", () => {
    const initialized = reduceTurnHistoryUpdate(
      createInitialTurnResolutionFxControllerState(),
      {
        turnHistory: [],
        prefersReducedMotion: false,
      },
    );

    const next = reduceTurnHistoryUpdate(initialized, {
      turnHistory: [createResult()],
      prefersReducedMotion: false,
    });

    expect(next.phase).toBe("sequence");
    expect(next.activeFx).not.toBeNull();
    expect(next.activeFx?.id).toBe(1);
  });

  test("skips animation when multiple turns arrive at once", () => {
    let state = reduceTurnHistoryUpdate(
      createInitialTurnResolutionFxControllerState(),
      {
        turnHistory: [createResult()],
        prefersReducedMotion: false,
      },
    );

    state = {
      ...state,
      isInitialized: true,
      previousLength: 1,
      phase: "sequence",
      activeFx: {
        id: 1,
        result: createResult(),
        timeline: {
          totalMs: 1000,
          sequenceMs: 720,
          finalMs: 280,
          stepMs: 240,
        },
        reducedMotion: false,
      },
    };

    const next = reduceTurnHistoryUpdate(state, {
      turnHistory: [createResult(), createResult(), createResult()],
      prefersReducedMotion: false,
    });

    expect(next.phase).toBe("idle");
    expect(next.activeFx).toBeNull();
  });

  test("transitions sequence -> final -> idle through phase completion", () => {
    const sequenceState = {
      ...createInitialTurnResolutionFxControllerState(),
      isInitialized: true,
      previousLength: 1,
      phase: "sequence" as const,
      activeFx: {
        id: 1,
        result: createResult(),
        timeline: {
          totalMs: 1000,
          sequenceMs: 720,
          finalMs: 280,
          stepMs: 240,
        },
        reducedMotion: false,
      },
    };

    const finalState = reducePhaseCompletion(sequenceState, "sequence");
    expect(finalState.phase).toBe("final");
    expect(finalState.activeFx).not.toBeNull();

    const idleState = reducePhaseCompletion(finalState, "final");
    expect(idleState.phase).toBe("idle");
    expect(idleState.activeFx).toBeNull();
  });

  test("interaction lock semantics: true in sequence/final, false in idle", () => {
    const base = {
      ...createInitialTurnResolutionFxControllerState(),
      isInitialized: true,
      previousLength: 1,
      activeFx: {
        id: 1,
        result: createResult(),
        timeline: {
          totalMs: 1000,
          sequenceMs: 720,
          finalMs: 280,
          stepMs: 240,
        },
        reducedMotion: false,
      },
    };

    const sequenceState = { ...base, phase: "sequence" as const };
    const finalState = { ...base, phase: "final" as const };
    const idleState = { ...base, phase: "idle" as const, activeFx: null };

    const isLocked = (phase: string, activeFx: unknown) =>
      phase !== "idle" && activeFx !== null;

    expect(isLocked(sequenceState.phase, sequenceState.activeFx)).toBe(true);
    expect(isLocked(finalState.phase, finalState.activeFx)).toBe(true);
    expect(isLocked(idleState.phase, idleState.activeFx)).toBe(false);
  });
});
