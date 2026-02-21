import { createInitialGameState } from "@pkg/core/game-state";
import type { GameSessionSnapshot } from "@/features/game/types/game-session";
import { buildRoomShareUrl } from "@/lib/ws-endpoint";

export function createInitialOnlineSnapshot(
  roomId: string,
): GameSessionSnapshot {
  return {
    mode: "online",
    roomId,
    shareUrl: buildRoomShareUrl(roomId),
    myPlayerId: null,
    gameState: createInitialGameState(),
    selectedCandidates: [],
    opponentCandidates: [],
    status: "connecting",
    statusMessage: null,
  };
}

export function canInteractOnlineSnapshot(
  snapshot: GameSessionSnapshot,
): boolean {
  if (snapshot.status === "disconnected" || snapshot.status === "connecting") {
    return false;
  }
  return (
    snapshot.gameState.phase === "playing" &&
    snapshot.myPlayerId === snapshot.gameState.currentPlayer
  );
}

export function normalizeRoomId(roomId: string): string {
  return roomId.trim().toUpperCase();
}
