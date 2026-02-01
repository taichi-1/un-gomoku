import { placeStone } from "@pkg/core/board";
import { getNextPlayer, isBoardFull } from "@pkg/core/game-state";
import { isValidCandidate } from "@pkg/core/validation";
import { checkWinAt } from "@pkg/core/win-detection";
import { MAX_CANDIDATES } from "@pkg/shared/constants";
import { WS_EVENTS } from "@pkg/shared/events";
import type { Coordinate, PlayerId } from "@pkg/shared/schemas";
import type { Room } from "../types";
import {
  broadcastToRoom,
  calculateSuccess,
  type RandomFn,
  selectRandomCandidate,
} from "../utils";

export interface ProcessTurnError {
  kind:
    | "not_in_room"
    | "room_not_found"
    | "game_not_in_progress"
    | "not_your_turn"
    | "invalid_candidate_count"
    | "invalid_candidate_position";
  message: string;
}

export interface ProcessTurnContext {
  room: Room;
  playerId: PlayerId;
  candidates: Coordinate[];
}

export function validateTurnContext(
  room: Room | undefined,
  playerId: PlayerId | null,
  candidates: Coordinate[],
): ProcessTurnError | ProcessTurnContext {
  if (!room) {
    return {
      kind: "room_not_found",
      message: "Room not found",
    };
  }
  if (!playerId) {
    return {
      kind: "not_in_room",
      message: "Not in a room",
    };
  }
  if (room.state.phase !== "playing") {
    return {
      kind: "game_not_in_progress",
      message: "Game not in progress",
    };
  }
  if (room.state.currentPlayer !== playerId) {
    return {
      kind: "not_your_turn",
      message: "Not your turn",
    };
  }
  if (candidates.length < 1 || candidates.length > MAX_CANDIDATES) {
    return {
      kind: "invalid_candidate_count",
      message: `Must select 1-${MAX_CANDIDATES} candidates`,
    };
  }
  for (const coord of candidates) {
    if (!isValidCandidate(room.state.board, coord)) {
      return {
        kind: "invalid_candidate_position",
        message: "Invalid candidate position",
      };
    }
  }
  return { room, playerId, candidates };
}

export function processTurn(
  ctx: ProcessTurnContext,
  random: RandomFn = Math.random,
): void {
  const { room, playerId, candidates } = ctx;
  const success = calculateSuccess(candidates.length, random);

  if (success) {
    const placedPosition = selectRandomCandidate(candidates, random);
    room.state.board = placeStone(room.state.board, placedPosition, playerId);

    if (checkWinAt(room.state.board, placedPosition, playerId)) {
      room.state.phase = "finished";
      room.state.winner = playerId;
      broadcastToRoom(room, {
        event: WS_EVENTS.GAME_TURN_RESULT,
        result: {
          success: true,
          placedPosition,
          candidates,
          player: playerId,
          gameOver: true,
          winner: playerId,
        },
        state: room.state,
      });
      return;
    }

    if (isBoardFull(room.state.board)) {
      room.state.phase = "finished";
      room.state.isDraw = true;
      broadcastToRoom(room, {
        event: WS_EVENTS.GAME_TURN_RESULT,
        result: {
          success: true,
          placedPosition,
          candidates,
          player: playerId,
          gameOver: true,
          winner: null,
        },
        state: room.state,
      });
      return;
    }

    room.state.currentPlayer = getNextPlayer(playerId);
    broadcastToRoom(room, {
      event: WS_EVENTS.GAME_TURN_RESULT,
      result: {
        success: true,
        placedPosition,
        candidates,
        player: playerId,
        gameOver: false,
        winner: null,
      },
      state: room.state,
    });
  } else {
    room.state.currentPlayer = getNextPlayer(playerId);
    broadcastToRoom(room, {
      event: WS_EVENTS.GAME_TURN_RESULT,
      result: {
        success: false,
        placedPosition: null,
        candidates,
        player: playerId,
        gameOver: false,
        winner: null,
      },
      state: room.state,
    });
  }
}
