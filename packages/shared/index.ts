// ===== Constants =====
export const BOARD_SIZE = 15;
export const MAX_CANDIDATES = 5;
export const WIN_LENGTH = 5;

// Success probability based on number of candidates selected
// 1 position → 50%, 2 → 60%, 3 → 70%, 4 → 80%, 5 → 90%
export const SUCCESS_PROBABILITY: Record<number, number> = {
  1: 0.5,
  2: 0.6,
  3: 0.7,
  4: 0.8,
  5: 0.9,
};

// ===== Types =====
export type PlayerId = "player1" | "player2";

export interface Coordinate {
  x: number;
  y: number;
}

export type CellState = PlayerId | null;

export type BoardState = CellState[][];

export type GamePhase = "waiting" | "playing" | "finished";

export interface GameStateDTO {
  board: BoardState;
  currentPlayer: PlayerId;
  phase: GamePhase;
  winner: PlayerId | null;
  isDraw: boolean;
}

export interface TurnResultDTO {
  success: boolean;
  placedPosition: Coordinate | null;
  candidates: Coordinate[];
  player: PlayerId;
  gameOver: boolean;
  winner: PlayerId | null;
}

// ===== WebSocket Events =====
export const WS_EVENTS = {
  // Client → Server
  ROOM_CREATE: "room.create",
  ROOM_JOIN: "room.join",
  GAME_SUBMIT_CANDIDATES: "game.submitCandidates",

  // Server → Client
  ROOM_CREATED: "room.created",
  ROOM_JOINED: "room.joined",
  ROOM_ERROR: "room.error",
  GAME_START: "game.start",
  GAME_STATE: "game.state",
  GAME_TURN_RESULT: "game.turnResult",
  GAME_ERROR: "game.error",
} as const;

export type WsEventType = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];

// ===== Message Payloads =====
export interface RoomCreatePayload {
  event: typeof WS_EVENTS.ROOM_CREATE;
}

export interface RoomJoinPayload {
  event: typeof WS_EVENTS.ROOM_JOIN;
  roomId: string;
}

export interface SubmitCandidatesPayload {
  event: typeof WS_EVENTS.GAME_SUBMIT_CANDIDATES;
  candidates: Coordinate[];
}

export type ClientMessage =
  | RoomCreatePayload
  | RoomJoinPayload
  | SubmitCandidatesPayload;

export interface RoomCreatedPayload {
  event: typeof WS_EVENTS.ROOM_CREATED;
  roomId: string;
  playerId: PlayerId;
}

export interface RoomJoinedPayload {
  event: typeof WS_EVENTS.ROOM_JOINED;
  roomId: string;
  playerId: PlayerId;
}

export interface RoomErrorPayload {
  event: typeof WS_EVENTS.ROOM_ERROR;
  message: string;
}

export interface GameStartPayload {
  event: typeof WS_EVENTS.GAME_START;
  state: GameStateDTO;
}

export interface GameStatePayload {
  event: typeof WS_EVENTS.GAME_STATE;
  state: GameStateDTO;
}

export interface GameTurnResultPayload {
  event: typeof WS_EVENTS.GAME_TURN_RESULT;
  result: TurnResultDTO;
  state: GameStateDTO;
}

export interface GameErrorPayload {
  event: typeof WS_EVENTS.GAME_ERROR;
  message: string;
}

export type ServerMessage =
  | RoomCreatedPayload
  | RoomJoinedPayload
  | RoomErrorPayload
  | GameStartPayload
  | GameStatePayload
  | GameTurnResultPayload
  | GameErrorPayload;
