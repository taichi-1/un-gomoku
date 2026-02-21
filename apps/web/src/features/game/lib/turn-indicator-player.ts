import type { PlayerId } from "@pkg/shared/schemas";

interface ResolveTurnIndicatorPlayerInput {
  currentPlayer: PlayerId;
  lastTurnPlayer: PlayerId | null;
  hasActiveFx: boolean;
  hasPendingTurnHistorySync: boolean;
}

export function resolveTurnIndicatorPlayer(
  input: ResolveTurnIndicatorPlayerInput,
): PlayerId {
  if (
    (input.hasActiveFx || input.hasPendingTurnHistorySync) &&
    input.lastTurnPlayer
  ) {
    return input.lastTurnPlayer;
  }

  return input.currentPlayer;
}
