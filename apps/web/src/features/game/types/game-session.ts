import type { Coordinate, GameStateDTO, PlayerId } from "@pkg/shared/schemas";

export type GameMode = "local" | "online";

export type GameSessionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "waiting"
  | "opponentOffline"
  | "opponentOnline"
  | "turnFailedSelf"
  | "turnFailedOpponent"
  | "error"
  | "disconnected";

export interface GameSessionSnapshot {
  mode: GameMode;
  roomId: string | null;
  shareUrl: string | null;
  myPlayerId: PlayerId | null;
  gameState: GameStateDTO;
  selectedCandidates: Coordinate[];
  opponentCandidates: Coordinate[];
  status: GameSessionStatus;
  statusMessage: string | null;
}

export interface GameController {
  snapshot: GameSessionSnapshot;
  canInteract: boolean;
  setCandidateSelection: (coord: Coordinate, shouldSelect: boolean) => void;
  submitCandidates: () => void;
}
