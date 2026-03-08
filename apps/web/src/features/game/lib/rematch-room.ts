import { getHttpBaseUrl } from "@/lib/ws-endpoint";

export async function rematchRoom(roomId: string): Promise<void> {
  const res = await fetch(`${getHttpBaseUrl()}/rooms/${roomId}/rematch`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Rematch failed: ${res.status}`);
}
