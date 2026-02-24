import { Hono } from "hono";
import { cors } from "hono/cors";
import { generatePlayerToken, generateRoomId } from "../utils";
import { MAX_ROOM_CREATE_ATTEMPTS } from "./config";
import { logEvent } from "./logging";
import {
  isValidRoomId,
  isWebSocketUpgrade,
  normalizeRoomId,
} from "./room-utils";
import type { CreatedRoomResponse, WorkerBindings } from "./runtime-types";

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

function createRoomInitRequest(roomId: string, playerToken: string): Request {
  return new Request("https://room.internal/internal/init-host", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      roomId,
      playerToken,
    }),
  });
}

function logRoomCreateError(roomId: string, errorCode: string): void {
  logEvent({
    event: "room.create",
    roomId,
    playerId: null,
    result: "error",
    errorCode,
  });
}

export function createWorkerApp() {
  const app = new Hono<{ Bindings: WorkerBindings }>();

  app.use(
    "*",
    cors({
      origin: "*",
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type"],
    }),
  );

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
      const initResponse = await stub.fetch(
        createRoomInitRequest(roomId, playerToken),
      );

      if (initResponse.status === 409) {
        continue;
      }
      if (!initResponse.ok) {
        logRoomCreateError(roomId, "create_failed");
        return c.json({ message: "Could not create room" }, 503);
      }

      let json: unknown;
      try {
        json = await initResponse.json();
      } catch {
        logRoomCreateError(roomId, "invalid_init_response");
        return c.json({ message: "Could not create room" }, 503);
      }

      if (!isCreatedRoomResponse(json)) {
        logRoomCreateError(roomId, "invalid_payload");
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

  return app;
}
