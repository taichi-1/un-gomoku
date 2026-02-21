export {
  normalizeCandidates,
  type ProcessTurnContext,
  type ProcessTurnError,
  processTurn,
  type UpdateCandidateDraftContext,
  type UpdateCandidateDraftError,
  updateCandidateDraft,
  validateDraftUpdateContext,
  validateTurnContext,
} from "./game.service";
export {
  type CreateRoomResult,
  createRoom,
  getOpponentPlayerId,
  getRoom,
  type JoinRoomResult,
  joinRoom,
  removePlayer,
  startGame,
  startRoomCleanup,
} from "./room.service";
