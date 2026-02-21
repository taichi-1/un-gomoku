import { describe, expect, test } from "bun:test";
import { WS_EVENTS } from "@pkg/shared/events";
import type { GameSessionSnapshot } from "@/features/game/types/game-session";
import { applyOnlineServerMessage } from "./online-message-handler";
import { createInitialOnlineSnapshot } from "./online-session";

function createBaseSnapshot(): GameSessionSnapshot {
  return {
    ...createInitialOnlineSnapshot("ROOM01"),
    myPlayerId: "player1",
  };
}

describe("applyOnlineServerMessage", () => {
  test("keeps selectedCandidates in received order", () => {
    let snapshot = createBaseSnapshot();

    applyOnlineServerMessage(
      {
        event: WS_EVENTS.GAME_CANDIDATE_DRAFT_UPDATED,
        playerId: "player1",
        candidates: [
          { x: 3, y: 3 },
          { x: 1, y: 1 },
          { x: 2, y: 2 },
        ],
      },
      (updater) => {
        snapshot = updater(snapshot);
      },
    );

    expect(snapshot.selectedCandidates).toEqual([
      { x: 3, y: 3 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ]);
  });

  test("keeps opponentCandidates in received order", () => {
    let snapshot = createBaseSnapshot();

    applyOnlineServerMessage(
      {
        event: WS_EVENTS.GAME_CANDIDATE_DRAFT_UPDATED,
        playerId: "player2",
        candidates: [
          { x: 4, y: 4 },
          { x: 0, y: 0 },
        ],
      },
      (updater) => {
        snapshot = updater(snapshot);
      },
    );

    expect(snapshot.opponentCandidates).toEqual([
      { x: 4, y: 4 },
      { x: 0, y: 0 },
    ]);
  });
});
