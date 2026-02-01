import { WS_EVENTS } from "@pkg/shared/events";
import type { ServerWebSocket } from "bun";
import { createRoom, joinRoom, removePlayer } from "../services";
import type { WebSocketData } from "../types";
import { broadcastToRoom, sendMessage } from "../utils";

export function handleRoomCreate(ws: ServerWebSocket<WebSocketData>): void {
  const { roomId, playerId } = createRoom(ws);
  sendMessage(ws, {
    event: WS_EVENTS.ROOM_CREATED,
    roomId,
    playerId,
  });
}

export function handleRoomJoin(
  ws: ServerWebSocket<WebSocketData>,
  roomId: string,
): void {
  const result = joinRoom(ws, roomId);
  if (!result.success) {
    sendMessage(ws, {
      event: WS_EVENTS.ROOM_ERROR,
      message: result.error,
    });
    return;
  }
  sendMessage(ws, {
    event: WS_EVENTS.ROOM_JOINED,
    roomId,
    playerId: result.playerId,
  });
  result.room.state.phase = "playing";
  broadcastToRoom(result.room, {
    event: WS_EVENTS.GAME_START,
    state: result.room.state,
  });
}

export function handleDisconnect(ws: ServerWebSocket<WebSocketData>): void {
  removePlayer(ws);
}
