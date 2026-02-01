import { createInitialGameState } from "@pkg/core/game-state";
import type { PlayerId } from "@pkg/shared/schemas";
import type { ServerWebSocket } from "bun";
import type { Room, WebSocketData } from "../types";
import { generateRoomId } from "../utils";

const rooms = new Map<string, Room>();

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export interface CreateRoomResult {
  roomId: string;
  playerId: PlayerId;
}

export function createRoom(
  ws: ServerWebSocket<WebSocketData>,
): CreateRoomResult {
  const roomId = generateRoomId();
  const room: Room = {
    id: roomId,
    players: new Map(),
    state: createInitialGameState(),
  };
  room.players.set(ws, "player1");
  rooms.set(roomId, room);

  ws.data.roomId = roomId;
  ws.data.playerId = "player1";

  return { roomId, playerId: "player1" };
}

export type JoinRoomResult =
  | { success: true; room: Room; playerId: PlayerId }
  | { success: false; error: "Room not found" | "Room is full" };

export function joinRoom(
  ws: ServerWebSocket<WebSocketData>,
  roomId: string,
): JoinRoomResult {
  const room = rooms.get(roomId);
  if (!room) {
    return { success: false, error: "Room not found" };
  }
  if (room.players.size >= 2) {
    return { success: false, error: "Room is full" };
  }

  room.players.set(ws, "player2");
  ws.data.roomId = roomId;
  ws.data.playerId = "player2";

  return { success: true, room, playerId: "player2" };
}

export function removePlayer(ws: ServerWebSocket<WebSocketData>): void {
  const { roomId } = ws.data;
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (room) {
    room.players.delete(ws);
    if (room.players.size === 0) {
      rooms.delete(roomId);
    }
  }
}
