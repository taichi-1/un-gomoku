import { describe, expect, test } from "bun:test";
import { placeStone } from "@pkg/core/board";
import { resolveTurn } from "@pkg/core/turn";
import { isEmpty } from "@pkg/core/validation";
import { checkWinAt } from "@pkg/core/win-detection";
import { BOARD_SIZE, MAX_CANDIDATES } from "@pkg/shared/constants";
import type { Coordinate, GameStateDTO } from "@pkg/shared/schemas";
import {
  createHitRandomAt,
  createHitRandomAvoiding,
  createMissRandom,
  createOpponentTurn1,
  createOpponentTurn2,
  createScriptedRandom,
  createStepRandom,
  createTutorialGameState,
  getPhaseStep,
  getSubmitBlock,
  isSelectableInStep,
  resolveSettledPhase,
  rollForCandidateIndex,
  TUTORIAL_PRESET_BLACK,
  TUTORIAL_PRESET_WHITE,
  TUTORIAL_WIN_CELL,
} from "./tutorial-script";

function cellAt(state: GameStateDTO, coord: Coordinate) {
  return state.board[coord.y]?.[coord.x];
}

describe("createTutorialGameState", () => {
  test("places the preset stones and starts black's turn", () => {
    const state = createTutorialGameState();

    expect(state.phase).toBe("playing");
    expect(state.currentPlayer).toBe("player1");
    expect(state.blackPlayer).toBe("player1");
    expect(state.turnHistory).toHaveLength(0);

    for (const coord of TUTORIAL_PRESET_BLACK) {
      expect(cellAt(state, coord)).toBe("player1");
    }
    for (const coord of TUTORIAL_PRESET_WHITE) {
      expect(cellAt(state, coord)).toBe("player2");
    }
  });

  test("the win cell is the only cell that completes five for black", () => {
    const state = createTutorialGameState();
    const winningCells: Coordinate[] = [];

    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        const coord = { x, y };
        if (!isEmpty(state.board, coord)) continue;
        const board = placeStone(state.board, coord, "player1");
        if (checkWinAt(board, coord, "player1")) {
          winningCells.push(coord);
        }
      }
    }

    expect(winningCells).toEqual([TUTORIAL_WIN_CELL]);
  });
});

describe("scripted rolls", () => {
  test("rollForCandidateIndex maps back to the same index", () => {
    for (let count = 1; count <= MAX_CANDIDATES; count++) {
      for (let index = 0; index < count; index++) {
        const roll = rollForCandidateIndex(index, count);
        expect(roll).toBeGreaterThanOrEqual(0);
        expect(roll).toBeLessThan(1);
        expect(Math.floor(roll * count)).toBe(index);
      }
    }
  });

  test("createScriptedRandom throws once exhausted", () => {
    const random = createScriptedRandom([0.5]);
    expect(random()).toBe(0.5);
    expect(() => random()).toThrow("exhausted");
  });

  test("createMissRandom fails for every candidate count", () => {
    const state = createTutorialGameState();
    for (let count = 1; count <= MAX_CANDIDATES; count++) {
      const candidates = Array.from({ length: count }, (_, i) => ({
        x: i,
        y: 0,
      }));
      const { result, nextState } = resolveTurn(
        state,
        "player1",
        candidates,
        createMissRandom(),
      );
      expect(result.success).toBe(false);
      expect(result.placedPosition).toBeNull();
      expect(nextState.currentPlayer).toBe("player2");
    }
  });

  test("createHitRandomAt lands on the target at any position", () => {
    const state = createTutorialGameState();
    const fillers: Coordinate[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ];

    for (let position = 0; position < MAX_CANDIDATES; position++) {
      const candidates = [...fillers];
      candidates.splice(position, 0, TUTORIAL_WIN_CELL);
      const { result } = resolveTurn(
        state,
        "player1",
        candidates,
        createHitRandomAt(candidates, TUTORIAL_WIN_CELL),
      );
      expect(result.success).toBe(true);
      expect(result.placedPosition).toEqual(TUTORIAL_WIN_CELL);
      expect(result.gameOver).toBe(true);
      expect(result.winner).toBe("player1");
    }
  });

  test("createHitRandomAt rejects a missing target", () => {
    expect(() =>
      createHitRandomAt([{ x: 0, y: 0 }], TUTORIAL_WIN_CELL),
    ).toThrow();
  });

  test("createHitRandomAvoiding never lands on the avoided cell nor wins", () => {
    const state = createTutorialGameState();
    const candidates: Coordinate[] = [
      TUTORIAL_WIN_CELL,
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
      { x: 2, y: 3 },
    ];
    const { result } = resolveTurn(
      state,
      "player1",
      candidates,
      createHitRandomAvoiding(candidates, TUTORIAL_WIN_CELL),
    );
    expect(result.success).toBe(true);
    expect(result.placedPosition).not.toEqual(TUTORIAL_WIN_CELL);
    expect(result.gameOver).toBe(false);
  });

  test("createHitRandomAvoiding works with the avoided cell in any slot", () => {
    for (let position = 0; position < 2; position++) {
      const other = { x: 0, y: 0 };
      const candidates =
        position === 0
          ? [TUTORIAL_WIN_CELL, other]
          : [other, TUTORIAL_WIN_CELL];
      const state = createTutorialGameState();
      const { result } = resolveTurn(
        state,
        "player1",
        candidates,
        createHitRandomAvoiding(candidates, TUTORIAL_WIN_CELL),
      );
      expect(result.placedPosition).toEqual(other);
    }
  });

  test("createHitRandomAvoiding rejects an all-avoided selection", () => {
    expect(() =>
      createHitRandomAvoiding([TUTORIAL_WIN_CELL], TUTORIAL_WIN_CELL),
    ).toThrow();
  });
});

describe("step gating", () => {
  const other: Coordinate = { x: 0, y: 0 };

  test("step 1 only allows the win cell", () => {
    expect(isSelectableInStep("step1", TUTORIAL_WIN_CELL)).toBe(true);
    expect(isSelectableInStep("step1", other)).toBe(false);
    expect(isSelectableInStep("step2", other)).toBe(true);
    expect(isSelectableInStep("step3", other)).toBe(true);
  });

  test("step 2 requires five candidates including the win cell", () => {
    const four = [TUTORIAL_WIN_CELL, other, { x: 1, y: 0 }, { x: 2, y: 0 }];
    expect(getSubmitBlock("step2", four)).toBe("needFive");

    const fiveWithoutWin = [
      other,
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
    ];
    expect(getSubmitBlock("step2", fiveWithoutWin)).toBe("needWinCell");

    const fiveWithWin = [...fiveWithoutWin.slice(0, 4), TUTORIAL_WIN_CELL];
    expect(getSubmitBlock("step2", fiveWithWin)).toBeNull();
  });

  test("steps 1 and 3 require only the win cell", () => {
    expect(getSubmitBlock("step1", [TUTORIAL_WIN_CELL])).toBeNull();
    expect(getSubmitBlock("step3", [other])).toBe("needWinCell");
    expect(getSubmitBlock("step3", [other, TUTORIAL_WIN_CELL])).toBeNull();
    expect(getSubmitBlock("step3", [TUTORIAL_WIN_CELL])).toBeNull();
  });

  test("phase helpers", () => {
    expect(getPhaseStep("step1")).toBe("step1");
    expect(getPhaseStep("white1")).toBeNull();
    expect(getPhaseStep("intro")).toBeNull();

    expect(resolveSettledPhase("step1", 0)).toBe("step1");
    expect(resolveSettledPhase("step1", 1)).toBe("step1Fail");
    expect(resolveSettledPhase("white1", 2)).toBe("step2");
    expect(resolveSettledPhase("step2", 3)).toBe("step2Success");
    expect(resolveSettledPhase("white2", 4)).toBe("step3");
    expect(resolveSettledPhase("step3", 5)).toBe("done");
    expect(resolveSettledPhase("intro", 0)).toBe("intro");
  });
});

describe("full scripted run", () => {
  test("plays out exactly as scripted and black wins at the win cell", () => {
    let state = createTutorialGameState();

    // Step 1: aim at the win cell alone — guaranteed miss.
    const step1 = resolveTurn(
      state,
      "player1",
      [TUTORIAL_WIN_CELL],
      createStepRandom("step1", [TUTORIAL_WIN_CELL]),
    );
    expect(step1.result.success).toBe(false);
    state = {
      ...step1.nextState,
      turnHistory: [...state.turnHistory, step1.result],
    };
    expect(state.currentPlayer).toBe("player2");

    // Opponent turn 1: aims at the win cell, lands on its own row.
    const opponent1 = createOpponentTurn1();
    for (const coord of opponent1.candidates) {
      expect(isEmpty(state.board, coord)).toBe(true);
    }
    const white1 = resolveTurn(
      state,
      "player2",
      opponent1.candidates,
      createScriptedRandom(opponent1.rolls),
    );
    expect(white1.result.success).toBe(true);
    expect(white1.result.placedPosition).toEqual({ x: 11, y: 5 });
    expect(white1.result.gameOver).toBe(false);
    state = {
      ...white1.nextState,
      turnHistory: [...state.turnHistory, white1.result],
    };

    // Step 2: five candidates including the win cell — hit, but not the aim.
    const step2Candidates: Coordinate[] = [
      TUTORIAL_WIN_CELL,
      { x: 2, y: 10 },
      { x: 3, y: 10 },
      { x: 12, y: 5 },
      { x: 2, y: 11 },
    ];
    expect(getSubmitBlock("step2", step2Candidates)).toBeNull();
    const step2 = resolveTurn(
      state,
      "player1",
      step2Candidates,
      createStepRandom("step2", step2Candidates),
    );
    expect(step2.result.success).toBe(true);
    expect(step2.result.placedPosition).not.toEqual(TUTORIAL_WIN_CELL);
    expect(step2.result.gameOver).toBe(false);
    state = {
      ...step2.nextState,
      turnHistory: [...state.turnHistory, step2.result],
    };

    // Opponent turn 2: candidates are still-empty cells, guaranteed miss.
    // The learner's step-2 stone occupies (12,5) here, exercising the backup list.
    const opponent2 = createOpponentTurn2(state.board);
    expect(opponent2.candidates.length).toBeGreaterThanOrEqual(1);
    for (const coord of opponent2.candidates) {
      expect(isEmpty(state.board, coord)).toBe(true);
    }
    const white2 = resolveTurn(
      state,
      "player2",
      opponent2.candidates,
      createScriptedRandom(opponent2.rolls),
    );
    expect(white2.result.success).toBe(false);
    state = {
      ...white2.nextState,
      turnHistory: [...state.turnHistory, white2.result],
    };

    // Step 3: any selection that includes the win cell — guaranteed win.
    const step3Candidates: Coordinate[] = [
      { x: 1, y: 1 },
      TUTORIAL_WIN_CELL,
      { x: 13, y: 13 },
    ];
    const step3 = resolveTurn(
      state,
      "player1",
      step3Candidates,
      createStepRandom("step3", step3Candidates),
    );
    expect(step3.result.success).toBe(true);
    expect(step3.result.placedPosition).toEqual(TUTORIAL_WIN_CELL);
    expect(step3.result.gameOver).toBe(true);
    expect(step3.result.winner).toBe("player1");
    expect(step3.nextState.phase).toBe("finished");
    expect(step3.nextState.winner).toBe("player1");
  });

  test("opponent turn 2 falls back across occupied backup cells", () => {
    const base = createTutorialGameState();
    let board = placeStone(base.board, { x: 12, y: 5 }, "player1");
    board = placeStone(board, { x: 8, y: 5 }, "player1");
    board = placeStone(board, { x: 12, y: 6 }, "player1");

    const turn = createOpponentTurn2(board);
    expect(turn.candidates[0]).toEqual(TUTORIAL_WIN_CELL);
    expect(turn.candidates[1]).toEqual({ x: 3, y: 4 });
  });
});
