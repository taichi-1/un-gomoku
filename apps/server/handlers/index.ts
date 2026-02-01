import { WS_EVENTS } from "@pkg/shared/events";
import type { ClientMessage } from "@pkg/shared/schemas";
import type { ServerWebSocket } from "bun";
import type { WebSocketData } from "../types";
import {
  handleSubmitCandidates,
  handleUndoAccept,
  handleUndoReject,
  handleUndoRequest,
} from "./game.handler";
import { handleRoomCreate, handleRoomJoin } from "./room.handler";

export { handleSubmitCandidates } from "./game.handler";
export {
  handleDisconnect,
  handleRoomCreate,
  handleRoomJoin,
} from "./room.handler";

export function routeMessage(
  ws: ServerWebSocket<WebSocketData>,
  data: ClientMessage,
): void {
  switch (data.event) {
    case WS_EVENTS.ROOM_CREATE:
      handleRoomCreate(ws);
      break;
    case WS_EVENTS.ROOM_JOIN:
      handleRoomJoin(ws, data.roomId, data.playerToken);
      break;
    case WS_EVENTS.GAME_SUBMIT_CANDIDATES:
      handleSubmitCandidates(ws, data.candidates);
      break;
    case WS_EVENTS.GAME_UNDO_REQUEST:
      handleUndoRequest(ws);
      break;
    case WS_EVENTS.GAME_UNDO_ACCEPT:
      handleUndoAccept(ws);
      break;
    case WS_EVENTS.GAME_UNDO_REJECT:
      handleUndoReject(ws);
      break;
  }
}
