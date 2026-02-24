import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import app from "./worker";

interface DurableObjectStubLike {
  fetch(request: Request): Promise<Response>;
}

interface DurableObjectNamespaceLike {
  idFromName(name: string): object;
  get(id: object): DurableObjectStubLike;
}

function createBindings(fetchImpl: (request: Request) => Promise<Response>): {
  GAME_ROOM: DurableObjectNamespaceLike;
} {
  return {
    GAME_ROOM: {
      idFromName: (name: string) => ({ name }),
      get: () => ({
        fetch: fetchImpl,
      }),
    },
  };
}

const originalConsoleLog = console.log;

beforeEach(() => {
  console.log = () => undefined;
});

afterEach(() => {
  console.log = originalConsoleLog;
});

describe("worker routes", () => {
  test("POST /rooms returns created room payload", async () => {
    const bindings = createBindings(async (request) => {
      const body = (await request.json()) as {
        roomId: string;
        playerToken: string;
      };
      return Response.json({
        roomId: body.roomId,
        playerId: "player1",
        playerToken: body.playerToken,
      });
    });

    const response = await app.request("/rooms", { method: "POST" }, bindings);
    expect(response.status).toBe(200);

    const json = (await response.json()) as {
      roomId: string;
      playerId: string;
      playerToken: string;
    };
    expect(json.roomId).toMatch(/^[A-Z0-9]{6}$/);
    expect(json.playerId).toBe("player1");
    expect(json.playerToken).toMatch(/^[a-f0-9]{32}$/);
  });

  test("POST /rooms retries when init-host returns conflict", async () => {
    let callCount = 0;
    const bindings = createBindings(async (request) => {
      callCount += 1;
      if (callCount === 1) {
        return new Response("Room already exists", { status: 409 });
      }
      const body = (await request.json()) as {
        roomId: string;
        playerToken: string;
      };
      return Response.json({
        roomId: body.roomId,
        playerId: "player1",
        playerToken: body.playerToken,
      });
    });

    const response = await app.request("/rooms", { method: "POST" }, bindings);
    expect(response.status).toBe(200);
    expect(callCount).toBe(2);
  });

  test("POST /rooms returns 503 after max retries", async () => {
    let callCount = 0;
    const bindings = createBindings(async () => {
      callCount += 1;
      return new Response("Room already exists", { status: 409 });
    });

    const response = await app.request("/rooms", { method: "POST" }, bindings);
    expect(response.status).toBe(503);
    expect(callCount).toBe(5);
  });

  test("GET /ws/:roomId rejects non-websocket requests", async () => {
    const bindings = createBindings(async () => new Response("ok"));
    const response = await app.request("/ws/ABC123", undefined, bindings);
    expect(response.status).toBe(426);
  });

  test("GET /ws/:roomId validates room id format", async () => {
    const bindings = createBindings(async () => new Response("ok"));
    const response = await app.request(
      "/ws/invalid",
      {
        headers: {
          Upgrade: "websocket",
        },
      },
      bindings,
    );
    expect(response.status).toBe(400);
  });

  test("GET /ws/:roomId forwards upgrade request to room DO", async () => {
    let callCount = 0;
    const bindings = createBindings(async () => {
      callCount += 1;
      return new Response("forwarded");
    });
    const response = await app.request(
      "/ws/ABC123",
      {
        headers: {
          Upgrade: "websocket",
        },
      },
      bindings,
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("forwarded");
    expect(callCount).toBe(1);
  });
});
