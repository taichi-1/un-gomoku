import { resolveTurn } from "@pkg/core/turn";
import { undoLastTurn } from "@pkg/core/undo";
import { validateCandidates } from "@pkg/core/validation";
import { MAX_CANDIDATES } from "@pkg/shared/constants";
import { WS_EVENTS } from "@pkg/shared/events";
import type { RandomFn } from "@pkg/shared/random";
import type { Coordinate, GameStateDTO, PlayerId } from "@pkg/shared/schemas";
import type { Room } from "../types";
import { broadcastToRoom } from "../utils";

export interface ProcessTurnError {
  kind:
    | "not_in_room"
    | "room_not_found"
    | "game_not_in_progress"
    | "not_your_turn"
    | "undo_pending"
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
  if (room.pendingUndo) {
    return {
      kind: "undo_pending",
      message: "Undo request pending",
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
  const nextHistory = [...room.state.turnHistory, result];
  room.state = {
    ...nextState,
    turnHistory: nextHistory,
  };
  broadcastToRoom(room, {
    event: WS_EVENTS.GAME_TURN_RESULT,
    result,
    state: room.state,
  });
}

export interface UndoError {
  kind:
    | "not_in_room"
    | "room_not_found"
    | "game_not_in_progress"
    | "no_history"
    | "undo_pending"
    | "not_your_turn";
  message: string;
}

export interface UndoContext {
  room: Room;
  requester: PlayerId;
}

export interface UndoApplyContext extends UndoContext {
  nextState: GameStateDTO;
}

function validateUndoRequest(
  room: Room | undefined,
  playerId: PlayerId | null,
): UndoError | UndoContext {
  if (!room) {
    return { kind: "room_not_found", message: "Room not found" };
  }
  if (!playerId) {
    return { kind: "not_in_room", message: "Not in a room" };
  }
  if (room.state.phase !== "playing") {
    return { kind: "game_not_in_progress", message: "Game not in progress" };
  }
  if (room.pendingUndo) {
    return { kind: "undo_pending", message: "Undo request pending" };
  }
  if (room.state.turnHistory.length === 0) {
    return { kind: "no_history", message: "No history to undo" };
  }
  return { room, requester: playerId };
}

export function requestUndo(
  room: Room | undefined,
  playerId: PlayerId | null,
): UndoError | UndoContext {
  const validation = validateUndoRequest(room, playerId);
  if ("kind" in validation) {
    return validation;
  }
  validation.room.pendingUndo = {
    requester: validation.requester,
    requestedAt: Date.now(),
  };
  return validation;
}

export function acceptUndo(
  room: Room | undefined,
  playerId: PlayerId | null,
): UndoError | UndoApplyContext {
  if (!room) {
    return { kind: "room_not_found", message: "Room not found" };
  }
  if (!playerId) {
    return { kind: "not_in_room", message: "Not in a room" };
  }
  if (room.state.phase !== "playing") {
    return { kind: "game_not_in_progress", message: "Game not in progress" };
  }
  if (!room.pendingUndo) {
    return { kind: "no_history", message: "No undo request" };
  }
  const requester = room.pendingUndo.requester;
  if (requester === playerId) {
    return { kind: "not_your_turn", message: "Cannot accept your own request" };
  }

  const undoResult = undoLastTurn(room.state);
  if (!undoResult.ok || !undoResult.nextState) {
    return { kind: "no_history", message: "No history to undo" };
  }

  room.pendingUndo = null;
  room.state = undoResult.nextState;
  return { room, requester, nextState: room.state };
}

export function rejectUndo(
  room: Room | undefined,
  playerId: PlayerId | null,
): UndoError | UndoContext {
  if (!room) {
    return { kind: "room_not_found", message: "Room not found" };
  }
  if (!playerId) {
    return { kind: "not_in_room", message: "Not in a room" };
  }
  if (room.state.phase !== "playing") {
    return { kind: "game_not_in_progress", message: "Game not in progress" };
  }
  if (!room.pendingUndo) {
    return { kind: "no_history", message: "No undo request" };
  }
  if (room.pendingUndo.requester === playerId) {
    return { kind: "not_your_turn", message: "Cannot reject your own request" };
  }
  const requester = room.pendingUndo.requester;
  room.pendingUndo = null;
  return { room, requester };
}
