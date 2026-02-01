import type { GameStateDTO, PlayerId } from "@pkg/shared/schemas";
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
  tokens: Map<PlayerId, string>;
  pendingUndo: {
    requester: PlayerId;
    requestedAt: number;
  } | null;
  emptyAt: number | null;
}
