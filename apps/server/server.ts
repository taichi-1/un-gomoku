import { WS_EVENTS } from "@pkg/shared/events";
import { parseClientMessage } from "@pkg/shared/schemas";
import { routeMessage } from "./handlers";
import type { GameSocket, WebSocketData } from "./types";
import { sendMessage } from "./utils";

export function handleWebSocketMessage(
  ws: GameSocket,
  message: string | ArrayBuffer | Uint8Array,
): void {
  let json: unknown;
  try {
    json = JSON.parse(message.toString());
  } catch {
    sendMessage(ws, {
      event: WS_EVENTS.GAME_ERROR,
      message: "Invalid JSON",
    });
    return;
  }

  const result = parseClientMessage(json);
  if (!result.success) {
    const issue = result.issues[0];
    sendMessage(ws, {
      event: WS_EVENTS.GAME_ERROR,
      message: `Validation error: ${issue?.message ?? "Unknown error"}`,
    });
    return;
  }

  try {
    routeMessage(ws, result.output);
  } catch (error) {
    console.error("Error processing message:", error);
    sendMessage(ws, {
      event: WS_EVENTS.GAME_ERROR,
      message: "Error processing message",
    });
  }
}

export function createInitialSocketData(): WebSocketData {
  return {
    roomId: null,
    playerId: null,
    playerToken: null,
  };
}
