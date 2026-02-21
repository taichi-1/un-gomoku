// ===== WebSocket Events =====

/** WebSocket event names for client-server communication */
export const WS_EVENTS = {
  // Client -> Server
  ROOM_CREATE: "room.create",
  ROOM_JOIN: "room.join",
  GAME_UPDATE_CANDIDATE_DRAFT: "game.updateCandidateDraft",
  GAME_SUBMIT_CANDIDATES: "game.submitCandidates",

  // Server -> Client
  ROOM_CREATED: "room.created",
  ROOM_JOINED: "room.joined",
  ROOM_ERROR: "room.error",
  ROOM_OPPONENT_OFFLINE: "room.opponentOffline",
  ROOM_OPPONENT_ONLINE: "room.opponentOnline",
  GAME_START: "game.start",
  GAME_STATE: "game.state",
  GAME_CANDIDATE_DRAFT_UPDATED: "game.candidateDraftUpdated",
  GAME_TURN_RESULT: "game.turnResult",
  GAME_ERROR: "game.error",
} as const;

/** Union type of all WebSocket event values */
export type WsEventType = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];
