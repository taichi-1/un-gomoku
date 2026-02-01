import * as v from "valibot";
import { WS_EVENTS } from "../events";
import { GameStateDTOSchema, TurnResultDTOSchema } from "./game";
import { CoordinateSchema, PlayerIdSchema } from "./primitives";

// ===== Client -> Server Message Schemas =====

/** Schema for room.create event payload */
export const RoomCreatePayloadSchema = v.object({
  event: v.literal(WS_EVENTS.ROOM_CREATE),
});

/** Schema for room.join event payload */
export const RoomJoinPayloadSchema = v.object({
  event: v.literal(WS_EVENTS.ROOM_JOIN),
  roomId: v.pipe(v.string(), v.minLength(1)),
  playerToken: v.optional(v.pipe(v.string(), v.minLength(1))),
});

/** Schema for game.submitCandidates event payload */
export const SubmitCandidatesPayloadSchema = v.object({
  event: v.literal(WS_EVENTS.GAME_SUBMIT_CANDIDATES),
  candidates: v.pipe(v.array(CoordinateSchema), v.minLength(1), v.maxLength(5)),
});

/** Schema for game.undo.request event payload */
export const UndoRequestPayloadSchema = v.object({
  event: v.literal(WS_EVENTS.GAME_UNDO_REQUEST),
});

/** Schema for game.undo.accept event payload */
export const UndoAcceptPayloadSchema = v.object({
  event: v.literal(WS_EVENTS.GAME_UNDO_ACCEPT),
});

/** Schema for game.undo.reject event payload */
export const UndoRejectPayloadSchema = v.object({
  event: v.literal(WS_EVENTS.GAME_UNDO_REJECT),
});

/** Schema for all client messages (variant discriminated by event field) */
export const ClientMessageSchema = v.variant("event", [
  RoomCreatePayloadSchema,
  RoomJoinPayloadSchema,
  SubmitCandidatesPayloadSchema,
  UndoRequestPayloadSchema,
  UndoAcceptPayloadSchema,
  UndoRejectPayloadSchema,
]);

// ===== Server -> Client Message Schemas =====

/** Schema for room.created event payload */
export const RoomCreatedPayloadSchema = v.object({
  event: v.literal(WS_EVENTS.ROOM_CREATED),
  roomId: v.string(),
  playerId: PlayerIdSchema,
  playerToken: v.string(),
});

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

/** Schema for game.turnResult event payload */
export const GameTurnResultPayloadSchema = v.object({
  event: v.literal(WS_EVENTS.GAME_TURN_RESULT),
  result: TurnResultDTOSchema,
  state: GameStateDTOSchema,
});

/** Schema for game.undo.pending event payload */
export const GameUndoPendingPayloadSchema = v.object({
  event: v.literal(WS_EVENTS.GAME_UNDO_PENDING),
  requester: PlayerIdSchema,
});

/** Schema for game.undo.applied event payload */
export const GameUndoAppliedPayloadSchema = v.object({
  event: v.literal(WS_EVENTS.GAME_UNDO_APPLIED),
  state: GameStateDTOSchema,
});

/** Schema for game.undo.rejected event payload */
export const GameUndoRejectedPayloadSchema = v.object({
  event: v.literal(WS_EVENTS.GAME_UNDO_REJECTED),
  requester: PlayerIdSchema,
});

/** Schema for game.error event payload */
export const GameErrorPayloadSchema = v.object({
  event: v.literal(WS_EVENTS.GAME_ERROR),
  message: v.string(),
});

/** Schema for all server messages (variant discriminated by event field) */
export const ServerMessageSchema = v.variant("event", [
  RoomCreatedPayloadSchema,
  RoomJoinedPayloadSchema,
  RoomErrorPayloadSchema,
  RoomOpponentOfflinePayloadSchema,
  RoomOpponentOnlinePayloadSchema,
  GameStartPayloadSchema,
  GameStatePayloadSchema,
  GameTurnResultPayloadSchema,
  GameUndoPendingPayloadSchema,
  GameUndoAppliedPayloadSchema,
  GameUndoRejectedPayloadSchema,
  GameErrorPayloadSchema,
]);

// ===== Inferred Types =====

/** Room create payload type */
export type RoomCreatePayload = v.InferOutput<typeof RoomCreatePayloadSchema>;

/** Room join payload type */
export type RoomJoinPayload = v.InferOutput<typeof RoomJoinPayloadSchema>;

/** Submit candidates payload type */
export type SubmitCandidatesPayload = v.InferOutput<
  typeof SubmitCandidatesPayloadSchema
>;

/** Undo request payload type */
export type UndoRequestPayload = v.InferOutput<typeof UndoRequestPayloadSchema>;

/** Undo accept payload type */
export type UndoAcceptPayload = v.InferOutput<typeof UndoAcceptPayloadSchema>;

/** Undo reject payload type */
export type UndoRejectPayload = v.InferOutput<typeof UndoRejectPayloadSchema>;

/** Client message type (union of all client payloads) */
export type ClientMessage = v.InferOutput<typeof ClientMessageSchema>;

/** Room created payload type */
export type RoomCreatedPayload = v.InferOutput<typeof RoomCreatedPayloadSchema>;

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

/** Game turn result payload type */
export type GameTurnResultPayload = v.InferOutput<
  typeof GameTurnResultPayloadSchema
>;

/** Game undo pending payload type */
export type GameUndoPendingPayload = v.InferOutput<
  typeof GameUndoPendingPayloadSchema
>;

/** Game undo applied payload type */
export type GameUndoAppliedPayload = v.InferOutput<
  typeof GameUndoAppliedPayloadSchema
>;

/** Game undo rejected payload type */
export type GameUndoRejectedPayload = v.InferOutput<
  typeof GameUndoRejectedPayloadSchema
>;

/** Game error payload type */
export type GameErrorPayload = v.InferOutput<typeof GameErrorPayloadSchema>;

/** Server message type (union of all server payloads) */
export type ServerMessage = v.InferOutput<typeof ServerMessageSchema>;
