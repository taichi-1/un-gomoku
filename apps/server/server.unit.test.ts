import { describe, expect, test } from "bun:test";
import { handleWebSocketMessage } from "./server";
import type { GameSocket } from "./types";

function createFakeWs(): {
  ws: GameSocket;
  sent: unknown[];
} {
  const sent: unknown[] = [];
  const ws = {
    data: { roomId: null, playerId: null, playerToken: null },
    send: (data: string) => {
      sent.push(JSON.parse(data));
    },
  } as GameSocket;
  return { ws, sent };
}

describe("handleWebSocketMessage", () => {
  test("sends GAME_ERROR on invalid JSON", () => {
    const { ws, sent } = createFakeWs();

    handleWebSocketMessage(ws, "{");

    const msg = sent.at(-1) as { event?: string; message?: string };
    expect(msg.event).toBe("game.error");
    expect(msg.message).toBe("Invalid JSON");
  });

  test("sends GAME_ERROR on schema validation failure", () => {
    const { ws, sent } = createFakeWs();

    handleWebSocketMessage(ws, JSON.stringify({ event: "unknown.event" }));

    const msg = sent.at(-1) as { event?: string; message?: string };
    expect(msg.event).toBe("game.error");
    expect(msg.message?.startsWith("Validation error:")).toBe(true);
  });

  test("routes valid messages", () => {
    const { ws, sent } = createFakeWs();

    handleWebSocketMessage(ws, JSON.stringify({ event: "room.create" }));

    const msg = sent.at(-1) as { event?: string };
    expect(msg.event).toBe("room.created");
  });
});
