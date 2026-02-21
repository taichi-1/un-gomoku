import type { Coordinate, GameStateDTO, PlayerId } from "@pkg/shared/schemas";
import type { ServerWebSocket } from "bun";

export interface WebSocketData {
  roomId: string | null;
  playerId: PlayerId | null;
  playerToken: string | null;
}

export interface Room {
  id: string;
  players: Map<PlayerId, ServerWebSocket<WebSocketData>>;
  state: GameStateDTO;
  candidateDrafts: Record<PlayerId, Coordinate[]>;
  tokens: Map<PlayerId, string>;
  emptyAt: number | null;
}
