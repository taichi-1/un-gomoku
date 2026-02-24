import type { GameStateDTO, PlayerId } from "@pkg/shared/schemas";
import type { GameSocket, Room } from "../types";

export type DurableObjectIdLike = object;

export interface DurableObjectStubLike {
  fetch(request: Request): Promise<Response>;
}

export interface DurableObjectNamespaceLike {
  idFromName(name: string): DurableObjectIdLike;
  get(id: DurableObjectIdLike): DurableObjectStubLike;
}

export interface DurableObjectStorageLike {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<number | boolean>;
  setAlarm(scheduledTime: number | Date): Promise<void>;
  deleteAlarm?: () => Promise<void>;
}

export interface DurableObjectStateLike {
  storage: DurableObjectStorageLike;
  acceptWebSocket(socket: WebSocket): void;
}

export interface WorkerBindings {
  GAME_ROOM: DurableObjectNamespaceLike;
}

export interface WebSocketResponseInit extends ResponseInit {
  webSocket: WebSocket;
}

export interface StoredRoomRecord {
  roomId: string;
  state: GameStateDTO;
  tokens: Partial<Record<PlayerId, string>>;
  updatedAt: number;
  emptyAt: number | null;
  expiresAt: number | null;
}

export interface InitHostPayload {
  roomId: string;
  playerToken: string;
}

export interface CreatedRoomResponse {
  roomId: string;
  playerId: PlayerId;
  playerToken: string;
}

export interface SocketSession {
  socket: GameSocket;
  receivedAt: number[];
}

export interface GameRoomRuntime {
  state: DurableObjectStateLike;
  room: Room;
  sockets: Map<WebSocket, SocketSession>;
  roomExists: boolean;
  expiresAt: number | null;
  updatedAt: number;
}
