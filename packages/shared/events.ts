// ===== WebSocket Events =====

/** WebSocket event names for client-server communication */
export const WS_EVENTS = {
  // Client -> Server
  ROOM_CREATE: "room.create",
  ROOM_JOIN: "room.join",
  GAME_SUBMIT_CANDIDATES: "game.submitCandidates",
  GAME_UNDO_REQUEST: "game.undo.request",
  GAME_UNDO_ACCEPT: "game.undo.accept",
  GAME_UNDO_REJECT: "game.undo.reject",

  // Server -> Client
  ROOM_CREATED: "room.created",
  ROOM_JOINED: "room.joined",
  ROOM_ERROR: "room.error",
  ROOM_OPPONENT_OFFLINE: "room.opponentOffline",
  ROOM_OPPONENT_ONLINE: "room.opponentOnline",
  GAME_START: "game.start",
  GAME_STATE: "game.state",
  GAME_TURN_RESULT: "game.turnResult",
  GAME_UNDO_PENDING: "game.undo.pending",
  GAME_UNDO_APPLIED: "game.undo.applied",
  GAME_UNDO_REJECTED: "game.undo.rejected",
  GAME_ERROR: "game.error",
} as const;

/** Union type of all WebSocket event values */
export type WsEventType = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];
