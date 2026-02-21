import { WS_EVENTS } from "@pkg/shared/events";
import { type PlayerId, parseServerMessage } from "@pkg/shared/schemas";
import { getWebSocketEndpoint } from "@/lib/ws-endpoint";

export interface CreatedRoom {
  roomId: string;
  playerId: PlayerId;
  playerToken: string;
}

interface RoomCreatedMessage {
  event: "room.created";
  roomId: string;
  playerId: PlayerId;
  playerToken: string;
}

interface RoomErrorMessage {
  event: "room.error";
  message: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRoomCreatedMessage(message: unknown): message is RoomCreatedMessage {
  if (!isObject(message)) {
    return false;
  }

  return (
    message.event === "room.created" &&
    typeof message.roomId === "string" &&
    (message.playerId === "player1" || message.playerId === "player2") &&
    typeof message.playerToken === "string"
  );
}

function isRoomErrorMessage(message: unknown): message is RoomErrorMessage {
  if (!isObject(message)) {
    return false;
  }

  return message.event === "room.error" && typeof message.message === "string";
}

export function createRoom(timeoutMs = 10_000): Promise<CreatedRoom> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(getWebSocketEndpoint());
    let settled = false;

    const finalize = (action: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      ws.close();
      action();
    };

    const timeout = window.setTimeout(() => {
      finalize(() => reject(new Error("Timed out while creating room")));
    }, timeoutMs);

    ws.onopen = () => {
      ws.send(JSON.stringify({ event: WS_EVENTS.ROOM_CREATE }));
    };

    ws.onmessage = (event) => {
      let json: unknown;
      try {
        json = JSON.parse(String(event.data));
      } catch {
        return;
      }

      const parsed = parseServerMessage(json);
      if (!parsed.success) {
        return;
      }

      const message = parsed.output as unknown;

      if (isRoomCreatedMessage(message)) {
        window.clearTimeout(timeout);
        finalize(() => {
          resolve({
            roomId: message.roomId,
            playerId: message.playerId,
            playerToken: message.playerToken,
          });
        });
        return;
      }

      if (isRoomErrorMessage(message)) {
        window.clearTimeout(timeout);
        finalize(() => reject(new Error(message.message)));
      }
    };

    ws.onerror = () => {
      window.clearTimeout(timeout);
      finalize(() => reject(new Error("Could not connect to server")));
    };

    ws.onclose = () => {
      if (settled) {
        return;
      }
      window.clearTimeout(timeout);
      finalize(() =>
        reject(new Error("Connection closed before room creation")),
      );
    };
  });
}
