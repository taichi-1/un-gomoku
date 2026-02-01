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
});

/** Schema for game.submitCandidates event payload */
export const SubmitCandidatesPayloadSchema = v.object({
  event: v.literal(WS_EVENTS.GAME_SUBMIT_CANDIDATES),
  candidates: v.pipe(v.array(CoordinateSchema), v.minLength(1), v.maxLength(5)),
});

/** Schema for all client messages (variant discriminated by event field) */
export const ClientMessageSchema = v.variant("event", [
  RoomCreatePayloadSchema,
  RoomJoinPayloadSchema,
  SubmitCandidatesPayloadSchema,
]);

// ===== Server -> Client Message Schemas =====

/** Schema for room.created event payload */
export const RoomCreatedPayloadSchema = v.object({
  event: v.literal(WS_EVENTS.ROOM_CREATED),
  roomId: v.string(),
  playerId: PlayerIdSchema,
});

/** Schema for room.joined event payload */
export const RoomJoinedPayloadSchema = v.object({
  event: v.literal(WS_EVENTS.ROOM_JOINED),
  roomId: v.string(),
  playerId: PlayerIdSchema,
});

/** Schema for room.error event payload */
export const RoomErrorPayloadSchema = v.object({
  event: v.literal(WS_EVENTS.ROOM_ERROR),
  message: v.string(),
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
  GameStartPayloadSchema,
  GameStatePayloadSchema,
  GameTurnResultPayloadSchema,
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

/** Client message type (union of all client payloads) */
export type ClientMessage = v.InferOutput<typeof ClientMessageSchema>;

/** Room created payload type */
export type RoomCreatedPayload = v.InferOutput<typeof RoomCreatedPayloadSchema>;

/** Room joined payload type */
export type RoomJoinedPayload = v.InferOutput<typeof RoomJoinedPayloadSchema>;

/** Room error payload type */
export type RoomErrorPayload = v.InferOutput<typeof RoomErrorPayloadSchema>;

/** Game start payload type */
export type GameStartPayload = v.InferOutput<typeof GameStartPayloadSchema>;

/** Game state payload type */
export type GameStatePayload = v.InferOutput<typeof GameStatePayloadSchema>;

/** Game turn result payload type */
export type GameTurnResultPayload = v.InferOutput<
  typeof GameTurnResultPayloadSchema
>;

/** Game error payload type */
export type GameErrorPayload = v.InferOutput<typeof GameErrorPayloadSchema>;

/** Server message type (union of all server payloads) */
export type ServerMessage = v.InferOutput<typeof ServerMessageSchema>;
