import type { Coordinate, GameStateDTO, PlayerId } from "@pkg/shared/schemas";

export interface WebSocketData {
  roomId: string | null;
  playerId: PlayerId | null;
  playerToken: string | null;
}

export interface SocketAttachment {
  roomId: string;
  playerId: PlayerId;
  playerToken: string;
}

export interface GameSocket {
  data: WebSocketData;
  send(data: string): void;
  close?: () => void;
  getAttachment(): SocketAttachment | null;
  setAttachment(attachment: SocketAttachment): void;
  clearAttachment(): void;
}

export interface Room {
  id: string;
  players: Map<PlayerId, GameSocket>;
  state: GameStateDTO;
  candidateDrafts: Record<PlayerId, Coordinate[]>;
  tokens: Map<PlayerId, string>;
  emptyAt: number | null;
}
