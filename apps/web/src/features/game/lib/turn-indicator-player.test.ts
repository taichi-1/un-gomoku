import { describe, expect, test } from "bun:test";
import { resolveTurnIndicatorPlayer } from "./turn-indicator-player";

describe("resolveTurnIndicatorPlayer", () => {
  test("keeps previous player while turn-history sync is pending", () => {
    expect(
      resolveTurnIndicatorPlayer({
        currentPlayer: "player2",
        lastTurnPlayer: "player1",
        hasActiveFx: false,
        hasPendingTurnHistorySync: true,
      }),
    ).toBe("player1");
  });

  test("keeps previous player while fx is active", () => {
    expect(
      resolveTurnIndicatorPlayer({
        currentPlayer: "player2",
        lastTurnPlayer: "player1",
        hasActiveFx: true,
        hasPendingTurnHistorySync: false,
      }),
    ).toBe("player1");
  });

  test("shows current player after fx completes", () => {
    expect(
      resolveTurnIndicatorPlayer({
        currentPlayer: "player2",
        lastTurnPlayer: "player1",
        hasActiveFx: false,
        hasPendingTurnHistorySync: false,
      }),
    ).toBe("player2");
  });
});
