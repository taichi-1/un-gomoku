import { createInitialGameState, getNextPlayer } from "@pkg/core/game-state";
import type { PlayerId } from "@pkg/shared/schemas";
import type { ServerWebSocket } from "bun";
import type { Room, WebSocketData } from "../types";
import { generatePlayerToken, generateRoomId } from "../utils";

const rooms = new Map<string, Room>();
const ROOM_TTL_MS = 10 * 60 * 1000;

function cleanupRooms(now: number = Date.now()): void {
  for (const [roomId, room] of rooms.entries()) {
    if (room.emptyAt && now - room.emptyAt >= ROOM_TTL_MS) {
      rooms.delete(roomId);
    }
  }
}

export function startRoomCleanup(intervalMs = 60 * 1000): () => void {
  const timer = setInterval(() => cleanupRooms(), intervalMs);
  if ("unref" in timer && typeof timer.unref === "function") {
    timer.unref();
  }
  return () => clearInterval(timer);
}

export function getRoom(roomId: string): Room | undefined {
  cleanupRooms();
  return rooms.get(roomId);
}

export interface CreateRoomResult {
  roomId: string;
  playerId: PlayerId;
  playerToken: string;
}

export function createRoom(
  ws: ServerWebSocket<WebSocketData>,
): CreateRoomResult {
  cleanupRooms();
  const roomId = generateRoomId();
  const playerToken = generatePlayerToken();
  const room: Room = {
    id: roomId,
    players: new Map([["player1", ws]]),
    state: createInitialGameState(),
    candidateDrafts: { player1: [], player2: [] },
    tokens: new Map([["player1", playerToken]]),
    emptyAt: null,
  };
  rooms.set(roomId, room);

  ws.data.roomId = roomId;
  ws.data.playerId = "player1";
  ws.data.playerToken = playerToken;

  return { roomId, playerId: "player1", playerToken };
}

export type JoinRoomResult =
  | {
      success: true;
      room: Room;
      playerId: PlayerId;
      playerToken: string;
      isReconnect: boolean;
    }
  | {
      success: false;
      error: "Room not found" | "Room is full" | "Invalid token";
    };

export function joinRoom(
  ws: ServerWebSocket<WebSocketData>,
  roomId: string,
  playerToken?: string,
): JoinRoomResult {
  cleanupRooms();
  const room = rooms.get(roomId);
  if (!room) {
    return { success: false, error: "Room not found" };
  }

  if (playerToken) {
    const matchedEntry = [...room.tokens.entries()].find(
      ([, token]) => token === playerToken,
    );
    const playerId = matchedEntry?.[0];
    if (!playerId) {
      return { success: false, error: "Invalid token" };
    }
    const existingWs = room.players.get(playerId);
    if (existingWs && existingWs !== ws) {
      // Prefer the latest connection for the same player token.
      existingWs.data.roomId = null;
      existingWs.data.playerId = null;
      existingWs.data.playerToken = null;
      if ("close" in existingWs && typeof existingWs.close === "function") {
        existingWs.close();
      }
    }

    room.players.set(playerId, ws);
    ws.data.roomId = roomId;
    ws.data.playerId = playerId;
    ws.data.playerToken = playerToken;
    room.emptyAt = null;
    return {
      success: true,
      room,
      playerId,
      playerToken,
      isReconnect: true,
    };
  }

  if (room.players.size >= 2) {
    return { success: false, error: "Room is full" };
  }
  if (room.tokens.has("player2")) {
    return { success: false, error: "Room is full" };
  }

  const newToken = generatePlayerToken();
  room.tokens.set("player2", newToken);
  room.players.set("player2", ws);
  ws.data.roomId = roomId;
  ws.data.playerId = "player2";
  ws.data.playerToken = newToken;
  room.emptyAt = null;

  return {
    success: true,
    room,
    playerId: "player2",
    playerToken: newToken,
    isReconnect: false,
  };
}

export function removePlayer(
  ws: ServerWebSocket<WebSocketData>,
): { room: Room; playerId: PlayerId } | null {
  const { roomId, playerId } = ws.data;
  if (!roomId || !playerId) return null;

  const room = rooms.get(roomId);
  if (room) {
    const currentWs = room.players.get(playerId);
    if (currentWs === ws) {
      room.players.delete(playerId);
      if (room.players.size === 0) {
        room.emptyAt = Date.now();
      }
    }
  }

  ws.data.roomId = null;
  ws.data.playerId = null;
  ws.data.playerToken = null;

  return room ? { room, playerId } : null;
}

export function startGame(
  room: Room,
  random: () => number = Math.random,
): void {
  const startingPlayer = random() < 0.5 ? "player1" : "player2";
  room.candidateDrafts = { player1: [], player2: [] };
  room.state = {
    ...room.state,
    phase: "playing",
    currentPlayer: startingPlayer,
    winner: null,
    isDraw: false,
  };
}

export function getOpponentPlayerId(playerId: PlayerId): PlayerId {
  return getNextPlayer(playerId);
}
