import * as v from "valibot";
import { MAX_CANDIDATES } from "../constants";
import { WS_EVENTS } from "../events";
import { GameStateDTOSchema, TurnResultDTOSchema } from "./game";
import { CoordinateSchema, PlayerIdSchema } from "./primitives";

// ===== Client -> Server Message Schemas =====

/** Schema for room.join event payload */
export const RoomJoinPayloadSchema = v.object({
  event: v.literal(WS_EVENTS.ROOM_JOIN),
  roomId: v.pipe(v.string(), v.minLength(1)),
  playerToken: v.optional(v.pipe(v.string(), v.minLength(1))),
});

/** Schema for game.submitCandidates event payload */
export const SubmitCandidatesPayloadSchema = v.object({
  event: v.literal(WS_EVENTS.GAME_SUBMIT_CANDIDATES),
  candidates: v.pipe(
    v.array(CoordinateSchema),
    v.minLength(1),
    v.maxLength(MAX_CANDIDATES),
  ),
});

/** Schema for game.updateCandidateDraft event payload */
export const UpdateCandidateDraftPayloadSchema = v.object({
  event: v.literal(WS_EVENTS.GAME_UPDATE_CANDIDATE_DRAFT),
  candidates: v.pipe(v.array(CoordinateSchema), v.maxLength(MAX_CANDIDATES)),
});

/** Schema for all client messages (variant discriminated by event field) */
export const ClientMessageSchema = v.variant("event", [
  RoomJoinPayloadSchema,
  UpdateCandidateDraftPayloadSchema,
  SubmitCandidatesPayloadSchema,
]);

// ===== Server -> Client Message Schemas =====

/** Schema for room.joined event payload */
export const RoomJoinedPayloadSchema = v.object({
  event: v.literal(WS_EVENTS.ROOM_JOINED),
  roomId: v.string(),
  playerId: PlayerIdSchema,
  playerToken: v.string(),
});

/** Schema for room.error event payload */
export const RoomErrorPayloadSchema = v.object({
  event: v.literal(WS_EVENTS.ROOM_ERROR),
  message: v.string(),
});

/** Schema for room.opponentOffline event payload */
export const RoomOpponentOfflinePayloadSchema = v.object({
  event: v.literal(WS_EVENTS.ROOM_OPPONENT_OFFLINE),
  playerId: PlayerIdSchema,
});

/** Schema for room.opponentOnline event payload */
export const RoomOpponentOnlinePayloadSchema = v.object({
  event: v.literal(WS_EVENTS.ROOM_OPPONENT_ONLINE),
  playerId: PlayerIdSchema,
});

/** Schema for game.start event payload */
export const GameStartPayloadSchema = v.object({
  event: v.literal(WS_EVENTS.GAME_START),
  state: GameStateDTOSchema,
});

/** Schema for game.state event payload */
export const GameStatePayloadSchema = v.object({
  event: v.literal(WS_EVENTS.GAME_STATE),
  state: GameStateDTOSchema,
});

/** Schema for game.candidateDraftUpdated event payload */
export const GameCandidateDraftUpdatedPayloadSchema = v.object({
  event: v.literal(WS_EVENTS.GAME_CANDIDATE_DRAFT_UPDATED),
  playerId: PlayerIdSchema,
  candidates: v.pipe(v.array(CoordinateSchema), v.maxLength(MAX_CANDIDATES)),
});

/** Schema for game.turnResult event payload */
export const GameTurnResultPayloadSchema = v.object({
  event: v.literal(WS_EVENTS.GAME_TURN_RESULT),
  result: TurnResultDTOSchema,
  state: GameStateDTOSchema,
});

/** Schema for game.error event payload */
export const GameErrorPayloadSchema = v.object({
  event: v.literal(WS_EVENTS.GAME_ERROR),
  message: v.string(),
});

/** Schema for all server messages (variant discriminated by event field) */
export const ServerMessageSchema = v.variant("event", [
  RoomJoinedPayloadSchema,
  RoomErrorPayloadSchema,
  RoomOpponentOfflinePayloadSchema,
  RoomOpponentOnlinePayloadSchema,
  GameStartPayloadSchema,
  GameStatePayloadSchema,
  GameCandidateDraftUpdatedPayloadSchema,
  GameTurnResultPayloadSchema,
  GameErrorPayloadSchema,
]);

// ===== Inferred Types =====

/** Room join payload type */
export type RoomJoinPayload = v.InferOutput<typeof RoomJoinPayloadSchema>;

/** Submit candidates payload type */
export type SubmitCandidatesPayload = v.InferOutput<
  typeof SubmitCandidatesPayloadSchema
>;

/** Update candidate draft payload type */
export type UpdateCandidateDraftPayload = v.InferOutput<
  typeof UpdateCandidateDraftPayloadSchema
>;

/** Client message type (union of all client payloads) */
export type ClientMessage = v.InferOutput<typeof ClientMessageSchema>;

/** Room joined payload type */
export type RoomJoinedPayload = v.InferOutput<typeof RoomJoinedPayloadSchema>;

/** Room error payload type */
export type RoomErrorPayload = v.InferOutput<typeof RoomErrorPayloadSchema>;

/** Room opponent offline payload type */
export type RoomOpponentOfflinePayload = v.InferOutput<
  typeof RoomOpponentOfflinePayloadSchema
>;

/** Room opponent online payload type */
export type RoomOpponentOnlinePayload = v.InferOutput<
  typeof RoomOpponentOnlinePayloadSchema
>;

/** Game start payload type */
export type GameStartPayload = v.InferOutput<typeof GameStartPayloadSchema>;

/** Game state payload type */
export type GameStatePayload = v.InferOutput<typeof GameStatePayloadSchema>;

/** Game candidate draft updated payload type */
export type GameCandidateDraftUpdatedPayload = v.InferOutput<
  typeof GameCandidateDraftUpdatedPayloadSchema
>;

/** Game turn result payload type */
export type GameTurnResultPayload = v.InferOutput<
  typeof GameTurnResultPayloadSchema
>;

/** Game error payload type */
export type GameErrorPayload = v.InferOutput<typeof GameErrorPayloadSchema>;

/** Server message type (union of all server payloads) */
export type ServerMessage = v.InferOutput<typeof ServerMessageSchema>;
