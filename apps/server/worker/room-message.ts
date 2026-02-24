import { WS_EVENTS } from "@pkg/shared/events";
import { type Coordinate, parseClientMessage } from "@pkg/shared/schemas";
import {
  processTurn,
  updateCandidateDraft,
  validateDraftUpdateContext,
  validateTurnContext,
} from "../services/game.service";
import type { GameSocket } from "../types";
import { sendMessage } from "../utils";
import {
  MAX_MESSAGE_BYTES,
  RATE_LIMIT_COUNT,
  RATE_LIMIT_WINDOW_MS,
} from "./config";
import { logEvent } from "./logging";
import { handleRoomJoin } from "./room-join";
import { persistRoomState, scheduleExpiry } from "./room-storage";
import { createInitialSocketData, getMessageSizeBytes } from "./room-utils";
import type { GameRoomRuntime } from "./runtime-types";
import {
  readSocketAttachment,
  writeSocketAttachment,
} from "./socket-attachment";

export function createSocketAdapter(ws: WebSocket): GameSocket {
  let fallbackAttachment = readSocketAttachment(ws);
  return {
    data: createInitialSocketData(),
    send: (data: string) => ws.send(data),
    close: () => ws.close(),
    getAttachment: () => readSocketAttachment(ws) ?? fallbackAttachment,
    setAttachment: (attachment) => {
      fallbackAttachment = attachment;
      writeSocketAttachment(ws, attachment);
    },
    clearAttachment: () => {
      fallbackAttachment = null;
      writeSocketAttachment(ws, null);
    },
  };
}

export async function handleSocketMessage(
  runtime: GameRoomRuntime,
  ws: WebSocket,
  message: string | ArrayBuffer,
): Promise<void> {
  const session = runtime.sockets.get(ws);
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
      roomId: runtime.room.id || "UNKNOWN",
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
      roomId: runtime.room.id || "UNKNOWN",
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
      await handleRoomJoin(
        runtime,
        session.socket,
        data.roomId,
        data.playerToken,
      );
      break;
    case WS_EVENTS.GAME_UPDATE_CANDIDATE_DRAFT:
      handleUpdateCandidateDraft(runtime, session.socket, data.candidates);
      break;
    case WS_EVENTS.GAME_SUBMIT_CANDIDATES:
      await handleSubmitCandidates(runtime, session.socket, data.candidates);
      break;
  }
}

export function handleUpdateCandidateDraft(
  runtime: GameRoomRuntime,
  ws: GameSocket,
  candidates: Coordinate[],
): void {
  const validation = validateDraftUpdateContext(
    runtime.roomExists ? runtime.room : undefined,
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

export async function handleSubmitCandidates(
  runtime: GameRoomRuntime,
  ws: GameSocket,
  candidates: Coordinate[],
): Promise<void> {
  const validation = validateTurnContext(
    runtime.roomExists ? runtime.room : undefined,
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
  await persistRoomState(runtime);
}

export async function handleSocketClosed(
  runtime: GameRoomRuntime,
  ws: WebSocket,
): Promise<void> {
  const session = runtime.sockets.get(ws);
  if (!session) {
    return;
  }
  runtime.sockets.delete(ws);

  const roomId = session.socket.data.roomId;
  const playerId = session.socket.data.playerId;
  if (roomId && playerId && runtime.roomExists) {
    const currentWs = runtime.room.players.get(playerId);
    if (currentWs === session.socket) {
      runtime.room.players.delete(playerId);
      if (runtime.room.players.size === 0) {
        await scheduleExpiry(runtime);
      } else {
        const message = JSON.stringify({
          event: WS_EVENTS.ROOM_OPPONENT_OFFLINE,
          playerId,
        });
        for (const playerSocket of runtime.room.players.values()) {
          playerSocket.send(message);
        }
      }
      await persistRoomState(runtime);
    }
  }

  session.socket.data.roomId = null;
  session.socket.data.playerId = null;
  session.socket.data.playerToken = null;
  session.socket.clearAttachment();
}
