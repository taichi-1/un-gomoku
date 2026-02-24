import { describe, expect, test } from "bun:test";
import { getRoom, removePlayer } from "../services";
import type { GameSocket } from "../types";
import { handleRoomCreate, handleRoomJoin } from "./room.handler";

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
    close: () => undefined,
  } as GameSocket;
  return { ws, sent };
}

function findEvent(sent: unknown[], event: string) {
  return sent.find((msg) => (msg as { event?: string }).event === event);
}

function findEvents(sent: unknown[], event: string) {
  return sent.filter((msg) => (msg as { event?: string }).event === event);
}

describe("handleRoomJoin", () => {
  test("sends ROOM_ERROR when room is not found", () => {
    const { ws, sent } = createFakeWs();

    handleRoomJoin(ws, "NOPE");

    const msg = sent.at(-1) as { event?: string; message?: string };
    expect(msg.event).toBe("room.error");
    expect(msg.message).toBe("Room not found");
  });

  test("sends ROOM_JOINED and broadcasts GAME_START on success", () => {
    const player1 = createFakeWs();
    handleRoomCreate(player1.ws);

    const created = player1.sent.at(-1) as { event?: string; roomId?: string };
    if (!created.roomId) throw new Error("roomId not sent");

    const player2 = createFakeWs();
    handleRoomJoin(player2.ws, created.roomId);

    const joined = findEvent(player2.sent, "room.joined") as {
      event?: string;
      roomId?: string;
      playerId?: string;
    };
    expect(joined.roomId).toBe(created.roomId);
    expect(joined.playerId).toBe("player2");

    const gameStart1 = findEvent(player1.sent, "game.start") as {
      state?: { phase?: string };
    };
    expect(gameStart1.state?.phase).toBe("playing");

    const gameStart2 = findEvent(player2.sent, "game.start") as {
      state?: { phase?: string };
    };
    expect(gameStart2.state?.phase).toBe("playing");
  });

  test("reconnect broadcasts retained candidate drafts to both players", () => {
    const player1 = createFakeWs();
    handleRoomCreate(player1.ws);
    const created = player1.sent.at(-1) as {
      roomId?: string;
      playerToken?: string;
    };
    if (!created.roomId || !created.playerToken) {
      throw new Error("room not created");
    }

    const player2 = createFakeWs();
    handleRoomJoin(player2.ws, created.roomId);

    const room = getRoom(created.roomId);
    if (!room) throw new Error("room not found");
    room.candidateDrafts.player1 = [{ x: 1, y: 1 }];
    room.candidateDrafts.player2 = [{ x: 2, y: 2 }];

    removePlayer(player1.ws);

    const reconnect = createFakeWs();
    handleRoomJoin(reconnect.ws, created.roomId, created.playerToken);

    const reconnectState = findEvent(reconnect.sent, "game.state") as {
      state?: { phase?: string };
    };
    expect(reconnectState.state?.phase).toBe("playing");

    const reconnectDrafts = findEvents(
      reconnect.sent,
      "game.candidateDraftUpdated",
    ) as Array<{ playerId?: string; candidates?: unknown[] }>;
    expect(
      reconnectDrafts.map((draft) => ({
        playerId: draft.playerId,
        candidates: draft.candidates,
      })),
    ).toEqual([
      { playerId: "player1", candidates: [{ x: 1, y: 1 }] },
      { playerId: "player2", candidates: [{ x: 2, y: 2 }] },
    ]);

    const opponentDrafts = findEvents(
      player2.sent,
      "game.candidateDraftUpdated",
    ) as Array<{ playerId?: string; candidates?: unknown[] }>;
    expect(
      opponentDrafts.map((draft) => ({
        playerId: draft.playerId,
        candidates: draft.candidates,
      })),
    ).toEqual([
      { playerId: "player1", candidates: [{ x: 1, y: 1 }] },
      { playerId: "player2", candidates: [{ x: 2, y: 2 }] },
    ]);
  });

  test("reconnect with same token succeeds even if previous socket is still connected", () => {
    const player1 = createFakeWs();
    handleRoomCreate(player1.ws);
    const created = player1.sent.at(-1) as {
      roomId?: string;
      playerToken?: string;
    };
    if (!created.roomId || !created.playerToken) {
      throw new Error("room not created");
    }

    const player2 = createFakeWs();
    handleRoomJoin(player2.ws, created.roomId);

    const reconnect = createFakeWs();
    handleRoomJoin(reconnect.ws, created.roomId, created.playerToken);

    const rejoin = findEvent(reconnect.sent, "room.joined") as {
      playerId?: string;
    };
    expect(rejoin.playerId).toBe("player1");

    const state = findEvent(reconnect.sent, "game.state") as {
      state?: { phase?: string };
    };
    expect(state.state?.phase).toBe("playing");

    const opponentOnline = findEvent(player2.sent, "room.opponentOnline") as {
      playerId?: string;
    };
    expect(opponentOnline.playerId).toBe("player1");

    expect(player1.ws.data.roomId).toBeNull();
    expect(player1.ws.data.playerId).toBeNull();
    expect(player1.ws.data.playerToken).toBeNull();
  });
});
