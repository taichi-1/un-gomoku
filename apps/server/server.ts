import { WS_EVENTS } from "@pkg/shared/events";
import { parseClientMessage } from "@pkg/shared/schemas";
import { handleDisconnect, routeMessage } from "./handlers";
import type { WebSocketData } from "./types";
import { sendMessage } from "./utils";

export function startServer(port = 3000) {
  return Bun.serve<WebSocketData>({
    port,
    fetch(req, server) {
      const url = new URL(req.url);

      if (url.pathname === "/ws") {
        const upgraded = server.upgrade(req, {
          data: {
            roomId: null,
            playerId: null,
          },
        });
        if (upgraded) {
          return undefined;
        }
        return new Response("WebSocket upgrade failed", { status: 400 });
      }

      return new Response("un-gomoku server", { status: 200 });
    },
    websocket: {
      open() {
        console.log("Client connected");
      },
      message(ws, message) {
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
      },
      close(ws) {
        console.log("Client disconnected");
        handleDisconnect(ws);
      },
    },
  });
}
