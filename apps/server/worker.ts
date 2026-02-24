import { Hono } from "hono";
import { handleDisconnect } from "./handlers";
import { createInitialSocketData, handleWebSocketMessage } from "./server";
import { startRoomCleanup } from "./services";
import type { GameSocket } from "./types";

type DurableObjectIdLike = object;

interface DurableObjectStubLike {
  fetch(request: Request): Promise<Response>;
}

interface DurableObjectNamespaceLike {
  idFromName(name: string): DurableObjectIdLike;
  get(id: DurableObjectIdLike): DurableObjectStubLike;
}

interface DurableObjectStateLike {
  acceptWebSocket(socket: WebSocket): void;
}

interface WorkerBindings {
  GAME_SERVER: DurableObjectNamespaceLike;
}

interface WebSocketResponseInit extends ResponseInit {
  webSocket: WebSocket;
}

declare const WebSocketPair: {
  new (): { 0: WebSocket; 1: WebSocket };
};

const app = new Hono<{ Bindings: WorkerBindings }>();

function isWebSocketUpgrade(request: Request): boolean {
  const upgrade = request.headers.get("Upgrade");
  return upgrade?.toLowerCase() === "websocket";
}

app.get("/", (c) => c.text("un-gomoku worker"));

app.get("/healthz", (c) => c.text("ok"));

app.get("/ws", async (c) => {
  if (!isWebSocketUpgrade(c.req.raw)) {
    return c.text("Expected websocket upgrade", 426);
  }

  const id = c.env.GAME_SERVER.idFromName("global");
  const stub = c.env.GAME_SERVER.get(id);
  return stub.fetch(c.req.raw);
});

export class GameServerDurableObject {
  private readonly sockets = new Map<WebSocket, GameSocket>();

  constructor(private readonly state: DurableObjectStateLike) {
    startRoomCleanup();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/ws") {
      return new Response("Not found", { status: 404 });
    }
    if (!isWebSocketUpgrade(request)) {
      return new Response("Expected websocket upgrade", { status: 426 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.state.acceptWebSocket(server);
    this.sockets.set(server, this.createSocketAdapter(server));

    return new Response(null, {
      status: 101,
      webSocket: client,
    } as WebSocketResponseInit);
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    const socket = this.sockets.get(ws);
    if (!socket) {
      return;
    }
    handleWebSocketMessage(socket, message);
  }

  webSocketClose(ws: WebSocket): void {
    this.handleSocketClosed(ws);
  }

  webSocketError(ws: WebSocket): void {
    this.handleSocketClosed(ws);
  }

  private handleSocketClosed(ws: WebSocket): void {
    const socket = this.sockets.get(ws);
    if (!socket) {
      return;
    }
    handleDisconnect(socket);
    this.sockets.delete(ws);
  }

  private createSocketAdapter(ws: WebSocket): GameSocket {
    return {
      data: createInitialSocketData(),
      send: (data: string) => {
        ws.send(data);
      },
      close: () => {
        ws.close();
      },
    };
  }
}

export default app;
