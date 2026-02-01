import { resolveTurn } from "@pkg/core/turn";
import { validateCandidates } from "@pkg/core/validation";
import { MAX_CANDIDATES } from "@pkg/shared/constants";
import { WS_EVENTS } from "@pkg/shared/events";
import type { RandomFn } from "@pkg/shared/random";
import type { Coordinate, PlayerId } from "@pkg/shared/schemas";
import type { Room } from "../types";
import { broadcastToRoom } from "../utils";

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
  const candidateValidation = validateCandidates(room.state.board, candidates);
  if (!candidateValidation.ok) {
    if (candidateValidation.error === "invalid_candidate_count") {
      return {
        kind: "invalid_candidate_count",
        message: `Must select 1-${MAX_CANDIDATES} candidates`,
      };
    }
    return {
      kind: "invalid_candidate_position",
      message: "Invalid candidate position",
    };
  }
  return { room, playerId, candidates };
}

export function processTurn(
  ctx: ProcessTurnContext,
  random: RandomFn = Math.random,
): void {
  const { room, playerId, candidates } = ctx;
  const { nextState, result } = resolveTurn(
    room.state,
    playerId,
    candidates,
    random,
  );
  room.state = nextState;
  broadcastToRoom(room, {
    event: WS_EVENTS.GAME_TURN_RESULT,
    result,
    state: room.state,
  });
}
