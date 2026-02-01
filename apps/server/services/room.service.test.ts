import { describe, expect, test } from "bun:test";
import type { ServerWebSocket } from "bun";
import type { WebSocketData } from "../types";
import { createRoom, getRoom, joinRoom, removePlayer } from "./room.service";

function createMockWs(): ServerWebSocket<WebSocketData> {
  const data: WebSocketData = {
    roomId: null,
    playerId: null,
    playerToken: null,
  };
  return { data } as unknown as ServerWebSocket<WebSocketData>;
}

describe("room.service", () => {
  test("createRoom returns roomId and player1", () => {
    const ws = createMockWs();
    const result = createRoom(ws);
    expect(result.playerId).toBe("player1");
    expect(result.roomId).toMatch(/^[A-Z0-9]{6}$/);
    expect(result.playerToken.length).toBeGreaterThan(0);
    expect(ws.data.roomId).toBe(result.roomId);
    expect(ws.data.playerId).toBe("player1");
    expect(ws.data.playerToken).toBe(result.playerToken);
  });

  test("getRoom returns room after createRoom", () => {
    const ws = createMockWs();
    const { roomId } = createRoom(ws);
    const room = getRoom(roomId);
    expect(room).toBeDefined();
    expect(room?.id).toBe(roomId);
    expect(room?.players.size).toBe(1);
  });

  test("joinRoom adds player2 to room", () => {
    const ws1 = createMockWs();
    const ws2 = createMockWs();
    const { roomId } = createRoom(ws1);
    const result = joinRoom(ws2, roomId);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.playerId).toBe("player2");
      expect(result.isReconnect).toBe(false);
      expect(result.room.players.size).toBe(2);
      expect(ws2.data.roomId).toBe(roomId);
      expect(ws2.data.playerId).toBe("player2");
      expect(ws2.data.playerToken).toBe(result.playerToken);
    }
  });

  test("joinRoom returns error for non-existent room", () => {
    const ws = createMockWs();
    const result = joinRoom(ws, "NONEXIST");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Room not found");
    }
  });

  test("joinRoom returns error when room is full", () => {
    const ws1 = createMockWs();
    const ws2 = createMockWs();
    const ws3 = createMockWs();
    const { roomId } = createRoom(ws1);
    joinRoom(ws2, roomId);
    const result = joinRoom(ws3, roomId);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Room is full");
    }
  });

  test("removePlayer keeps room for reconnect when empty", () => {
    const ws = createMockWs();
    const { roomId } = createRoom(ws);
    expect(getRoom(roomId)).toBeDefined();
    removePlayer(ws);
    expect(getRoom(roomId)).toBeDefined();
  });

  test("removePlayer keeps room when other player remains", () => {
    const ws1 = createMockWs();
    const ws2 = createMockWs();
    const { roomId } = createRoom(ws1);
    joinRoom(ws2, roomId);
    removePlayer(ws1);
    expect(getRoom(roomId)).toBeDefined();
    removePlayer(ws2);
    expect(getRoom(roomId)).toBeDefined();
  });
});
