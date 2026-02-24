import { describe, expect, test } from "bun:test";
import { createInitialGameState } from "@pkg/core/game-state";
import type { GameSessionSnapshot } from "@/features/game/types/game-session";
import { createInitialOnlineSnapshot } from "../lib/online-session";
import { resolveTurnIndicatorDisplay } from "./turn-indicator";

function createTranslate() {
  return (key: string, options?: Record<string, unknown>): string => {
    const player = options?.player;
    if (typeof player === "string") {
      return `${key}:${player}`;
    }
    return key;
  };
}

function createBaseOnlineSnapshot(): GameSessionSnapshot {
  return {
    ...createInitialOnlineSnapshot("ROOM01"),
    myPlayerId: "player1",
    gameState: {
      ...createInitialGameState(),
      phase: "playing",
      currentPlayer: "player1",
    },
  };
}

describe("resolveTurnIndicatorDisplay", () => {
  test("prioritizes connecting state in online mode", () => {
    const snapshot = createBaseOnlineSnapshot();
    snapshot.status = "connecting";

    const result = resolveTurnIndicatorDisplay({
      snapshot,
      showFinishedResult: false,
      displayPlayerId: "player1",
      t: createTranslate(),
    });

    expect(result).toEqual({
      label: "status.connecting",
      indicatorStonePlayer: null,
    });
  });

  test("prioritizes statusMessage for online error state", () => {
    const snapshot = createBaseOnlineSnapshot();
    snapshot.status = "error";
    snapshot.statusMessage = "Rate limit exceeded";

    const result = resolveTurnIndicatorDisplay({
      snapshot,
      showFinishedResult: false,
      displayPlayerId: "player1",
      t: createTranslate(),
    });

    expect(result).toEqual({
      label: "Rate limit exceeded",
      indicatorStonePlayer: null,
    });
  });

  test("uses disconnected status label when statusMessage is empty", () => {
    const snapshot = createBaseOnlineSnapshot();
    snapshot.status = "disconnected";
    snapshot.statusMessage = null;

    const result = resolveTurnIndicatorDisplay({
      snapshot,
      showFinishedResult: false,
      displayPlayerId: "player1",
      t: createTranslate(),
    });

    expect(result).toEqual({
      label: "status.disconnected",
      indicatorStonePlayer: null,
    });
  });

  test("keeps local turn label behavior", () => {
    const snapshot: GameSessionSnapshot = {
      ...createBaseOnlineSnapshot(),
      mode: "local",
      status: "connected",
      statusMessage: null,
    };

    const result = resolveTurnIndicatorDisplay({
      snapshot,
      showFinishedResult: false,
      displayPlayerId: "player2",
      t: createTranslate(),
    });

    expect(result).toEqual({
      label: "common.playerTurn:common.player.player2",
      indicatorStonePlayer: "player2",
    });
  });
});
