import type { PlayerId } from "@pkg/shared/schemas";
import type { Room, WebSocketData } from "../types";
import { ROOM_ID_PATTERN } from "./config";

export function normalizeRoomId(roomId: string): string {
  return roomId.trim().toUpperCase();
}

export function isValidRoomId(roomId: string): boolean {
  return ROOM_ID_PATTERN.test(roomId);
}

export function isWebSocketUpgrade(request: Request): boolean {
  const upgrade = request.headers.get("Upgrade");
  return upgrade?.toLowerCase() === "websocket";
}

export function toPlayerTokenRecord(
  tokens: Map<PlayerId, string>,
): Partial<Record<PlayerId, string>> {
  const record: Partial<Record<PlayerId, string>> = {};
  const player1Token = tokens.get("player1");
  const player2Token = tokens.get("player2");
  if (player1Token) {
    record.player1 = player1Token;
  }
  if (player2Token) {
    record.player2 = player2Token;
  }
  return record;
}

export function getMessageSizeBytes(message: string | ArrayBuffer): number {
  if (typeof message === "string") {
    return new TextEncoder().encode(message).byteLength;
  }
  return message.byteLength;
}

export function getOpponentPlayerId(playerId: PlayerId): PlayerId {
  return playerId === "player1" ? "player2" : "player1";
}

export function createInitialSocketData(): WebSocketData {
  return {
    roomId: null,
    playerId: null,
    playerToken: null,
  };
}

export function startGame(
  room: Room,
  random: () => number = Math.random,
): void {
  const blackPlayer: PlayerId = random() < 0.5 ? "player1" : "player2";
  room.candidateDrafts = { player1: [], player2: [] };
  room.state = {
    ...room.state,
    phase: "playing",
    blackPlayer,
    currentPlayer: blackPlayer,
    winner: null,
    isDraw: false,
  };
}
