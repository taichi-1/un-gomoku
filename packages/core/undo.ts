import type { GameStateDTO, TurnResultDTO } from "@pkg/shared/schemas";
import { removeStone } from "./board";

export type UndoError = "no_history" | "game_finished";

export interface UndoResult {
  ok: boolean;
  error?: UndoError;
  nextState?: GameStateDTO;
}

/**
 * Reverts the last turn from the given state.
 * Only allowed while the game is in the "playing" phase.
 */
export function undoLastTurn(state: GameStateDTO): UndoResult {
  if (state.phase !== "playing") {
    return { ok: false, error: "game_finished" };
  }

  const lastResult = state.turnHistory.at(-1);
  if (!lastResult) {
    return { ok: false, error: "no_history" };
  }

  const trimmedHistory = state.turnHistory.slice(0, -1);
  const nextBoard = resolveUndoBoard(state, lastResult);

  return {
    ok: true,
    nextState: {
      ...state,
      board: nextBoard,
      currentPlayer: lastResult.player,
      phase: "playing",
      winner: null,
      isDraw: false,
      turnHistory: trimmedHistory,
    },
  };
}

function resolveUndoBoard(
  state: GameStateDTO,
  lastResult: TurnResultDTO,
): GameStateDTO["board"] {
  if (!lastResult.success || !lastResult.placedPosition) {
    return state.board;
  }

  return removeStone(state.board, lastResult.placedPosition);
}
