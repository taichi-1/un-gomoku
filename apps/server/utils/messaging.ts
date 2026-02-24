import type { ServerMessage } from "@pkg/shared/schemas";
import type { GameSocket, Room, WebSocketData } from "../types";

export function sendMessage(ws: GameSocket, message: ServerMessage): void {
  ws.send(JSON.stringify(message));
}

export function broadcastToRoom(room: Room, message: ServerMessage): void {
  const data = JSON.stringify(message);
  for (const playerWs of room.players.values()) {
    playerWs.send(data);
  }
}

export function broadcastToRoomExcept(
  room: Room,
  excludedPlayerId: WebSocketData["playerId"],
  message: ServerMessage,
): void {
  if (!excludedPlayerId) return;
  const data = JSON.stringify(message);
  for (const [playerId, playerWs] of room.players.entries()) {
    if (playerId === excludedPlayerId) continue;
    playerWs.send(data);
  }
}
