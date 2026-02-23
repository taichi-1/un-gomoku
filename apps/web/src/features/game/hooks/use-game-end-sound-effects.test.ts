import { describe, expect, test } from "bun:test";
import type { TurnResultDTO } from "@pkg/shared/schemas";
import { resolveGameEndSoundPlayKey } from "./use-game-end-sound-effects";

function createTurnResult(overrides?: Partial<TurnResultDTO>): TurnResultDTO {
  return {
    success: true,
    placedPosition: { x: 4, y: 4 },
    candidates: [
      { x: 4, y: 4 },
      { x: 5, y: 4 },
    ],
    player: "player1",
    gameOver: false,
    winner: null,
    ...overrides,
  };
}

describe("use-game-end-sound-effects", () => {
  test("does not play on initial mount equivalent (no false->true transition)", () => {
    const key = resolveGameEndSoundPlayKey({
      previousShowFinishedResult: true,
      showFinishedResult: true,
      gamePhase: "finished",
      turnHistory: [createTurnResult({ gameOver: true, winner: "player1" })],
    });

    expect(key).toBeNull();
  });

  test("plays when showFinishedResult transitions false->true and gameOver is true", () => {
    const key = resolveGameEndSoundPlayKey({
      previousShowFinishedResult: false,
      showFinishedResult: true,
      gamePhase: "finished",
      turnHistory: [createTurnResult({ gameOver: true, winner: "player2" })],
    });

    expect(key).toBe("end:1:player2");
  });

  test("uses draw suffix when winner is null", () => {
    const key = resolveGameEndSoundPlayKey({
      previousShowFinishedResult: false,
      showFinishedResult: true,
      gamePhase: "finished",
      turnHistory: [createTurnResult({ gameOver: true, winner: null })],
    });

    expect(key).toBe("end:1:draw");
  });

  test("stays silent when already visible (true->true)", () => {
    const key = resolveGameEndSoundPlayKey({
      previousShowFinishedResult: true,
      showFinishedResult: true,
      gamePhase: "finished",
      turnHistory: [createTurnResult({ gameOver: true, winner: "player1" })],
    });

    expect(key).toBeNull();
  });

  test("stays silent when game phase is playing", () => {
    const key = resolveGameEndSoundPlayKey({
      previousShowFinishedResult: false,
      showFinishedResult: true,
      gamePhase: "playing",
      turnHistory: [createTurnResult({ gameOver: true, winner: "player1" })],
    });

    expect(key).toBeNull();
  });

  test("stays silent when latest turn is not gameOver", () => {
    const key = resolveGameEndSoundPlayKey({
      previousShowFinishedResult: false,
      showFinishedResult: true,
      gamePhase: "finished",
      turnHistory: [createTurnResult({ gameOver: false, winner: null })],
    });

    expect(key).toBeNull();
  });
});
