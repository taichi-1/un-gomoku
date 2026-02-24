import { createInitialGameState } from "@pkg/core/game-state";
import { WS_EVENTS } from "@pkg/shared/events";
import type { GameSocket } from "../types";
import { generatePlayerToken, sendMessage } from "../utils";
import { logEvent } from "./logging";
import { clearExpiry, persistRoomState } from "./room-storage";
import {
  getOpponentPlayerId,
  isValidRoomId,
  normalizeRoomId,
  startGame,
} from "./room-utils";
import type {
  CreatedRoomResponse,
  GameRoomRuntime,
  InitHostPayload,
} from "./runtime-types";

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

export async function handleInitHost(
  runtime: GameRoomRuntime,
  request: Request,
): Promise<Response> {
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
  if (runtime.roomExists) {
    return new Response("Room already exists", { status: 409 });
  }

  runtime.room.id = roomId;
  runtime.room.state = createInitialGameState();
  runtime.room.tokens.clear();
  runtime.room.tokens.set("player1", payload.playerToken);
  runtime.room.candidateDrafts = { player1: [], player2: [] };
  runtime.room.emptyAt = null;
  runtime.expiresAt = null;
  runtime.roomExists = true;
  await persistRoomState(runtime);

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

export async function handleRoomJoin(
  runtime: GameRoomRuntime,
  ws: GameSocket,
  requestedRoomId: string,
  playerToken?: string,
): Promise<void> {
  const roomId = normalizeRoomId(requestedRoomId);
  if (!runtime.roomExists || runtime.room.id !== roomId) {
    sendMessage(ws, {
      event: WS_EVENTS.ROOM_ERROR,
      message: "Room not found",
    });
    return;
  }

  if (playerToken) {
    const matchedEntry = [...runtime.room.tokens.entries()].find(
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

    const existingWs = runtime.room.players.get(reconnectPlayerId);
    if (existingWs && existingWs !== ws) {
      existingWs.data.roomId = null;
      existingWs.data.playerId = null;
      existingWs.data.playerToken = null;
      existingWs.clearAttachment();
      existingWs.close?.();
    }

    runtime.room.players.set(reconnectPlayerId, ws);
    ws.data.roomId = roomId;
    ws.data.playerId = reconnectPlayerId;
    ws.data.playerToken = playerToken;
    ws.setAttachment({
      roomId,
      playerId: reconnectPlayerId,
      playerToken,
    });
    await clearExpiry(runtime);
    await persistRoomState(runtime);

    sendMessage(ws, {
      event: WS_EVENTS.ROOM_JOINED,
      roomId,
      playerId: reconnectPlayerId,
      playerToken,
    });
    sendMessage(ws, {
      event: WS_EVENTS.GAME_STATE,
      state: runtime.room.state,
    });

    for (const draftPlayerId of ["player1", "player2"] as const) {
      const draftMessage = JSON.stringify({
        event: WS_EVENTS.GAME_CANDIDATE_DRAFT_UPDATED,
        playerId: draftPlayerId,
        candidates: runtime.room.candidateDrafts[draftPlayerId],
      });
      for (const playerSocket of runtime.room.players.values()) {
        playerSocket.send(draftMessage);
      }
    }

    const opponentId = getOpponentPlayerId(reconnectPlayerId);
    if (runtime.room.players.has(opponentId)) {
      const opponent = runtime.room.players.get(opponentId);
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

  if (runtime.room.tokens.has("player2")) {
    sendMessage(ws, {
      event: WS_EVENTS.ROOM_ERROR,
      message: "Room is full",
    });
    return;
  }

  const token = generatePlayerToken();
  runtime.room.tokens.set("player2", token);
  runtime.room.players.set("player2", ws);
  ws.data.roomId = roomId;
  ws.data.playerId = "player2";
  ws.data.playerToken = token;
  ws.setAttachment({
    roomId,
    playerId: "player2",
    playerToken: token,
  });
  await clearExpiry(runtime);

  sendMessage(ws, {
    event: WS_EVENTS.ROOM_JOINED,
    roomId,
    playerId: "player2",
    playerToken: token,
  });

  if (runtime.room.state.phase === "waiting") {
    startGame(runtime.room);
    const message = JSON.stringify({
      event: WS_EVENTS.GAME_START,
      state: runtime.room.state,
    });
    for (const socket of runtime.room.players.values()) {
      socket.send(message);
    }
  } else {
    sendMessage(ws, {
      event: WS_EVENTS.GAME_STATE,
      state: runtime.room.state,
    });
  }

  await persistRoomState(runtime);
  logEvent({
    event: "room.join",
    roomId,
    playerId: "player2",
    result: "ok",
  });
}
