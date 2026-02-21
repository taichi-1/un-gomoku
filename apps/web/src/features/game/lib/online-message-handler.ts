import { WS_EVENTS } from "@pkg/shared/events";
import type { ServerMessage } from "@pkg/shared/schemas";
import type { GameSessionSnapshot } from "@/features/game/types/game-session";

export type SnapshotSetter = (
  updater: (current: GameSessionSnapshot) => GameSessionSnapshot,
) => void;

export function applyOnlineServerMessage(
  message: ServerMessage,
  setSnapshot: SnapshotSetter,
): void {
  if (
    message.event === WS_EVENTS.GAME_START ||
    message.event === WS_EVENTS.GAME_STATE
  ) {
    setSnapshot((current) => ({
      ...current,
      gameState: message.state,
      selectedCandidates: [],
      opponentCandidates: [],
      status: message.state.phase === "waiting" ? "waiting" : "connected",
      statusMessage: null,
    }));
    return;
  }

  if (message.event === WS_EVENTS.GAME_CANDIDATE_DRAFT_UPDATED) {
    setSnapshot((current) => {
      // Keep candidate order as received so board numbering follows selection order.
      if (message.playerId === current.myPlayerId) {
        return {
          ...current,
          selectedCandidates: message.candidates,
        };
      }

      return {
        ...current,
        opponentCandidates: message.candidates,
      };
    });
    return;
  }

  if (message.event === WS_EVENTS.GAME_TURN_RESULT) {
    setSnapshot((current) => {
      const failedBySelf =
        !message.result.success && message.result.player === current.myPlayerId;

      return {
        ...current,
        gameState: message.state,
        selectedCandidates: [],
        opponentCandidates: [],
        status: message.result.success
          ? "connected"
          : failedBySelf
            ? "turnFailedSelf"
            : "turnFailedOpponent",
        statusMessage: null,
      };
    });
    return;
  }

  if (message.event === WS_EVENTS.ROOM_OPPONENT_OFFLINE) {
    setSnapshot((current) => ({
      ...current,
      status: "opponentOffline",
      statusMessage: null,
    }));
    return;
  }

  if (message.event === WS_EVENTS.ROOM_OPPONENT_ONLINE) {
    setSnapshot((current) => ({
      ...current,
      status: "opponentOnline",
      statusMessage: null,
    }));
    return;
  }

  if (message.event === WS_EVENTS.GAME_ERROR) {
    setSnapshot((current) => ({
      ...current,
      status: "error",
      statusMessage: message.message,
    }));
  }
}
