import type { SocketAttachment } from "../types";

interface AttachmentCapableWebSocket extends WebSocket {
  serializeAttachment(value: unknown): void;
  deserializeAttachment(): unknown;
}

function isAttachmentCapableWebSocket(
  ws: WebSocket,
): ws is AttachmentCapableWebSocket {
  const candidate = ws as Partial<AttachmentCapableWebSocket>;
  return (
    typeof candidate.serializeAttachment === "function" &&
    typeof candidate.deserializeAttachment === "function"
  );
}

function isPlayerId(value: unknown): value is SocketAttachment["playerId"] {
  return value === "player1" || value === "player2";
}

export function parseSocketAttachment(value: unknown): SocketAttachment | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<Record<keyof SocketAttachment, unknown>>;
  if (
    typeof candidate.roomId !== "string" ||
    !isPlayerId(candidate.playerId) ||
    typeof candidate.playerToken !== "string"
  ) {
    return null;
  }
  return {
    roomId: candidate.roomId,
    playerId: candidate.playerId,
    playerToken: candidate.playerToken,
  };
}

export function readSocketAttachment(ws: WebSocket): SocketAttachment | null {
  if (!isAttachmentCapableWebSocket(ws)) {
    return null;
  }
  try {
    return parseSocketAttachment(ws.deserializeAttachment());
  } catch {
    return null;
  }
}

export function writeSocketAttachment(
  ws: WebSocket,
  attachment: SocketAttachment | null,
): void {
  if (!isAttachmentCapableWebSocket(ws)) {
    return;
  }
  try {
    ws.serializeAttachment(attachment);
  } catch {
    return;
  }
}
