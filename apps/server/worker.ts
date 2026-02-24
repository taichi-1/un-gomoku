import { createInitialGameState } from "@pkg/core/game-state";
import { WS_EVENTS } from "@pkg/shared/events";
import {
  type Coordinate,
  type GameStateDTO,
  type PlayerId,
  parseClientMessage,
} from "@pkg/shared/schemas";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  processTurn,
  updateCandidateDraft,
  validateDraftUpdateContext,
  validateTurnContext,
} from "./services/game.service";
import type { GameSocket, Room, WebSocketData } from "./types";
import { generatePlayerToken, generateRoomId, sendMessage } from "./utils";

const ROOM_ID_PATTERN = /^[A-Z0-9]{6}$/;
const ROOM_STORAGE_KEY = "room:v1";
const ROOM_TTL_MS = 30 * 60 * 1000;
const MAX_ROOM_CREATE_ATTEMPTS = 5;
const MAX_MESSAGE_BYTES = 8 * 1024;
const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_COUNT = 30;

type DurableObjectIdLike = object;

interface DurableObjectStubLike {
  fetch(request: Request): Promise<Response>;
}

interface DurableObjectNamespaceLike {
  idFromName(name: string): DurableObjectIdLike;
  get(id: DurableObjectIdLike): DurableObjectStubLike;
}

interface DurableObjectStorageLike {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<number | boolean>;
  setAlarm(scheduledTime: number | Date): Promise<void>;
  deleteAlarm?: () => Promise<void>;
}

interface DurableObjectStateLike {
  storage: DurableObjectStorageLike;
  acceptWebSocket(socket: WebSocket): void;
}

interface WorkerBindings {
  GAME_ROOM: DurableObjectNamespaceLike;
}

interface WebSocketResponseInit extends ResponseInit {
  webSocket: WebSocket;
}

interface StoredRoomRecord {
  roomId: string;
  state: GameStateDTO;
  tokens: Partial<Record<PlayerId, string>>;
  updatedAt: number;
  emptyAt: number | null;
  expiresAt: number | null;
}

interface InitHostPayload {
  roomId: string;
  playerToken: string;
}

interface CreatedRoomResponse {
  roomId: string;
  playerId: PlayerId;
  playerToken: string;
}

interface SocketSession {
  socket: GameSocket;
  receivedAt: number[];
}

declare const WebSocketPair: {
  new (): { 0: WebSocket; 1: WebSocket };
};

const app = new Hono<{ Bindings: WorkerBindings }>();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

function normalizeRoomId(roomId: string): string {
  return roomId.trim().toUpperCase();
}

function isValidRoomId(roomId: string): boolean {
  return ROOM_ID_PATTERN.test(roomId);
}

function isWebSocketUpgrade(request: Request): boolean {
  const upgrade = request.headers.get("Upgrade");
  return upgrade?.toLowerCase() === "websocket";
}

function toPlayerTokenRecord(
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

function getMessageSizeBytes(message: string | ArrayBuffer): number {
  if (typeof message === "string") {
    return new TextEncoder().encode(message).byteLength;
  }
  return message.byteLength;
}

function createInitialSocketData(): WebSocketData {
  return {
    roomId: null,
    playerId: null,
    playerToken: null,
  };
}

function logEvent(params: {
  event: string;
  roomId: string;
  playerId: string | null;
  result: "ok" | "error";
  errorCode?: string | null;
}): void {
  console.log(
    JSON.stringify({
      event: params.event,
      roomId: params.roomId,
      playerId: params.playerId,
      result: params.result,
      errorCode: params.errorCode ?? null,
    }),
  );
}

function isInitHostPayload(value: unknown): value is InitHostPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.roomId === "string" &&
    typeof payload.playerToken === "string" &&
    payload.playerToken.length > 0
  );
}

function isCreatedRoomResponse(value: unknown): value is CreatedRoomResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const response = value as Record<string, unknown>;
  return (
    typeof response.roomId === "string" &&
    (response.playerId === "player1" || response.playerId === "player2") &&
    typeof response.playerToken === "string"
  );
}

function getOpponentPlayerId(playerId: PlayerId): PlayerId {
  return playerId === "player1" ? "player2" : "player1";
}

function startGame(room: Room, random: () => number = Math.random): void {
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

app.get("/healthz", (c) =>
  c.json({
    ok: true,
  }),
);

app.post("/rooms", async (c) => {
  for (let attempt = 0; attempt < MAX_ROOM_CREATE_ATTEMPTS; attempt++) {
    const roomId = generateRoomId();
    const playerToken = generatePlayerToken();

    const doId = c.env.GAME_ROOM.idFromName(roomId);
    const stub = c.env.GAME_ROOM.get(doId);

    const initRequest = new Request(
      "https://room.internal/internal/init-host",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          playerToken,
        }),
      },
    );

    const initResponse = await stub.fetch(initRequest);
    if (initResponse.status === 409) {
      continue;
    }
    if (!initResponse.ok) {
      logEvent({
        event: "room.create",
        roomId,
        playerId: null,
        result: "error",
        errorCode: "create_failed",
      });
      return c.json({ message: "Could not create room" }, 503);
    }

    let json: unknown;
    try {
      json = await initResponse.json();
    } catch {
      logEvent({
        event: "room.create",
        roomId,
        playerId: null,
        result: "error",
        errorCode: "invalid_init_response",
      });
      return c.json({ message: "Could not create room" }, 503);
    }

    if (!isCreatedRoomResponse(json)) {
      logEvent({
        event: "room.create",
        roomId,
        playerId: null,
        result: "error",
        errorCode: "invalid_payload",
      });
      return c.json({ message: "Could not create room" }, 503);
    }

    logEvent({
      event: "room.create",
      roomId,
      playerId: json.playerId,
      result: "ok",
    });
    return c.json(json);
  }

  return c.json({ message: "Could not create room" }, 503);
});

app.get("/ws/:roomId", async (c) => {
  if (!isWebSocketUpgrade(c.req.raw)) {
    return c.text("Expected websocket upgrade", 426);
  }
  const roomId = normalizeRoomId(c.req.param("roomId"));
  if (!isValidRoomId(roomId)) {
    return c.text("Invalid room id", 400);
  }

  const doId = c.env.GAME_ROOM.idFromName(roomId);
  const stub = c.env.GAME_ROOM.get(doId);
  return stub.fetch(c.req.raw);
});

export class GameRoomDurableObject {
  private readonly room: Room = {
    id: "",
    players: new Map(),
    state: createInitialGameState(),
    candidateDrafts: { player1: [], player2: [] },
    tokens: new Map(),
    emptyAt: null,
  };

  private roomExists = false;
  private expiresAt: number | null = null;
  private updatedAt: number = Date.now();
  private readonly sockets = new Map<WebSocket, SocketSession>();
  private readonly loaded: Promise<void>;

  constructor(private readonly state: DurableObjectStateLike) {
    this.loaded = this.restoreFromStorage();
  }

  async fetch(request: Request): Promise<Response> {
    await this.loaded;
    const url = new URL(request.url);

    if (url.pathname === "/internal/init-host") {
      return this.handleInitHost(request);
    }

    if (!url.pathname.startsWith("/ws/")) {
      return new Response("Not found", { status: 404 });
    }

    const roomId = normalizeRoomId(url.pathname.slice(4));
    if (!isValidRoomId(roomId)) {
      return new Response("Invalid room id", { status: 400 });
    }
    if (this.room.id && this.room.id !== roomId) {
      return new Response("Room mismatch", { status: 409 });
    }
    if (!this.room.id) {
      this.room.id = roomId;
    }

    if (!isWebSocketUpgrade(request)) {
      return new Response("Expected websocket upgrade", { status: 426 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.state.acceptWebSocket(server);
    this.sockets.set(server, {
      socket: this.createSocketAdapter(server),
      receivedAt: [],
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    } as WebSocketResponseInit);
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    void this.handleSocketMessage(ws, message);
  }

  webSocketClose(ws: WebSocket): void {
    void this.handleSocketClosed(ws);
  }

  webSocketError(ws: WebSocket): void {
    void this.handleSocketClosed(ws);
  }

  async alarm(): Promise<void> {
    await this.loaded;

    if (!this.roomExists || this.room.players.size > 0 || !this.expiresAt) {
      return;
    }
    if (Date.now() < this.expiresAt) {
      await this.state.storage.setAlarm(this.expiresAt);
      return;
    }

    const expiredRoomId = this.room.id;
    await this.clearRoomState();
    logEvent({
      event: "room.expired",
      roomId: expiredRoomId,
      playerId: null,
      result: "ok",
    });
  }

  private async restoreFromStorage(): Promise<void> {
    const stored =
      await this.state.storage.get<StoredRoomRecord>(ROOM_STORAGE_KEY);
    if (!stored) {
      return;
    }
    if (stored.expiresAt && stored.expiresAt <= Date.now()) {
      await this.state.storage.delete(ROOM_STORAGE_KEY);
      return;
    }

    this.room.id = stored.roomId;
    this.room.state = stored.state;
    this.room.tokens.clear();
    if (stored.tokens.player1) {
      this.room.tokens.set("player1", stored.tokens.player1);
    }
    if (stored.tokens.player2) {
      this.room.tokens.set("player2", stored.tokens.player2);
    }
    this.room.candidateDrafts = { player1: [], player2: [] };
    this.room.emptyAt = stored.emptyAt;
    this.updatedAt = stored.updatedAt;
    this.expiresAt = stored.expiresAt;
    this.roomExists = true;
  }

  private async persistRoomState(): Promise<void> {
    if (!this.roomExists || !this.room.id) {
      return;
    }

    this.updatedAt = Date.now();
    const record: StoredRoomRecord = {
      roomId: this.room.id,
      state: this.room.state,
      tokens: toPlayerTokenRecord(this.room.tokens),
      updatedAt: this.updatedAt,
      emptyAt: this.room.emptyAt,
      expiresAt: this.expiresAt,
    };
    await this.state.storage.put(ROOM_STORAGE_KEY, record);
  }

  private async clearRoomState(): Promise<void> {
    await this.state.storage.delete(ROOM_STORAGE_KEY);
    if (typeof this.state.storage.deleteAlarm === "function") {
      await this.state.storage.deleteAlarm();
    }

    this.room.id = "";
    this.room.players.clear();
    this.room.state = createInitialGameState();
    this.room.tokens.clear();
    this.room.candidateDrafts = { player1: [], player2: [] };
    this.room.emptyAt = null;
    this.expiresAt = null;
    this.updatedAt = Date.now();
    this.roomExists = false;
  }

  private async clearExpiry(): Promise<void> {
    this.room.emptyAt = null;
    this.expiresAt = null;
    if (typeof this.state.storage.deleteAlarm === "function") {
      await this.state.storage.deleteAlarm();
    }
  }

  private async scheduleExpiry(): Promise<void> {
    this.room.emptyAt = Date.now();
    this.expiresAt = this.room.emptyAt + ROOM_TTL_MS;
    await this.state.storage.setAlarm(this.expiresAt);
  }

  private createSocketAdapter(ws: WebSocket): GameSocket {
    return {
      data: createInitialSocketData(),
      send: (data: string) => ws.send(data),
      close: () => ws.close(),
    };
  }

  private async handleInitHost(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }
    if (!isInitHostPayload(payload)) {
      return new Response("Invalid payload", { status: 400 });
    }

    const roomId = normalizeRoomId(payload.roomId);
    if (!isValidRoomId(roomId)) {
      return new Response("Invalid room id", { status: 400 });
    }
    if (this.roomExists) {
      return new Response("Room already exists", { status: 409 });
    }

    this.room.id = roomId;
    this.room.state = createInitialGameState();
    this.room.tokens.clear();
    this.room.tokens.set("player1", payload.playerToken);
    this.room.candidateDrafts = { player1: [], player2: [] };
    this.room.emptyAt = null;
    this.expiresAt = null;
    this.roomExists = true;
    await this.persistRoomState();

    logEvent({
      event: "room.init_host",
      roomId,
      playerId: "player1",
      result: "ok",
    });

    return Response.json({
      roomId,
      playerId: "player1",
      playerToken: payload.playerToken,
    } satisfies CreatedRoomResponse);
  }

  private async handleSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    const session = this.sockets.get(ws);
    if (!session) {
      return;
    }

    const messageBytes = getMessageSizeBytes(message);
    if (messageBytes > MAX_MESSAGE_BYTES) {
      sendMessage(session.socket, {
        event: WS_EVENTS.GAME_ERROR,
        message: "Message too large",
      });
      ws.close();
      logEvent({
        event: "socket.message",
        roomId: this.room.id || "UNKNOWN",
        playerId: session.socket.data.playerId,
        result: "error",
        errorCode: "message_too_large",
      });
      return;
    }

    const now = Date.now();
    session.receivedAt = session.receivedAt.filter(
      (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
    );
    if (session.receivedAt.length >= RATE_LIMIT_COUNT) {
      sendMessage(session.socket, {
        event: WS_EVENTS.GAME_ERROR,
        message: "Rate limit exceeded",
      });
      ws.close();
      logEvent({
        event: "socket.message",
        roomId: this.room.id || "UNKNOWN",
        playerId: session.socket.data.playerId,
        result: "error",
        errorCode: "rate_limited",
      });
      return;
    }
    session.receivedAt.push(now);

    let json: unknown;
    try {
      json =
        typeof message === "string"
          ? JSON.parse(message)
          : JSON.parse(new TextDecoder().decode(new Uint8Array(message)));
    } catch {
      sendMessage(session.socket, {
        event: WS_EVENTS.GAME_ERROR,
        message: "Invalid JSON",
      });
      return;
    }

    const parsed = parseClientMessage(json);
    if (!parsed.success) {
      const issue = parsed.issues[0];
      sendMessage(session.socket, {
        event: WS_EVENTS.GAME_ERROR,
        message: `Validation error: ${issue?.message ?? "Unknown error"}`,
      });
      return;
    }

    const data = parsed.output;
    switch (data.event) {
      case WS_EVENTS.ROOM_JOIN:
        await this.handleRoomJoin(
          session.socket,
          data.roomId,
          data.playerToken,
        );
        break;
      case WS_EVENTS.GAME_UPDATE_CANDIDATE_DRAFT:
        this.handleUpdateCandidateDraft(session.socket, data.candidates);
        break;
      case WS_EVENTS.GAME_SUBMIT_CANDIDATES:
        await this.handleSubmitCandidates(session.socket, data.candidates);
        break;
    }
  }

  private async handleRoomJoin(
    ws: GameSocket,
    requestedRoomId: string,
    playerToken?: string,
  ): Promise<void> {
    const roomId = normalizeRoomId(requestedRoomId);
    if (!this.roomExists || this.room.id !== roomId) {
      sendMessage(ws, {
        event: WS_EVENTS.ROOM_ERROR,
        message: "Room not found",
      });
      return;
    }

    if (playerToken) {
      const matchedEntry = [...this.room.tokens.entries()].find(
        ([, token]) => token === playerToken,
      );
      const reconnectPlayerId = matchedEntry?.[0];
      if (!reconnectPlayerId) {
        sendMessage(ws, {
          event: WS_EVENTS.ROOM_ERROR,
          message: "Invalid token",
        });
        return;
      }

      const existingWs = this.room.players.get(reconnectPlayerId);
      if (existingWs && existingWs !== ws) {
        existingWs.data.roomId = null;
        existingWs.data.playerId = null;
        existingWs.data.playerToken = null;
        existingWs.close?.();
      }

      this.room.players.set(reconnectPlayerId, ws);
      ws.data.roomId = roomId;
      ws.data.playerId = reconnectPlayerId;
      ws.data.playerToken = playerToken;
      await this.clearExpiry();
      await this.persistRoomState();

      sendMessage(ws, {
        event: WS_EVENTS.ROOM_JOINED,
        roomId,
        playerId: reconnectPlayerId,
        playerToken,
      });
      sendMessage(ws, {
        event: WS_EVENTS.GAME_STATE,
        state: this.room.state,
      });

      for (const draftPlayerId of ["player1", "player2"] as const) {
        const draftMessage = JSON.stringify({
          event: WS_EVENTS.GAME_CANDIDATE_DRAFT_UPDATED,
          playerId: draftPlayerId,
          candidates: this.room.candidateDrafts[draftPlayerId],
        });
        for (const playerSocket of this.room.players.values()) {
          playerSocket.send(draftMessage);
        }
      }

      const opponentId = getOpponentPlayerId(reconnectPlayerId);
      if (this.room.players.has(opponentId)) {
        const opponent = this.room.players.get(opponentId);
        if (opponent) {
          sendMessage(opponent, {
            event: WS_EVENTS.ROOM_OPPONENT_ONLINE,
            playerId: reconnectPlayerId,
          });
        }
      }

      logEvent({
        event: "room.join",
        roomId,
        playerId: reconnectPlayerId,
        result: "ok",
      });
      return;
    }

    if (this.room.tokens.has("player2")) {
      sendMessage(ws, {
        event: WS_EVENTS.ROOM_ERROR,
        message: "Room is full",
      });
      return;
    }

    const token = generatePlayerToken();
    this.room.tokens.set("player2", token);
    this.room.players.set("player2", ws);
    ws.data.roomId = roomId;
    ws.data.playerId = "player2";
    ws.data.playerToken = token;
    await this.clearExpiry();

    sendMessage(ws, {
      event: WS_EVENTS.ROOM_JOINED,
      roomId,
      playerId: "player2",
      playerToken: token,
    });

    if (this.room.state.phase === "waiting") {
      startGame(this.room);
      const message = JSON.stringify({
        event: WS_EVENTS.GAME_START,
        state: this.room.state,
      });
      for (const socket of this.room.players.values()) {
        socket.send(message);
      }
    } else {
      sendMessage(ws, {
        event: WS_EVENTS.GAME_STATE,
        state: this.room.state,
      });
    }

    await this.persistRoomState();
    logEvent({
      event: "room.join",
      roomId,
      playerId: "player2",
      result: "ok",
    });
  }

  private handleUpdateCandidateDraft(
    ws: GameSocket,
    candidates: Coordinate[],
  ): void {
    const validation = validateDraftUpdateContext(
      this.roomExists ? this.room : undefined,
      ws.data.playerId,
      candidates,
    );
    if ("kind" in validation) {
      sendMessage(ws, {
        event: WS_EVENTS.GAME_ERROR,
        message: validation.message,
      });
      return;
    }
    updateCandidateDraft(validation);
  }

  private async handleSubmitCandidates(
    ws: GameSocket,
    candidates: Coordinate[],
  ): Promise<void> {
    const validation = validateTurnContext(
      this.roomExists ? this.room : undefined,
      ws.data.playerId,
      candidates,
    );
    if ("kind" in validation) {
      sendMessage(ws, {
        event: WS_EVENTS.GAME_ERROR,
        message: validation.message,
      });
      return;
    }
    processTurn(validation);
    await this.persistRoomState();
  }

  private async handleSocketClosed(ws: WebSocket): Promise<void> {
    const session = this.sockets.get(ws);
    if (!session) {
      return;
    }
    this.sockets.delete(ws);

    const roomId = session.socket.data.roomId;
    const playerId = session.socket.data.playerId;
    if (!roomId || !playerId || !this.roomExists) {
      return;
    }

    const currentWs = this.room.players.get(playerId);
    if (currentWs === session.socket) {
      this.room.players.delete(playerId);
      if (this.room.players.size === 0) {
        await this.scheduleExpiry();
      } else {
        const message = JSON.stringify({
          event: WS_EVENTS.ROOM_OPPONENT_OFFLINE,
          playerId,
        });
        for (const playerSocket of this.room.players.values()) {
          playerSocket.send(message);
        }
      }
      await this.persistRoomState();
    }

    session.socket.data.roomId = null;
    session.socket.data.playerId = null;
    session.socket.data.playerToken = null;
  }
}

export default app;
