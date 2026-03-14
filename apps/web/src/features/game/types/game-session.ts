import type { Coordinate, GameStateDTO, PlayerId } from "@pkg/shared/schemas";
import type { CpuDifficulty, CpuPersona } from "@/features/game/lib/cpu";

export type GameMode = "local" | "online" | "cpu";

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
  | "disconnected"
  | "cpuThinking";

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
  cpuInfo?: { difficulty: CpuDifficulty; persona: CpuPersona };
}

export interface GameController {
  snapshot: GameSessionSnapshot;
  canInteract: boolean;
  setCandidateSelection: (coord: Coordinate, shouldSelect: boolean) => void;
  submitCandidates: () => void;
  rematch?: () => void | Promise<void>;
}
