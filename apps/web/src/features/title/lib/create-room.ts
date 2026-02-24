import type { PlayerId } from "@pkg/shared/schemas";
import { getHttpBaseUrl } from "@/lib/ws-endpoint";

export interface CreatedRoom {
  roomId: string;
  playerId: PlayerId;
  playerToken: string;
}

interface CreateRoomResponse extends CreatedRoom {}

function isCreateRoomResponse(value: unknown): value is CreateRoomResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const response = value as Record<string, unknown>;
  return (
    typeof response.roomId === "string" &&
    (response.playerId === "player1" || response.playerId === "player2") &&
    typeof response.playerToken === "string"
  );
}

export async function createRoom(timeoutMs = 10_000): Promise<CreatedRoom> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${getHttpBaseUrl()}/rooms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Timed out while creating room");
    }
    throw new Error("Could not create room");
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Could not create room (${response.status})`);
  }

  const json: unknown = await response.json();
  if (!isCreateRoomResponse(json)) {
    throw new Error("Invalid room create response");
  }

  return json;
}
