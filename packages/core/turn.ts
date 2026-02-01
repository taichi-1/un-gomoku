import {
  calculateSuccess,
  type RandomFn,
  selectRandomCandidate,
} from "@pkg/shared/random";
import type {
  Coordinate,
  GameStateDTO,
  PlayerId,
  TurnResultDTO,
} from "@pkg/shared/schemas";
import { placeStone } from "./board";
import { getNextPlayer, isBoardFull } from "./game-state";
import { checkWinAt } from "./win-detection";

export interface TurnResolution {
  nextState: GameStateDTO;
  result: TurnResultDTO;
}

/**
 * Resolves a single turn and returns the updated state and turn result.
 * Assumes candidates are already validated and the turn is allowed.
 */
export function resolveTurn(
  state: GameStateDTO,
  playerId: PlayerId,
  candidates: Coordinate[],
  random: RandomFn = Math.random,
): TurnResolution {
  const success = calculateSuccess(candidates.length, random);

  if (!success) {
    return {
      nextState: {
        ...state,
        currentPlayer: getNextPlayer(playerId),
      },
      result: {
        success: false,
        placedPosition: null,
        candidates,
        player: playerId,
        gameOver: false,
        winner: null,
      },
    };
  }

  const placedPosition = selectRandomCandidate(candidates, random);
  const updatedBoard = placeStone(state.board, placedPosition, playerId);

  if (checkWinAt(updatedBoard, placedPosition, playerId)) {
    return {
      nextState: {
        ...state,
        board: updatedBoard,
        phase: "finished",
        winner: playerId,
        isDraw: false,
      },
      result: {
        success: true,
        placedPosition,
        candidates,
        player: playerId,
        gameOver: true,
        winner: playerId,
      },
    };
  }

  if (isBoardFull(updatedBoard)) {
    return {
      nextState: {
        ...state,
        board: updatedBoard,
        phase: "finished",
        winner: null,
        isDraw: true,
      },
      result: {
        success: true,
        placedPosition,
        candidates,
        player: playerId,
        gameOver: true,
        winner: null,
      },
    };
  }

  return {
    nextState: {
      ...state,
      board: updatedBoard,
      currentPlayer: getNextPlayer(playerId),
      winner: null,
      isDraw: false,
    },
    result: {
      success: true,
      placedPosition,
      candidates,
      player: playerId,
      gameOver: false,
      winner: null,
    },
  };
}
