import { describe, expect, test } from "bun:test";
import { placeStone } from "@pkg/core/board";
import { createInitialGameState } from "@pkg/core/game-state";
import type { BoardState, Coordinate, PlayerId } from "@pkg/shared/schemas";
import { CPU_CONFIGS, CPU_PERSONA_CONFIGS } from "./config";
import { computeBestMove } from "./expectiminimax";

function createConfig(persona: keyof typeof CPU_PERSONA_CONFIGS) {
  return {
    ...CPU_CONFIGS.medium,
    ...CPU_PERSONA_CONFIGS[persona],
    evaluationNoise: 0,
    searchDepth: 1,
  };
}

function createBoard(
  placements: Array<{ coord: Coordinate; player: PlayerId }>,
): BoardState {
  let board = createInitialGameState().board;
  for (const { coord, player } of placements) {
    board = placeStone(board, coord, player);
  }
  return board;
}

describe("computeBestMove persona behavior", () => {
  test("opening picks multiple centered candidates for every persona", () => {
    const board = createInitialGameState().board;

    for (const persona of ["attacker", "defender", "gambler"] as const) {
      const result = computeBestMove(board, "player1", createConfig(persona));
      expect(result.candidates.length).toBeGreaterThan(1);
      expect(result.candidates[0]).toEqual({ x: 7, y: 7 });
    }
  });

  test("gambler does not default to a single candidate in neutral positions", () => {
    const board = createBoard([
      { coord: { x: 7, y: 7 }, player: "player1" },
      { coord: { x: 8, y: 7 }, player: "player2" },
      { coord: { x: 7, y: 8 }, player: "player1" },
      { coord: { x: 8, y: 8 }, player: "player2" },
    ]);

    expect(
      computeBestMove(board, "player1", createConfig("gambler")).candidates
        .length,
    ).toBeGreaterThan(1);
  });

  test("gambler narrows when there is an immediate winning move", () => {
    const board = createBoard([
      { coord: { x: 3, y: 7 }, player: "player1" },
      { coord: { x: 4, y: 7 }, player: "player1" },
      { coord: { x: 5, y: 7 }, player: "player1" },
      { coord: { x: 6, y: 7 }, player: "player1" },
      { coord: { x: 9, y: 9 }, player: "player2" },
    ]);

    const result = computeBestMove(board, "player1", createConfig("gambler"));
    expect(result.candidates.length).toBeLessThanOrEqual(2);
    expect(result.candidates).toContainEqual({ x: 2, y: 7 });
  });

  test("defender narrows to reliable blocks against an immediate loss", () => {
    const board = createBoard([
      { coord: { x: 3, y: 7 }, player: "player2" },
      { coord: { x: 4, y: 7 }, player: "player2" },
      { coord: { x: 5, y: 7 }, player: "player2" },
      { coord: { x: 6, y: 7 }, player: "player2" },
      { coord: { x: 7, y: 6 }, player: "player1" },
    ]);

    const result = computeBestMove(board, "player1", createConfig("defender"));
    expect(result.candidates.length).toBeLessThanOrEqual(2);
    expect(result.candidates).toContainEqual({ x: 2, y: 7 });
  });

  test("attacker prioritizes a broken-four reach shape", () => {
    const board = createBoard([
      { coord: { x: 5, y: 7 }, player: "player1" },
      { coord: { x: 6, y: 7 }, player: "player1" },
      { coord: { x: 8, y: 7 }, player: "player1" },
      { coord: { x: 3, y: 3 }, player: "player2" },
      { coord: { x: 4, y: 3 }, player: "player2" },
    ]);

    const result = computeBestMove(board, "player1", createConfig("attacker"));
    expect(result.candidates[0]).toEqual({ x: 7, y: 7 });
  });
});
