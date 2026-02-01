import type { GameStateDTO, PlayerId } from "@pkg/shared/schemas";
import type { ServerWebSocket } from "bun";

export interface WebSocketData {
  roomId: string | null;
  playerId: PlayerId | null;
}

export interface Room {
  id: string;
  players: Map<ServerWebSocket<WebSocketData>, PlayerId>;
  state: GameStateDTO;
}
