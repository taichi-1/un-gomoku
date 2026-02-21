import { resolveTurn } from "@pkg/core/turn";
import { isValidCandidate, validateCandidates } from "@pkg/core/validation";
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
    | "invalid_candidate_position"
    | "duplicate_candidates"
    | "submit_candidates_mismatch";
  message: string;
}

export interface ProcessTurnContext {
  room: Room;
  playerId: PlayerId;
  candidates: Coordinate[];
}

export type UpdateCandidateDraftError = ProcessTurnError;

export interface UpdateCandidateDraftContext {
  room: Room;
  playerId: PlayerId;
  candidates: Coordinate[];
}

function getBaseTurnValidation(
  room: Room | undefined,
  playerId: PlayerId | null,
): ProcessTurnError | { room: Room; playerId: PlayerId } {
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
  return { room, playerId };
}

function hasDuplicateCandidates(candidates: Coordinate[]): boolean {
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const key = `${candidate.x},${candidate.y}`;
    if (seen.has(key)) {
      return true;
    }
    seen.add(key);
  }
  return false;
}

export function normalizeCandidates(candidates: Coordinate[]): Coordinate[] {
  return [...candidates].sort((a, b) => {
    if (a.y !== b.y) {
      return a.y - b.y;
    }
    return a.x - b.x;
  });
}

function areCandidatesEqual(
  left: Coordinate[],
  right: Coordinate[] | undefined,
): boolean {
  if (!right || left.length !== right.length) {
    return false;
  }
  for (let i = 0; i < left.length; i++) {
    const leftCandidate = left[i];
    const rightCandidate = right[i];
    if (!leftCandidate || !rightCandidate) {
      return false;
    }
    if (
      leftCandidate.x !== rightCandidate.x ||
      leftCandidate.y !== rightCandidate.y
    ) {
      return false;
    }
  }
  return true;
}

export function validateTurnContext(
  room: Room | undefined,
  playerId: PlayerId | null,
  candidates: Coordinate[],
): ProcessTurnError | ProcessTurnContext {
  const baseValidation = getBaseTurnValidation(room, playerId);
  if ("kind" in baseValidation) {
    return baseValidation;
  }

  if (hasDuplicateCandidates(candidates)) {
    return {
      kind: "duplicate_candidates",
      message: "Duplicate candidates are not allowed",
    };
  }

  const candidateValidation = validateCandidates(
    baseValidation.room.state.board,
    candidates,
  );
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

  const normalizedCandidates = normalizeCandidates(candidates);
  const latestDraft =
    baseValidation.room.candidateDrafts[baseValidation.playerId];
  const normalizedLatestDraft = latestDraft
    ? normalizeCandidates(latestDraft)
    : undefined;
  if (!areCandidatesEqual(normalizedCandidates, normalizedLatestDraft)) {
    return {
      kind: "submit_candidates_mismatch",
      message: "Submit candidates do not match latest draft",
    };
  }

  return { ...baseValidation, candidates };
}

export function validateDraftUpdateContext(
  room: Room | undefined,
  playerId: PlayerId | null,
  candidates: Coordinate[],
): UpdateCandidateDraftError | UpdateCandidateDraftContext {
  const baseValidation = getBaseTurnValidation(room, playerId);
  if ("kind" in baseValidation) {
    return baseValidation;
  }

  if (candidates.length > MAX_CANDIDATES) {
    return {
      kind: "invalid_candidate_count",
      message: `Must select 0-${MAX_CANDIDATES} candidates`,
    };
  }

  if (hasDuplicateCandidates(candidates)) {
    return {
      kind: "duplicate_candidates",
      message: "Duplicate candidates are not allowed",
    };
  }

  for (const candidate of candidates) {
    if (!isValidCandidate(baseValidation.room.state.board, candidate)) {
      return {
        kind: "invalid_candidate_position",
        message: "Invalid candidate position",
      };
    }
  }

  return {
    ...baseValidation,
    candidates,
  };
}

export function updateCandidateDraft(ctx: UpdateCandidateDraftContext): void {
  const { room, playerId, candidates } = ctx;
  room.candidateDrafts[playerId] = candidates;
  broadcastToRoom(room, {
    event: WS_EVENTS.GAME_CANDIDATE_DRAFT_UPDATED,
    playerId,
    candidates,
  });
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
  room.candidateDrafts.player1 = [];
  room.candidateDrafts.player2 = [];
  broadcastToRoom(room, {
    event: WS_EVENTS.GAME_TURN_RESULT,
    result,
    state: room.state,
  });
}
