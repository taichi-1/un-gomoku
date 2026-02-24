import { createInitialGameState } from "@pkg/core/game-state";
import type { Room } from "../types";
import {
  createSocketAdapter,
  handleInitHost,
  handleSocketClosed,
  handleSocketMessage,
} from "./room-socket-handlers";
import { rehydrateRoomSockets } from "./room-socket-recovery";
import { handleAlarm, restoreFromStorage } from "./room-storage";
import {
  isValidRoomId,
  isWebSocketUpgrade,
  normalizeRoomId,
} from "./room-utils";
import type {
  DurableObjectStateLike,
  GameRoomRuntime,
  WebSocketResponseInit,
} from "./runtime-types";

declare const WebSocketPair: {
  new (): { 0: WebSocket; 1: WebSocket };
};

function createInitialRoom(): Room {
  return {
    id: "",
    players: new Map(),
    state: createInitialGameState(),
    candidateDrafts: { player1: [], player2: [] },
    tokens: new Map(),
    emptyAt: null,
  };
}

export class GameRoomDurableObject {
  private readonly runtime: GameRoomRuntime;
  private readonly loaded: Promise<void>;

  constructor(private readonly state: DurableObjectStateLike) {
    const runtime: GameRoomRuntime = {
      state,
      room: createInitialRoom(),
      sockets: new Map(),
      roomExists: false,
      expiresAt: null,
      updatedAt: Date.now(),
    };
    this.runtime = runtime;
    this.loaded = (async () => {
      await restoreFromStorage(runtime);
      const sockets = this.state.getWebSockets?.() ?? [];
      rehydrateRoomSockets(runtime, sockets);
    })();
  }

  async fetch(request: Request): Promise<Response> {
    await this.loaded;
    const url = new URL(request.url);

    if (url.pathname === "/internal/init-host") {
      return handleInitHost(this.runtime, request);
    }

    if (!url.pathname.startsWith("/ws/")) {
      return new Response("Not found", { status: 404 });
    }

    const roomId = normalizeRoomId(url.pathname.slice(4));
    if (!isValidRoomId(roomId)) {
      return new Response("Invalid room id", { status: 400 });
    }
    if (this.runtime.room.id && this.runtime.room.id !== roomId) {
      return new Response("Room mismatch", { status: 409 });
    }
    if (!this.runtime.room.id) {
      this.runtime.room.id = roomId;
    }

    if (!isWebSocketUpgrade(request)) {
      return new Response("Expected websocket upgrade", { status: 426 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.state.acceptWebSocket(server);
    this.runtime.sockets.set(server, {
      socket: createSocketAdapter(server),
      receivedAt: [],
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    } as WebSocketResponseInit);
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    void handleSocketMessage(this.runtime, ws, message);
  }

  webSocketClose(ws: WebSocket): void {
    void handleSocketClosed(this.runtime, ws);
  }

  webSocketError(ws: WebSocket): void {
    void handleSocketClosed(this.runtime, ws);
  }

  async alarm(): Promise<void> {
    await this.loaded;
    await handleAlarm(this.runtime);
  }
}
