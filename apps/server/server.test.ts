import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { startServer } from "./server";

let server: ReturnType<typeof startServer>;
let wsUrl: string;

function createWsClient(): Promise<{
  ws: WebSocket;
  received: unknown[];
  send: (data: object) => void;
  waitForMessage: (predicate?: (m: unknown) => boolean) => Promise<unknown>;
  close: () => void;
}> {
  return new Promise((resolve) => {
    const received: unknown[] = [];
    const ws = new WebSocket(wsUrl);
    const pendingResolvers: Array<(m: unknown) => void> = [];

    ws.addEventListener("open", () => {
      resolve({
        ws,
        received,
        send: (data: object) => ws.send(JSON.stringify(data)),
        waitForMessage: (predicate?: (m: unknown) => boolean) =>
          new Promise<unknown>((res) => {
            const existing = received.find((m) => !predicate || predicate(m));
            if (existing !== undefined) {
              res(existing);
              return;
            }
            pendingResolvers.push((m) => {
              if (!predicate || predicate(m)) res(m);
            });
          }),
        close: () => ws.close(),
      });
    });

    ws.addEventListener("message", (event) => {
      const raw =
        typeof event.data === "string"
          ? event.data
          : event.data instanceof ArrayBuffer
            ? new TextDecoder().decode(event.data)
            : String(event.data);
      const data = JSON.parse(raw);
      received.push(data);
      for (const res of pendingResolvers.splice(0)) {
        res(data);
      }
    });
  });
}

beforeAll(() => {
  server = startServer(0);
  wsUrl = `ws://127.0.0.1:${server.port}/ws`;
});

afterAll(async () => {
  await server.stop(true);
});

describe("WebSocket integration", () => {
  test("room.create returns roomId and playerId", async () => {
    const client = await createWsClient();
    client.send({ event: "room.create" });

    const msg = await client.waitForMessage(
      (m: unknown) => (m as { event?: string }).event === "room.created",
    );
    expect(msg).toBeDefined();
    expect((msg as { event: string }).event).toBe("room.created");
    expect((msg as { roomId: string }).roomId).toMatch(/^[A-Z0-9]{6}$/);
    expect((msg as { playerId: string }).playerId).toBe("player1");

    client.close();
  });

  test("room.join starts game and broadcasts game.start", async () => {
    const player1 = await createWsClient();
    player1.send({ event: "room.create" });
    const created = (await player1.waitForMessage(
      (m: unknown) => (m as { event?: string }).event === "room.created",
    )) as { roomId: string };

    const player2 = await createWsClient();
    player2.send({ event: "room.join", roomId: created.roomId });

    const joined = (await player2.waitForMessage(
      (m: unknown) => (m as { event?: string }).event === "room.joined",
    )) as { roomId: string; playerId: string };
    expect(joined.roomId).toBe(created.roomId);
    expect(joined.playerId).toBe("player2");

    const gameStart1 = await player1.waitForMessage(
      (m: unknown) => (m as { event?: string }).event === "game.start",
    );
    expect(gameStart1).toBeDefined();
    expect((gameStart1 as { state: { phase: string } }).state.phase).toBe(
      "playing",
    );

    const gameStart2 = await player2.waitForMessage(
      (m: unknown) => (m as { event?: string }).event === "game.start",
    );
    expect(gameStart2).toBeDefined();

    player1.close();
    player2.close();
  });

  // TODO: Investigate WebSocket message propagation in Bun test environment
  test.skip("game.submitCandidates processes turn and broadcasts turnResult", async () => {
    const player1 = await createWsClient();
    player1.send({ event: "room.create" });
    const created = (await player1.waitForMessage(
      (m: unknown) => (m as { event?: string }).event === "room.created",
    )) as { roomId: string };

    const player2 = await createWsClient();
    player2.send({ event: "room.join", roomId: created.roomId });
    await Promise.all([
      player1.waitForMessage(
        (m: unknown) => (m as { event?: string }).event === "game.start",
      ),
      player2.waitForMessage(
        (m: unknown) => (m as { event?: string }).event === "game.start",
      ),
    ]);

    // Allow server to finish processing before next message
    await Bun.sleep(50);

    player1.send({
      event: "game.submitCandidates",
      candidates: [{ x: 7, y: 7 }],
    });

    const turnResult = await Promise.race([
      player1.waitForMessage((m: unknown) => {
        const e = (m as { event?: string }).event;
        return e === "game.turnResult" || e === "game.error";
      }),
      player2.waitForMessage((m: unknown) => {
        const e = (m as { event?: string }).event;
        return e === "game.turnResult" || e === "game.error";
      }),
    ]);

    expect(turnResult).toBeDefined();
    const msg = turnResult as { event: string; result?: unknown };
    expect(msg.event).toBe("game.turnResult");
    const result = msg as {
      result: { success: boolean; candidates: unknown[] };
    };
    expect(typeof result.result.success).toBe("boolean");
    expect(result.result).toHaveProperty("candidates");
    expect(result.result.candidates).toEqual([{ x: 7, y: 7 }]);

    player1.close();
    player2.close();
  });
});
