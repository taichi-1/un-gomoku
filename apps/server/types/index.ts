import type { Coordinate, GameStateDTO, PlayerId } from "@pkg/shared/schemas";

export interface WebSocketData {
  roomId: string | null;
  playerId: PlayerId | null;
  playerToken: string | null;
}

export interface GameSocket {
  data: WebSocketData;
  send(data: string): void;
  close?: () => void;
}

export interface Room {
  id: string;
  players: Map<PlayerId, GameSocket>;
  state: GameStateDTO;
  candidateDrafts: Record<PlayerId, Coordinate[]>;
  tokens: Map<PlayerId, string>;
  emptyAt: number | null;
}
