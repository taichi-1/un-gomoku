import type { ServerMessage } from "@pkg/shared/schemas";
import type { ServerWebSocket } from "bun";
import type { Room, WebSocketData } from "../types";

export function sendMessage(
  ws: ServerWebSocket<WebSocketData>,
  message: ServerMessage,
): void {
  ws.send(JSON.stringify(message));
}

export function broadcastToRoom(room: Room, message: ServerMessage): void {
  const data = JSON.stringify(message);
  for (const playerWs of room.players.keys()) {
    playerWs.send(data);
  }
}
