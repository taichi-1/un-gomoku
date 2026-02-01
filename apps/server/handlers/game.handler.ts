import { WS_EVENTS } from "@pkg/shared/events";
import type { Coordinate } from "@pkg/shared/schemas";
import type { ServerWebSocket } from "bun";
import { getRoom, processTurn, validateTurnContext } from "../services";
import type { WebSocketData } from "../types";
import { sendMessage } from "../utils";

export function handleSubmitCandidates(
  ws: ServerWebSocket<WebSocketData>,
  candidates: Coordinate[],
): void {
  const room = getRoom(ws.data.roomId ?? "");
  const validation = validateTurnContext(room, ws.data.playerId, candidates);
  if ("kind" in validation) {
    sendMessage(ws, {
      event: WS_EVENTS.GAME_ERROR,
      message: validation.message,
    });
    return;
  }
  processTurn(validation);
}
