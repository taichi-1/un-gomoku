import type { PlayerId } from "@pkg/shared/schemas";
import { createSocketAdapter } from "./room-message";
import type { GameRoomRuntime } from "./runtime-types";

function clearSocketSession(socket: {
  data: {
    roomId: string | null;
    playerId: PlayerId | null;
    playerToken: string | null;
  };
  clearAttachment: () => void;
}): void {
  socket.data.roomId = null;
  socket.data.playerId = null;
  socket.data.playerToken = null;
  socket.clearAttachment();
}

function applySocketSession(
  socket: {
    data: {
      roomId: string | null;
      playerId: PlayerId | null;
      playerToken: string | null;
    };
  },
  session: { roomId: string; playerId: PlayerId; playerToken: string },
): void {
  socket.data.roomId = session.roomId;
  socket.data.playerId = session.playerId;
  socket.data.playerToken = session.playerToken;
}

export function rehydrateRoomSockets(
  runtime: GameRoomRuntime,
  webSockets: WebSocket[],
): void {
  runtime.sockets.clear();
  runtime.room.players.clear();

  const activeByPlayer = new Map<
    PlayerId,
    { ws: WebSocket; socket: ReturnType<typeof createSocketAdapter> }
  >();

  for (const ws of webSockets) {
    const socket = createSocketAdapter(ws);
    runtime.sockets.set(ws, { socket, receivedAt: [] });

    const attachment = socket.getAttachment();
    if (!attachment) {
      continue;
    }

    const isInvalidAttachment =
      !runtime.roomExists ||
      runtime.room.id !== attachment.roomId ||
      runtime.room.tokens.get(attachment.playerId) !== attachment.playerToken;

    if (isInvalidAttachment) {
      clearSocketSession(socket);
      ws.close();
      runtime.sockets.delete(ws);
      continue;
    }

    applySocketSession(socket, attachment);

    const existing = activeByPlayer.get(attachment.playerId);
    if (existing) {
      clearSocketSession(existing.socket);
      existing.ws.close();
      runtime.sockets.delete(existing.ws);
    }

    activeByPlayer.set(attachment.playerId, { ws, socket });
    runtime.room.players.set(attachment.playerId, socket);
  }
}
